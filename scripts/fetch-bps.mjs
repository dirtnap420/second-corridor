// fetch-bps.mjs — Census Building Permits Survey annual county files → public/data/permits.json
//
// Total housing units permitted per county-year for six Central/Western NY
// counties, 2015 → latest annual file on the server. Units = sum of the
// 1-unit, 2-unit, 3-4 unit, and 5+ unit "Units" columns from the first four
// column groups, which are the reported-PLUS-imputed totals (the trailing
// "rep" groups are reported-only and are NOT used).
//
// The flat files have two header rows (group labels + field names); the
// script combines them and verifies every expected column by name before
// reading any data. County FIPS codes are cross-checked against the county
// name column in the file itself.
//
// Raw files are cached in raw/bps/ (one ~2.5MB file per year) and reused on
// re-run. Run: node scripts/fetch-bps.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RETRIEVED_AT, SCHEMA_VERSION, TERMS } from './lib/run-meta.mjs';

const BASE_URL = 'https://www2.census.gov/econ/bps/County';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIRST_YEAR = 2015;
const DELAY_MS = 150;

// fips → expected county name as it appears in the file's County Name column.
const COUNTIES = [
  { fips: '36067', name: 'Onondaga' },
  { fips: '36075', name: 'Oswego' },
  { fips: '36053', name: 'Madison' },
  { fips: '36011', name: 'Cayuga' },
  { fips: '36023', name: 'Cortland' },
  { fips: '36055', name: 'Monroe' },
];

const rawDir = fileURLToPath(new URL('../raw/bps/', import.meta.url));
mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let madeNetworkRequest = false;

/** Fetch one annual county file (with raw/ cache). Returns text, or null on 404 if allow404.
 *  P43: completed years cache permanently; the latest year passes fresh:true
 *  (Census revises it). NO_CACHE=1 bypasses all reads. */
const freshThisRun = new Set(); // files already (re)fetched live in this run
async function fetchAnnual(year, { allow404 = false, fresh = false } = {}) {
  const cachePath = `${rawDir}co${year}a.txt`;
  if (process.env.OFFLINE === '1') {
    if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');
    if (allow404) return null;
    throw new Error(`OFFLINE: no cache for co${year}a.txt`);
  }
  if (
    existsSync(cachePath) &&
    (freshThisRun.has(cachePath) || (!fresh && !process.env.NO_CACHE))
  )
    return readFileSync(cachePath, 'utf8');

  if (madeNetworkRequest) await sleep(DELAY_MS); // be polite between live requests
  madeNetworkRequest = true;

  const url = `${BASE_URL}/co${year}a.txt`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain,*/*' },
  });
  if (res.status === 404 && allow404) return null;
  if (!res.ok) throw new Error(`BPS fetch failed: HTTP ${res.status} for ${url}`);
  const text = await res.text();
  if (!text.startsWith('Survey,')) {
    throw new Error(`Unexpected response body (not a BPS flat file) from ${url}: ${text.slice(0, 120)}`);
  }
  writeFileSync(cachePath, text);
  freshThisRun.add(cachePath);
  console.log(`  fetched co${year}a.txt (${(text.length / 1024).toFixed(0)} KB)`);
  return text;
}

/**
 * Parse one annual file. The first two lines are header rows:
 *   row 1: group labels (Survey, FIPS, ..., 1-unit, , , 2-units, , , ...)
 *   row 2: field names  (Date, State, County, ..., Bldgs, Units, Value, ...)
 * Combine them to locate the Units column of each unit-class group by NAME,
 * throwing if the layout differs from what we verified.
 * Returns { unitCols: number[], rows: string[][] }.
 */
function parseAnnualFile(text, year) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 4) throw new Error(`co${year}a.txt: file too short (${lines.length} lines)`);
  const h1 = lines[0].split(',').map((s) => s.trim());
  const h2 = lines[1].split(',').map((s) => s.trim());

  // Identifier columns: combined "row1 row2" names must match exactly.
  const ID_EXPECT = ['Survey Date', 'FIPS State', 'FIPS County', 'Region Code', 'Division Code', 'County Name'];
  for (let i = 0; i < ID_EXPECT.length; i++) {
    const got = `${h1[i]} ${h2[i]}`;
    if (got !== ID_EXPECT[i]) {
      throw new Error(`co${year}a.txt: header column ${i} is "${got}", expected "${ID_EXPECT[i]}"`);
    }
  }

  // Unit-class groups: each group label sits in row 1 above that group's
  // "Units" field in row 2. Find each label and verify alignment. The first
  // four groups are reported+imputed totals; the "* rep" groups (reported
  // only) exist in the layout but are intentionally not summed.
  const GROUPS = ['1-unit', '2-units', '3-4 units', '5+ units'];
  const REP_GROUPS = ['1-unit rep', '2-units rep', '3-4 units rep', '5+units rep'];
  const findUnitsCol = (label) => {
    const hits = h1.map((v, i) => (v === label ? i : -1)).filter((i) => i >= 0);
    if (hits.length !== 1) {
      throw new Error(`co${year}a.txt: expected exactly 1 header group "${label}", found ${hits.length}. Row 1: ${h1.join('|')}`);
    }
    const col = hits[0];
    if (h2[col] !== 'Units') {
      throw new Error(`co${year}a.txt: group "${label}" sits above field "${h2[col]}", expected "Units"`);
    }
    return col;
  };
  const unitCols = GROUPS.map(findUnitsCol);
  for (const rep of REP_GROUPS) findUnitsCol(rep); // verify layout, value unused

  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; // blank separator line after headers
    rows.push(lines[i].split(','));
  }
  if (rows.length < 1000) throw new Error(`co${year}a.txt: only ${rows.length} data rows — expected ~3000 counties`);
  return { unitCols, rows };
}

function toCount(value, field, context) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Bad ${field}="${value}" in ${context} — expected a non-negative integer`);
  return n;
}

// ---------------------------------------------------------------------------
// Determine the latest annual file available (descending from current year).
// ---------------------------------------------------------------------------
const nowYear = new Date().getUTCFullYear();
let latestYear = null;
for (let y = nowYear; y >= FIRST_YEAR; y--) {
  if ((await fetchAnnual(y, { allow404: true, fresh: true })) !== null) { latestYear = y; break; }
}
if (latestYear === null) throw new Error(`No BPS annual county file found for any year ${FIRST_YEAR}-${nowYear}`);
console.log(`Latest annual file: co${latestYear}a.txt`);

// ---------------------------------------------------------------------------
// Extract units per county-year.
// ---------------------------------------------------------------------------
const seriesByFips = new Map(COUNTIES.map((c) => [c.fips, []]));

for (let year = FIRST_YEAR; year <= latestYear; year++) {
  const text = await fetchAnnual(year, { fresh: year === latestYear });
  const { unitCols, rows } = parseAnnualFile(text, year);

  for (const { fips, name } of COUNTIES) {
    const st = fips.slice(0, 2);
    const co = fips.slice(2);
    const ctx = `co${year}a.txt fips ${fips} (${name})`;
    const hits = rows.filter((r) => r[1] === st && r[2] === co);
    if (hits.length !== 1) {
      throw new Error(`${ctx}: expected exactly 1 row, found ${hits.length}`);
    }
    const row = hits[0];

    // Verify FIPS against the county name column in the file itself.
    const fileName = row[5].trim();
    if (fileName !== `${name} County`) {
      throw new Error(`${ctx}: county name mismatch — file says "${fileName}", expected "${name} County"`);
    }
    if (row[0].trim() !== String(year)) {
      throw new Error(`${ctx}: Survey Date column is "${row[0]}", expected "${year}"`);
    }

    const units = unitCols.reduce((sum, col, gi) => sum + toCount(row[col], `units group ${gi}`, ctx), 0);
    seriesByFips.get(fips).push({ year, units });
  }
}

// ---------------------------------------------------------------------------
// Sanity checks.
// ---------------------------------------------------------------------------
const expectedYears = latestYear - FIRST_YEAR + 1;
for (const { fips, name } of COUNTIES) {
  const series = seriesByFips.get(fips);
  if (series.length !== expectedYears) {
    throw new Error(`County ${fips} (${name}) has ${series.length} years, expected ${expectedYears}`);
  }
}
const allValues = [...seriesByFips.values()].flat().map((p) => p.units);
if (allValues.every((v) => v === 0)) {
  throw new Error('Sanity check failed: every county-year has 0 units — parsing is broken');
}
const monroe = seriesByFips.get('36055');
const monroeMax = Math.max(...monroe.map((p) => p.units));
if (monroeMax < 1000 || monroeMax > 5000) {
  throw new Error(`Sanity check failed: Monroe County peak annual units = ${monroeMax}, expected on the order of 1000-3000`);
}

// ---------------------------------------------------------------------------
// Emit.
// ---------------------------------------------------------------------------
const vintage = `annual ${FIRST_YEAR}-${latestYear}`;
const out = {
  schemaVersion: SCHEMA_VERSION,
  provenance: {
    source: 'U.S. Census Bureau, Building Permits Survey, annual county flat files',
    url: `${BASE_URL}/co{yyyy}a.txt`,
    retrievedAt: RETRIEVED_AT,
    vintage,
    notes:
      'units = total housing units authorized by building permits per county-year: sum of the Units ' +
      'columns of the 1-unit, 2-unit, 3-4 unit, and 5+ unit groups. The first four column groups in ' +
      'these files are reported-plus-imputed totals and were used; the trailing "rep" groups ' +
      '(reported-only, no imputation for non-responding permit offices) were not. County FIPS codes ' +
      'were verified against the County Name column in each file. BPS county files publish no ' +
      'suppression flags, so no cells are suppressed.',
    ...TERMS.bps,
  },
  counties: COUNTIES.map(({ fips, name }) => ({ fips, name, series: seriesByFips.get(fips) })),
};

const json = JSON.stringify(out);
const outPath = fileURLToPath(new URL('../public/data/permits.json', import.meta.url));
writeFileSync(outPath, json);
const kb = Buffer.byteLength(json) / 1024;
if (kb > 6) throw new Error(`permits.json is ${kb.toFixed(1)} KB — exceeds the 6KB budget`);

console.log(`permits.json written: ${kb.toFixed(2)} KB`);
console.log(`  vintage: ${vintage} (${COUNTIES.length} counties x ${expectedYears} years)`);
for (const { fips, name } of COUNTIES) {
  const s = seriesByFips.get(fips);
  console.log(`  ${fips} ${name.padEnd(9)} ${s.map((p) => p.units).join(', ')}`);
}
