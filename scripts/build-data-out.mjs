// build-data-out.mjs — R31+R33+R35: the take-it-with-you surface.
// Emits one tidy long-format CSV per dataset (public/data/csv/*.csv) and
// bundles JSONs + CSVs + the source registry + licenses into
// public/data/all.zip. Generated from the committed JSONs on every build, so
// refresh PRs ship fresh downloads with zero extra pipeline steps.
// Deterministic: same JSONs in, same bytes out (zip mtimes are pinned to the
// data's latest retrievedAt, not the build clock).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = new URL('..', import.meta.url);
const dataPath = (n) => fileURLToPath(new URL(`public/data/${n}`, root));
const read = (n) => JSON.parse(readFileSync(dataPath(`${n}.json`), 'utf8'));

mkdirSync(fileURLToPath(new URL('public/data/csv/', root)), { recursive: true });

/* ---------- CSV plumbing ---------- */
const esc = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) =>
  [header, ...rows].map((r) => r.map(esc).join(',')).join('\n') + '\n';

const isSupp = (v) => v && typeof v === 'object' && v.suppressed === true;

/* ---------- one tidy CSV per dataset ---------- */
const csvs = {};

{
  const d = read('qcew');
  const rows = [];
  for (const c of d.corridor) {
    for (const s of c.series) {
      rows.push([
        'corridor', c.name, c.fips, s.year,
        isSupp(s.semi) ? '' : s.semi, s.total,
        isSupp(s.semi) ? 'suppressed' : s.semi === 0 ? 'zero_no_employers' : '',
      ]);
    }
  }
  for (const c of d.comparators) {
    for (const m of c.months) {
      rows.push([
        'comparator', c.name, c.fips, m.ym,
        isSupp(m.emp) ? '' : m.emp, '',
        isSupp(m.emp) ? 'suppressed' : '',
      ]);
    }
  }
  csvs['qcew.csv'] = toCsv(
    ['group', 'county', 'fips', 'period', 'naics3344_employment', 'total_employment', 'flag'],
    rows
  );
}

{
  const d = read('oews');
  const rows = [];
  const areaRows = [['national', null], ['rochester', d.areas.rochester], ['syracuse', d.areas.syracuse]];
  for (const o of d.occupations) {
    for (const [area] of areaRows) {
      const cell = o[area];
      let median = '', emp = '', flag = '';
      if (!cell || cell.absent) flag = 'not_published';
      else {
        if (cell.topcoded) flag = 'topcoded';
        else if (isSupp(cell.median)) flag = 'suppressed';
        median = typeof cell.median === 'number' ? cell.median : '';
        emp = typeof cell.emp === 'number' ? cell.emp : '';
        if (!flag && median === '' && emp === '') flag = 'suppressed';
      }
      rows.push([o.soc, o.title, area, median, emp, flag]);
    }
  }
  csvs['oews.csv'] = toCsv(
    ['soc', 'occupation', 'area', 'annual_median_wage_usd', 'employment', 'flag'],
    rows
  );
}

{
  const d = read('ipeds');
  csvs['ipeds.csv'] = toCsv(
    ['survey_year', 'academic_year', 'institution', 'certificates', 'associate', 'bachelor', 'graduate'],
    d.series.map((s) => [
      s.year, `${s.year - 1}-${String(s.year).slice(2)}`, s.inst,
      s.cert || 0, s.assoc || 0, s.bach || 0, s.grad || 0,
    ])
  );
}

{
  const d = read('lodes');
  const rows = d.origins.map((o) => [o.name, o.state, o.fips, o.jobs, o.share]);
  rows.push(['All other counties', '', '', d.otherJobs, +(d.otherJobs / d.totalJobs).toFixed(4)]);
  csvs['lodes.csv'] = toCsv(
    ['home_county', 'home_state', 'home_fips', 'jobs_in_onondaga', 'share_of_onondaga_jobs'],
    rows
  );
}

{
  const d = read('spending');
  const rows = d.awards.map((a) => [
    a.kind || '', a.fain || '', a.recipient, a.agency || '',
    a.obligated ?? '', a.outlaid ?? '', '', a.profileUrl || '',
  ]);
  if (d.chipsNotPublished) {
    rows.push([
      'chips-direct', '', 'Micron Technology (Clay NY + Boise ID funding agreements)',
      'U.S. Department of Commerce / NIST', '', '',
      'not_published_on_usaspending', '',
    ]);
  }
  csvs['spending.csv'] = toCsv(
    ['kind', 'fain', 'recipient', 'agency', 'obligated_usd', 'outlaid_usd', 'flag', 'profile_url'],
    rows
  );
}

{
  const d = read('permits');
  const rows = [];
  for (const c of d.counties) for (const s of c.series) rows.push([c.name, c.fips, s.year, s.units]);
  csvs['permits.csv'] = toCsv(['county', 'fips', 'year', 'units_permitted'], rows);
}

{
  const d = read('acs');
  const rows = [];
  for (const c of d.counties) {
    for (const m of ['pop25', 'lessHS', 'hs', 'someCollege', 'baPlus']) {
      rows.push([c.name, c.fips, m, c[m]]);
    }
  }
  csvs['acs.csv'] = toCsv(['county', 'fips', 'measure', 'population_25plus'], rows);
}

{
  const d = read('nyiso');
  csvs['nyiso.csv'] = toCsv(
    ['zone', 'year', 'avg_mw', 'peak_mw', 'hours', 'partial'],
    d.annual.map((a) => [d.zone, a.year, a.avgMW, a.peakMW, a.hours, a.partial ? 'true' : ''])
  );
}

for (const [name, text] of Object.entries(csvs)) {
  writeFileSync(dataPath(`csv/${name}`), text);
}

/* ---------- all.zip (R33) ---------- */
const DATASETS = ['qcew', 'oews', 'ipeds', 'lodes', 'spending', 'permits', 'acs', 'nyiso', 'sources', 'archives'];
const enc = (s) => new TextEncoder().encode(s);
const files = {};
for (const n of DATASETS) files[`data/${n}.json`] = readFileSync(dataPath(`${n}.json`));
for (const [name, text] of Object.entries(csvs)) files[`csv/${name}`] = enc(text);
files['LICENSE-CONTENT.md'] = readFileSync(fileURLToPath(new URL('LICENSE-CONTENT.md', root)));
files['terms-ledger.md'] = readFileSync(fileURLToPath(new URL('docs/terms-ledger.md', root)));
files['data-contract.md'] = readFileSync(fileURLToPath(new URL('docs/data-contract.md', root)));

// pin zip mtimes to the data's latest retrievedAt → deterministic output
const latest = DATASETS.filter((n) => n !== 'sources' && n !== 'archives')
  .map((n) => read(n).provenance.retrievedAt)
  .sort()
  .pop();
const mtime = new Date(`${latest}T00:00:00Z`);
const zipped = zipSync(
  Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { mtime }]])),
  { level: 9, mtime }
);
writeFileSync(dataPath('all.zip'), zipped);

console.log(
  `data-out written: ${Object.keys(csvs).length} CSVs + all.zip (${(zipped.length / 1024).toFixed(1)} KB, mtime ${latest})`
);
