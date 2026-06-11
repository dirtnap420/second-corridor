// refresh.mjs — P42: the full refresh orchestrator.
// fetch (fail-soft) → validate (per-source, restore-on-fail) → diff → archive
// → changelog → status. One dead API never blocks the other seven datasets;
// a malformed response never replaces last-good data.
//
//   node scripts/refresh.mjs                  full refresh
//   node scripts/refresh.mjs --only=qcew,bps  subset
//   node scripts/refresh.mjs --dry-run        print the would-be diff, write nothing
//   node scripts/refresh.mjs --offline        cache-only (no network) — for tests
//   node scripts/refresh.mjs --no-cache       force refetch of everything
//   node scripts/refresh.mjs --fail=qcew      test hook: force one source to fail
//
// P45: one REFRESH_TIMESTAMP per run. P13: retrievedAt-only churn restores
// the previous files and reports "checked, unchanged". P8/P9/P10: on real
// change, the prior files are archived to data-archive/YYYY-MM-DD/, the
// machine-readable diff lands in public/data/changes.json, and a human block
// is appended to CHANGELOG-DATA.md. P14: new periods are reported distinctly
// from value revisions. P39: public/status.json carries per-source state.
import { spawnSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, appendFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = (n) => `${ROOT}public/data/${n}.json`;
const SOURCES = ['qcew', 'ipeds', 'oews', 'lodes', 'usaspending', 'bps', 'acs', 'nyiso'];
// fetcher name → emitted dataset name
const EMITS = {
  qcew: 'qcew', ipeds: 'ipeds', oews: 'oews', lodes: 'lodes',
  usaspending: 'spending', bps: 'permits', acs: 'acs', nyiso: 'nyiso',
};

const args = process.argv.slice(2);
const opt = (name) => {
  const a = args.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  return a ? (a.includes('=') ? a.split('=')[1] : true) : null;
};
const only = opt('only');
const fail = opt('fail');
const dryRun = !!opt('dry-run');
const offline = !!opt('offline');
const noCache = !!opt('no-cache');

const STAMP = process.env.REFRESH_TIMESTAMP || new Date().toISOString().slice(0, 10);

let list = SOURCES;
if (only) {
  const wanted = String(only).split(',');
  const unknown = wanted.filter((w) => !SOURCES.includes(w));
  if (unknown.length) {
    console.error(`unknown source(s): ${unknown.join(', ')} — valid: ${SOURCES.join(', ')}`);
    process.exit(2);
  }
  list = SOURCES.filter((s) => wanted.includes(s));
}

/* ---------- snapshot last-good state ---------- */
const prev = {};
for (const src of list) {
  const p = DATA(EMITS[src]);
  prev[src] = existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/* ---------- fetch (fail-soft) + validate (restore on fail) ---------- */
const results = [];
for (const src of list) {
  const script = fileURLToPath(new URL(`./fetch-${src}.mjs`, import.meta.url));
  const t0 = Date.now();
  let status, note = '';
  if (fail === src) {
    status = 'FAIL';
    note = 'forced failure (--fail)';
  } else {
    const r = spawnSync(process.execPath, [script], {
      stdio: 'inherit',
      env: {
        ...process.env,
        REFRESH_TIMESTAMP: STAMP,
        ...(noCache ? { NO_CACHE: '1' } : {}),
        ...(offline ? { OFFLINE: '1' } : {}),
      },
    });
    if (r.status !== 0) {
      status = 'FAIL';
      note = `fetcher exit ${r.status}`;
    } else {
      const v = spawnSync(process.execPath, [fileURLToPath(new URL('./validate.mjs', import.meta.url)), EMITS[src]], { stdio: 'inherit' });
      if (v.status !== 0) {
        status = 'INVALID';
        note = 'failed validation — previous data restored';
        if (prev[src] !== null) writeFileSync(DATA(EMITS[src]), prev[src]);
      } else {
        status = 'ok';
      }
    }
  }
  results.push({ src, status, ms: Date.now() - t0, note });
}

/* ---------- diff prev vs new (P9/P14), ignoring timestamp churn ---------- */
const scrub = (objStr) => {
  if (objStr === null) return null;
  const o = JSON.parse(objStr);
  if (o.provenance) delete o.provenance.retrievedAt;
  if (o.chipsNotPublished) delete o.chipsNotPublished.checkedAt;
  return o;
};
const PERIOD_KEYS = ['year', 'ym'];
function diffDataset(a, b) {
  // walks arrays of period-keyed objects and scalar leaves; returns the P9 fields
  const out = { periodsAdded: [], valuesChanged: [], suppressionFlips: [], other: [] };
  const isSupp = (v) => v && typeof v === 'object' && v.suppressed === true;
  const leafEq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  function walk(x, y, path) {
    if (leafEq(x, y)) return;
    if (Array.isArray(x) && Array.isArray(y)) {
      const key = PERIOD_KEYS.find((k) => y[0] && typeof y[0] === 'object' && k in (y[0] || {}));
      if (key) {
        const ax = new Map(x.map((it) => [it[key], it]));
        for (const it of y) {
          if (!ax.has(it[key])) out.periodsAdded.push(`${path}[${key}=${it[key]}]`);
          else walk(ax.get(it[key]), it, `${path}[${key}=${it[key]}]`);
        }
        for (const it of x) {
          const ay = new Map(y.map((j) => [j[key], j]));
          if (!ay.has(it[key])) out.other.push(`${path}[${key}=${it[key]}] removed`);
        }
        return;
      }
      // unkeyed arrays: report wholesale if different
      out.other.push(`${path} changed (array)`);
      return;
    }
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        walk(x[k], y[k], path ? `${path}.${k}` : k);
      }
      return;
    }
    // scalar or mixed leaf change
    if (isSupp(x) !== isSupp(y)) {
      out.suppressionFlips.push({ path, was: isSupp(x) ? 'suppressed' : x, now: isSupp(y) ? 'suppressed' : y });
    } else {
      out.valuesChanged.push({ path, was: x, now: y });
    }
  }
  walk(a, b, '');
  return out;
}

const changes = {};
for (const src of list) {
  const r = results.find((x) => x.src === src);
  if (r.status !== 'ok' || prev[src] === null) continue;
  const after = readFileSync(DATA(EMITS[src]), 'utf8');
  const d = diffDataset(scrub(prev[src]), scrub(after));
  if (d.periodsAdded.length || d.valuesChanged.length || d.suppressionFlips.length || d.other.length) {
    const prevProv = JSON.parse(prev[src]).provenance || {};
    const nowProv = JSON.parse(after).provenance || {};
    changes[EMITS[src]] = {
      priorVintage: prevProv.vintage || null,
      vintage: nowProv.vintage || null,
      periodsAdded: d.periodsAdded,
      suppressionFlips: d.suppressionFlips,
      valuesChanged: d.valuesChanged.slice(0, 50),
      valuesChangedCount: d.valuesChanged.length,
      other: d.other,
    };
  }
}
const changedNames = Object.keys(changes);
const newPeriodsOnly =
  changedNames.length > 0 &&
  changedNames.every(
    (n) =>
      changes[n].periodsAdded.length > 0 &&
      changes[n].valuesChangedCount === 0 &&
      changes[n].suppressionFlips.length === 0 &&
      changes[n].other.length === 0 &&
      changes[n].vintage !== changes[n].priorVintage
  );

/* ---------- dry-run / no-change: restore, report, stop ---------- */
const restoreAll = () => {
  for (const src of list) if (prev[src] !== null) writeFileSync(DATA(EMITS[src]), prev[src]);
};

const table = () => {
  console.log('\n— refresh results ' + '—'.repeat(42));
  for (const r of results) {
    console.log(`  ${r.status.padEnd(7)} ${r.src.padEnd(12)} ${String(r.ms).padStart(7)}ms  ${r.note}`);
  }
};

if (dryRun) {
  table();
  console.log(`\n— would-be changes (${changedNames.length} dataset(s)) ` + '—'.repeat(20));
  console.log(JSON.stringify(changes, null, 2).slice(0, 4000));
  restoreAll();
  console.log('\ndry run: all files restored, nothing written');
  process.exit(results.some((r) => r.status !== 'ok') ? 1 : 0);
}

if (changedNames.length === 0) {
  restoreAll(); // kill retrievedAt-only churn (P13)
  table();
  console.log(`checked, unchanged (${STAMP}) — no commit, no deploy needed`);
  process.exit(results.some((r) => r.status !== 'ok') ? 1 : 0);
}

/* ---------- real changes: archive (P8), changes.json (P9), changelog (P10), status (P39) ---------- */
const archiveDir = `${ROOT}data-archive/${STAMP}/`;
mkdirSync(archiveDir, { recursive: true });
for (const src of list) {
  if (prev[src] !== null) writeFileSync(`${archiveDir}${EMITS[src]}.json`, prev[src]);
}

writeFileSync(
  DATA('changes'),
  JSON.stringify({ schemaVersion: 1, generatedAt: STAMP, newPeriodsOnly, datasets: changes })
);

const block = [
  `\n## ${STAMP}`,
  ...changedNames.map((n) => {
    const c = changes[n];
    const bits = [];
    if (c.periodsAdded.length) bits.push(`${c.periodsAdded.length} new period(s): ${c.periodsAdded.slice(0, 4).join(', ')}${c.periodsAdded.length > 4 ? '…' : ''}`);
    if (c.valuesChangedCount) bits.push(`${c.valuesChangedCount} value(s) revised`);
    if (c.suppressionFlips.length) bits.push(`${c.suppressionFlips.length} suppression flip(s)`);
    if (c.vintage !== c.priorVintage) bits.push(`vintage: ${c.priorVintage} → ${c.vintage}`);
    return `- **${n}** — ${bits.join(' · ') || 'changed'}`;
  }),
  '',
].join('\n');
const clPath = `${ROOT}CHANGELOG-DATA.md`;
if (!existsSync(clPath)) {
  writeFileSync(clPath, '# Data changelog\n\nOne block per refresh that changed the published record. Newest last.\n');
}
appendFileSync(clPath, block);

/* status.json — written only on change runs so no-op crons don't churn the repo */
const calendar = JSON.parse(readFileSync(fileURLToPath(new URL('./release-calendar.json', import.meta.url)), 'utf8'));
const status = {
  schemaVersion: 1,
  lastRefresh: STAMP,
  newPeriodsOnly,
  sources: Object.fromEntries(
    list.map((src) => {
      const r = results.find((x) => x.src === src);
      const name = EMITS[src];
      return [
        name,
        {
          status: r.status,
          changed: changedNames.includes(name),
          cadence: calendar.sources[src]?.cadence || null,
        },
      ];
    })
  ),
};
writeFileSync(`${ROOT}public/status.json`, JSON.stringify(status));

table();
console.log(
  `\n${changedNames.length} dataset(s) changed${newPeriodsOnly ? ' (new periods only)' : ''}: ${changedNames.join(', ')}`
);
console.log(`archived prior state → data-archive/${STAMP}/ · changes.json + CHANGELOG-DATA.md + status.json written`);
process.exit(results.some((r) => r.status !== 'ok') ? 1 : 0);
