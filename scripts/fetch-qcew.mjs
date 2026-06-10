// fetch-qcew.mjs — BLS QCEW open data CSV API → public/data/qcew.json
//
// (A) Corridor annual: NAICS 3344 private (own_code 5) annual avg employment +
//     all-industry total covered employment (industry 10, own 0) for seven NY
//     counties, 2020 → latest year served.
// (B) Comparator quarterly: NAICS 3344 private monthly employment levels for
//     four out-of-state counties + Onondaga, 2020Q1 → latest quarter served.
//
// Disclosure: disclosure_code 'N' → { suppressed: true } (never 0).
// A county-industry row that is entirely absent from the file means QCEW has
// no covered establishments in that cell — a structural zero, recorded as 0.
//
// Raw CSVs are cached in raw/qcew/ (gitignored). Run: node scripts/fetch-qcew.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://data.bls.gov/cew/data/api';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIRST_YEAR = 2020;
const DELAY_MS = 150;

const CORRIDOR = [
  { fips: '36037', name: 'Genesee' },
  { fips: '36055', name: 'Monroe' },
  { fips: '36067', name: 'Onondaga' },
  { fips: '36065', name: 'Oneida' },
  { fips: '36001', name: 'Albany' },
  { fips: '36093', name: 'Schenectady' },
  { fips: '36091', name: 'Saratoga' },
];

const COMPARATORS = [
  { fips: '04013', name: 'Maricopa, AZ' },
  { fips: '39089', name: 'Licking, OH' },
  { fips: '16001', name: 'Ada, ID' },
  { fips: '48491', name: 'Williamson, TX' },
  { fips: '36067', name: 'Onondaga, NY' },
];

const rawDir = fileURLToPath(new URL('../raw/qcew/', import.meta.url));
mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let madeNetworkRequest = false;

/** Fetch one QCEW CSV (with raw/ cache). Returns text, or null on 404 if allow404. */
async function fetchCsv(year, qtr, fips, { allow404 = false } = {}) {
  const cachePath = `${rawDir}${year}-${qtr}-${fips}.csv`;
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');

  if (madeNetworkRequest) await sleep(DELAY_MS); // be polite between live requests
  madeNetworkRequest = true;

  const url = `${API_BASE}/${year}/${qtr}/area/${fips}.csv`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/csv,*/*' },
  });
  if (res.status === 404 && allow404) return null;
  if (!res.ok) throw new Error(`QCEW fetch failed: HTTP ${res.status} for ${url}`);
  const text = await res.text();
  if (!text.startsWith('"area_fips"')) {
    throw new Error(`Unexpected response body (not a QCEW CSV) from ${url}: ${text.slice(0, 120)}`);
  }
  writeFileSync(cachePath, text);
  console.log(`  fetched ${year}/${qtr}/${fips} (${(text.length / 1024).toFixed(0)} KB)`);
  return text;
}

/** Parse one CSV line, honoring double-quoted fields. */
function parseLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Parse a QCEW CSV into row objects, asserting required columns exist. */
function parseCsv(text, requiredCols, context) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseLine(lines[0]);
  const idx = new Map(header.map((h, i) => [h, i]));
  for (const col of requiredCols) {
    if (!idx.has(col)) {
      throw new Error(
        `Column "${col}" missing in ${context}. Header was: ${header.join(', ')}`,
      );
    }
  }
  return lines.slice(1).map((l) => {
    const cells = parseLine(l);
    const row = {};
    for (const col of requiredCols) row[col] = cells[idx.get(col)];
    return row;
  });
}

const BASE_COLS = ['area_fips', 'own_code', 'industry_code', 'agglvl_code', 'size_code', 'year', 'qtr', 'disclosure_code'];

/** Find the single county-level row matching own/industry; null if absent (structural zero). */
function findRow(rows, { own, industry, agglvl }, context) {
  const hits = rows.filter(
    (r) =>
      r.own_code === own &&
      r.industry_code === industry &&
      r.size_code === '0' &&
      (agglvl === undefined || r.agglvl_code === agglvl),
  );
  if (hits.length > 1) {
    throw new Error(`Expected at most 1 row for own=${own} industry=${industry} in ${context}, got ${hits.length}`);
  }
  return hits[0] ?? null;
}

function toInt(value, field, context) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error(`Non-integer ${field}="${value}" in ${context}`);
  return n;
}

function assertFips(rows, fips, context) {
  if (rows.length === 0) throw new Error(`Empty CSV body in ${context}`);
  if (!rows.every((r) => r.area_fips === fips)) {
    throw new Error(`area_fips mismatch in ${context}: expected all rows = ${fips}`);
  }
}

// ---------------------------------------------------------------------------
// Probe latest available periods (descending from the current year).
// ---------------------------------------------------------------------------
const nowYear = new Date().getUTCFullYear();
const probeFips = '36067';

let latestYear = null;
for (let y = nowYear; y >= FIRST_YEAR; y--) {
  if ((await fetchCsv(y, 'a', probeFips, { allow404: true })) !== null) { latestYear = y; break; }
}
if (latestYear === null) throw new Error(`No QCEW annual file found for any year ${FIRST_YEAR}-${nowYear}`);

let latestQ = null;
outer: for (let y = nowYear; y >= FIRST_YEAR; y--) {
  for (let q = 4; q >= 1; q--) {
    if ((await fetchCsv(y, q, probeFips, { allow404: true })) !== null) { latestQ = { y, q }; break outer; }
  }
}
if (latestQ === null) throw new Error(`No QCEW quarterly file found for any quarter ${FIRST_YEAR}Q1-${nowYear}Q4`);

console.log(`Latest annual year: ${latestYear}; latest quarter: ${latestQ.y}Q${latestQ.q}`);

// ---------------------------------------------------------------------------
// (A) Corridor annual series.
// ---------------------------------------------------------------------------
const ANNUAL_COLS = [...BASE_COLS, 'annual_avg_emplvl'];
const corridor = [];
for (const { fips, name } of CORRIDOR) {
  const series = [];
  for (let year = FIRST_YEAR; year <= latestYear; year++) {
    const ctx = `annual ${year} area ${fips}`;
    const text = await fetchCsv(year, 'a', fips);
    const rows = parseCsv(text, ANNUAL_COLS, ctx);
    assertFips(rows, fips, ctx);

    // All-industry total covered employment (denominator): own 0, industry 10, county total agg level 70.
    const totalRow = findRow(rows, { own: '0', industry: '10', agglvl: '70' }, ctx);
    if (!totalRow) throw new Error(`All-industry total row (own 0, industry 10) missing in ${ctx}`);
    if (totalRow.disclosure_code === 'N') throw new Error(`All-industry total unexpectedly suppressed in ${ctx}`);
    const total = toInt(totalRow.annual_avg_emplvl, 'annual_avg_emplvl', ctx);

    // NAICS 3344 private. Absent row = no covered establishments (structural zero).
    const semiRow = findRow(rows, { own: '5', industry: '3344' }, ctx);
    let semi;
    if (!semiRow) semi = 0;
    else if (semiRow.disclosure_code === 'N') semi = { suppressed: true };
    else semi = toInt(semiRow.annual_avg_emplvl, 'annual_avg_emplvl', ctx);

    series.push({ year, semi, total });
  }
  corridor.push({ fips, name, series });
}

// ---------------------------------------------------------------------------
// (B) Comparator quarterly monthly levels.
// ---------------------------------------------------------------------------
const QTR_COLS = [...BASE_COLS, 'month1_emplvl', 'month2_emplvl', 'month3_emplvl'];
const quarters = [];
for (let y = FIRST_YEAR; y <= latestQ.y; y++) {
  for (let q = 1; q <= 4; q++) {
    if (y === latestQ.y && q > latestQ.q) break;
    quarters.push({ y, q });
  }
}

const comparators = [];
for (const { fips, name } of COMPARATORS) {
  const months = [];
  for (const { y, q } of quarters) {
    const ctx = `quarterly ${y}Q${q} area ${fips}`;
    const text = await fetchCsv(y, q, fips);
    const rows = parseCsv(text, QTR_COLS, ctx);
    assertFips(rows, fips, ctx);

    const row = findRow(rows, { own: '5', industry: '3344' }, ctx);
    for (let m = 1; m <= 3; m++) {
      const ym = `${y}-${String((q - 1) * 3 + m).padStart(2, '0')}`;
      let emp;
      if (!row) emp = 0; // structural zero: no covered 3344 establishments that quarter
      else if (row.disclosure_code === 'N') emp = { suppressed: true };
      else emp = toInt(row[`month${m}_emplvl`], `month${m}_emplvl`, ctx);
      months.push({ ym, emp });
    }
  }
  comparators.push({ fips, name, months });
}

// ---------------------------------------------------------------------------
// Sanity checks — order-of-magnitude against known values.
// ---------------------------------------------------------------------------
const onondaga = corridor.find((c) => c.fips === '36067');
for (const pt of onondaga.series) {
  if (typeof pt.total !== 'number' || pt.total < 150_000 || pt.total > 350_000) {
    throw new Error(`Sanity check failed: Onondaga all-industry total ${pt.total} in ${pt.year} (expected ~200k)`);
  }
}
const maricopa = comparators.find((c) => c.fips === '04013');
const maricopaMax = Math.max(...maricopa.months.map((m) => (typeof m.emp === 'number' ? m.emp : 0)));
if (maricopaMax <= 10_000) {
  throw new Error(`Sanity check failed: Maricopa NAICS 3344 peak monthly employment ${maricopaMax} (expected >10k)`);
}
const expectedMonths = quarters.length * 3;
for (const c of comparators) {
  if (c.months.length !== expectedMonths) {
    throw new Error(`Comparator ${c.fips} has ${c.months.length} months, expected ${expectedMonths}`);
  }
}
for (const c of corridor) {
  if (c.series.length !== latestYear - FIRST_YEAR + 1) {
    throw new Error(`Corridor ${c.fips} has ${c.series.length} years, expected ${latestYear - FIRST_YEAR + 1}`);
  }
}

// ---------------------------------------------------------------------------
// Emit.
// ---------------------------------------------------------------------------
const vintage = `QCEW annual ${FIRST_YEAR}-${latestYear}; quarterly ${FIRST_YEAR}Q1-${latestQ.y}Q${latestQ.q}`;
const out = {
  provenance: {
    source: 'U.S. Bureau of Labor Statistics, Quarterly Census of Employment and Wages (QCEW), open data CSV API',
    url: `${API_BASE}/{year}/{qtr}/area/{fips}.csv`,
    retrievedAt: new Date().toISOString().slice(0, 10),
    vintage,
    notes:
      'semi = NAICS 3344 (semiconductor & other electronic component mfg), private ownership (own_code 5); ' +
      'total = all-industry total covered employment (industry 10, own_code 0, agglvl 70). ' +
      "Non-disclosable cells (disclosure_code 'N') are {suppressed:true}. " +
      'A county-industry row absent from the QCEW file means zero covered establishments and is recorded as 0.',
  },
  corridor,
  comparators,
};

const json = JSON.stringify(out);
const outPath = fileURLToPath(new URL('../public/data/qcew.json', import.meta.url));
writeFileSync(outPath, json);
const kb = Buffer.byteLength(json) / 1024;
if (kb > 45) throw new Error(`qcew.json is ${kb.toFixed(1)} KB — exceeds the 45KB budget`);

const suppressedAnnual = corridor.reduce(
  (n, c) => n + c.series.filter((p) => typeof p.semi === 'object').length, 0);
const suppressedMonths = comparators.reduce(
  (n, c) => n + c.months.filter((m) => typeof m.emp === 'object').length, 0);
console.log(`qcew.json written: ${kb.toFixed(1)} KB`);
console.log(`  vintage: ${vintage}`);
console.log(`  corridor: ${corridor.length} counties x ${latestYear - FIRST_YEAR + 1} years (${suppressedAnnual} suppressed semi cells)`);
console.log(`  comparators: ${comparators.length} counties x ${expectedMonths} months (${suppressedMonths} suppressed month cells)`);
