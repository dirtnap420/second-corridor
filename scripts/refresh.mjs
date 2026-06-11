// refresh.mjs — P25: fail-soft orchestrator (first cut of P42).
// Runs all eight fetchers; one dead API never blocks the other seven datasets.
// Prints a per-source results table; exits non-zero if any source failed.
//
//   node scripts/refresh.mjs                  full refresh
//   node scripts/refresh.mjs --only=qcew,bps  subset
//   node scripts/refresh.mjs --no-cache       NO_CACHE=1 for every fetcher
//   node scripts/refresh.mjs --fail=qcew      test hook: force one source to
//                                             fail (battery uses this to prove
//                                             fail-soft behavior)
//
// Wave 3 (P42) adds --dry-run and --offline.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SOURCES = [
  'qcew',
  'ipeds',
  'oews',
  'lodes',
  'usaspending',
  'bps',
  'acs',
  'nyiso',
];

const args = process.argv.slice(2);
const opt = (name) => {
  const a = args.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return null;
  return a.includes('=') ? a.split('=')[1] : true;
};

const only = opt('only');
const fail = opt('fail');
const noCache = opt('no-cache');

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

const results = [];
for (const src of list) {
  const script = fileURLToPath(new URL(`./fetch-${src}.mjs`, import.meta.url));
  const t0 = Date.now();
  const r =
    fail === src
      ? { status: 1, error: null, forced: true }
      : spawnSync(process.execPath, [script], {
          stdio: 'inherit',
          env: { ...process.env, ...(noCache ? { NO_CACHE: '1' } : {}) },
        });
  results.push({
    src,
    ok: r.status === 0,
    ms: Date.now() - t0,
    note: r.forced ? 'forced failure (--fail)' : r.error ? String(r.error) : '',
  });
}

console.log('\n— refresh results ' + '—'.repeat(42));
for (const r of results) {
  console.log(
    `  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.src.padEnd(12)} ${String(r.ms).padStart(7)}ms  ${r.note}`
  );
}
const failed = results.filter((r) => !r.ok);
console.log(
  `${results.length - failed.length}/${results.length} sources refreshed` +
    (failed.length ? ` — FAILED: ${failed.map((f) => f.src).join(', ')}` : '')
);
process.exit(failed.length ? 1 : 0);
