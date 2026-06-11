// fetch-nyiso.mjs — NYISO public MIS integrated real-time actual load → public/data/nyiso.json
//
// Source: monthly zip archives (no API key) at
//   http://mis.nyiso.com/public/csv/palIntegrated/{yyyymm}01palIntegrated_csv.zip
// Each zip holds one CSV per day ({yyyymmdd}palIntegrated.csv) with columns
//   "Time Stamp","Time Zone","Name","PTID","Integrated Load"
// (header verified in code). We aggregate zone CENTRL (Central NY) per calendar
// year: average + peak integrated hourly load (MW) and hours observed.
//
// Zips are cached in raw/nyiso/ (gitignored). Run: node scripts/fetch-nyiso.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { RETRIEVED_AT, SCHEMA_VERSION, TERMS } from './lib/run-meta.mjs';

const BASE = 'http://mis.nyiso.com/public/csv/palIntegrated';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIRST_YEAR = 2021;
const DELAY_MS = 150;
const ZONE = 'CENTRL';

const rawDir = fileURLToPath(new URL('../raw/nyiso/', import.meta.url));
mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let madeNetworkRequest = false;

/** Fetch one monthly zip (with raw/ cache). Returns Buffer, or null on 404 if allow404.
 *  P43: monthly archives are immutable, and the probe origin is calendar-
 *  derived (always the newest possible complete month), so cache-if-present
 *  is correct; NO_CACHE=1 forces refetch. */
async function fetchMonthZip(yyyymm, { allow404 = false } = {}) {
  const fileName = `${yyyymm}01palIntegrated_csv.zip`;
  const cachePath = `${rawDir}${fileName}`;
  if (process.env.OFFLINE === '1') {
    if (existsSync(cachePath)) return readFileSync(cachePath);
    if (allow404) return null;
    throw new Error(`OFFLINE: no cache for ${fileName}`);
  }
  if (existsSync(cachePath) && !process.env.NO_CACHE) return readFileSync(cachePath);

  if (madeNetworkRequest) await sleep(DELAY_MS); // be polite between live requests
  madeNetworkRequest = true;

  const url = `${BASE}/${fileName}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 404 && allow404) return null;
  if (!res.ok) throw new Error(`NYISO fetch failed: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(`Response from ${url} is not a zip (first bytes: ${buf.subarray(0, 4).toString('hex')})`);
  }
  writeFileSync(cachePath, buf);
  console.log(`  fetched ${fileName} (${(buf.length / 1024).toFixed(0)} KB)`);
  return buf;
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

const REQUIRED_COLS = ['Time Stamp', 'Time Zone', 'Name', 'PTID', 'Integrated Load'];

// ---------------------------------------------------------------------------
// Determine month range: 2021-01 through the latest complete month.
// (Probe backwards up to 3 months in case the newest archive isn't posted yet.)
// ---------------------------------------------------------------------------
const now = new Date();
let probeY = now.getUTCFullYear();
let probeM = now.getUTCMonth(); // 1-based month of the PREVIOUS month after the decrement below
if (probeM === 0) { probeY -= 1; probeM = 12; }

let latest = null;
for (let i = 0; i < 3; i++) {
  const yyyymm = `${probeY}${String(probeM).padStart(2, '0')}`;
  if ((await fetchMonthZip(yyyymm, { allow404: true })) !== null) { latest = { y: probeY, m: probeM }; break; }
  console.log(`  ${yyyymm} archive not posted yet, stepping back a month`);
  probeM -= 1;
  if (probeM === 0) { probeY -= 1; probeM = 12; }
}
if (latest === null) throw new Error('No NYISO palIntegrated monthly archive found in the last 3 months — path pattern may have changed');
if (latest.y < FIRST_YEAR) throw new Error(`Latest available month ${latest.y}-${latest.m} predates ${FIRST_YEAR}`);
console.log(`Month range: ${FIRST_YEAR}-01 through ${latest.y}-${String(latest.m).padStart(2, '0')}`);

const months = [];
for (let y = FIRST_YEAR; y <= latest.y; y++) {
  const lastM = y === latest.y ? latest.m : 12;
  for (let m = 1; m <= lastM; m++) months.push({ y, m });
}

// ---------------------------------------------------------------------------
// Read every monthly zip; accumulate CENTRL hourly integrated load per year.
// ---------------------------------------------------------------------------
const byYear = new Map(); // year -> { sum, hours, peak }
const distinctNames = new Set();
let missingValues = 0;

for (const { y, m } of months) {
  const yyyymm = `${y}${String(m).padStart(2, '0')}`;
  const buf = await fetchMonthZip(yyyymm);
  const zip = new AdmZip(buf);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (entries.length === 0) throw new Error(`Zip for ${yyyymm} contains no files`);

  for (const entry of entries) {
    const nameMatch = /^(\d{8})palIntegrated\.csv$/.exec(entry.entryName);
    if (!nameMatch) throw new Error(`Unexpected entry "${entry.entryName}" in zip for ${yyyymm}`);
    if (!nameMatch[1].startsWith(yyyymm)) {
      throw new Error(`Entry "${entry.entryName}" does not belong to month ${yyyymm}`);
    }

    const ctx = `${entry.entryName} (archive ${yyyymm})`;
    const text = zip.readAsText(entry);
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) throw new Error(`CSV ${ctx} has no data rows`);

    const header = parseLine(lines[0]);
    const idx = new Map(header.map((h, i) => [h, i]));
    for (const col of REQUIRED_COLS) {
      if (!idx.has(col)) throw new Error(`Column "${col}" missing in ${ctx}. Header was: ${header.join(', ')}`);
    }
    const tsI = idx.get('Time Stamp');
    const nameI = idx.get('Name');
    const loadI = idx.get('Integrated Load');

    let zoneRows = 0;
    for (const line of lines.slice(1)) {
      const cells = parseLine(line);
      distinctNames.add(cells[nameI]);
      if (cells[nameI] !== ZONE) continue;
      zoneRows++;

      const ts = cells[tsI];
      const tsMatch = /^(\d{2})\/(\d{2})\/(\d{4}) \d{2}:\d{2}:\d{2}$/.exec(ts);
      if (!tsMatch) throw new Error(`Unparseable Time Stamp "${ts}" in ${ctx}`);
      const year = Number(tsMatch[3]);
      if (year !== y) throw new Error(`Time Stamp "${ts}" in ${ctx} is outside year ${y}`);

      const rawLoad = cells[loadI];
      if (rawLoad === undefined || rawLoad.trim() === '') { missingValues++; continue; } // missing telemetry: skip, never fabricate
      const mw = Number(rawLoad);
      if (!Number.isFinite(mw)) throw new Error(`Non-numeric Integrated Load "${rawLoad}" in ${ctx}`);
      if (mw <= 0 || mw > 10_000) throw new Error(`Implausible CENTRL integrated load ${mw} MW in ${ctx}`);

      let acc = byYear.get(year);
      if (!acc) { acc = { sum: 0, hours: 0, peak: -Infinity }; byYear.set(year, acc); }
      acc.sum += mw;
      acc.hours += 1;
      if (mw > acc.peak) acc.peak = mw;
    }
    if (zoneRows === 0) throw new Error(`Zone ${ZONE} absent from ${ctx}`);
  }
}

// ---------------------------------------------------------------------------
// Assert zone names and assemble annual series.
// ---------------------------------------------------------------------------
const namesList = [...distinctNames].sort();
console.log(`Distinct zone names: ${namesList.join(' | ')}`);
if (!distinctNames.has(ZONE)) {
  throw new Error(`Zone "${ZONE}" not found among Name values: ${namesList.join(', ')}`);
}
if (distinctNames.size !== 11) {
  throw new Error(`Expected 11 NYISO load zones, found ${distinctNames.size}: ${namesList.join(', ')}`);
}

const round1 = (x) => Math.round(x * 10) / 10;
const annual = [];
for (let year = FIRST_YEAR; year <= latest.y; year++) {
  const acc = byYear.get(year);
  if (!acc || acc.hours === 0) throw new Error(`No ${ZONE} observations accumulated for ${year}`);
  const partial = year === latest.y && latest.m < 12;
  const avgMW = round1(acc.sum / acc.hours);
  const peakMW = round1(acc.peak);

  // Hours sanity: complete years ≈ 8760 (8784 leap); partial years ≈ 730/month.
  const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const expected = partial ? latest.m * 730 : isLeap ? 8784 : 8760;
  if (Math.abs(acc.hours - expected) > expected * 0.02) {
    throw new Error(`${year}: observed ${acc.hours} ${ZONE} hours, expected ~${expected}`);
  }

  // Load sanity: Central NY averages on the order of 1,500–2,500 MW.
  if (avgMW < 500 || avgMW > 6000) {
    throw new Error(`Sanity check failed: ${year} CENTRL average load ${avgMW} MW outside 500-6,000 MW`);
  }
  if (peakMW < avgMW || peakMW > 10_000) {
    throw new Error(`Sanity check failed: ${year} CENTRL peak load ${peakMW} MW vs average ${avgMW} MW`);
  }

  const rec = { year, avgMW, peakMW, hours: acc.hours };
  if (partial) rec.partial = true;
  annual.push(rec);
}
if (missingValues > 0) console.log(`  ${missingValues} rows had an empty Integrated Load and were skipped`);

// ---------------------------------------------------------------------------
// Emit.
// ---------------------------------------------------------------------------
const lastMonthLabel = `${latest.y}-${String(latest.m).padStart(2, '0')}`;
const out = {
  schemaVersion: SCHEMA_VERSION,
  provenance: {
    source: 'NYISO public MIS — Integrated Real-Time Actual Load (palIntegrated), hourly by zone',
    url: `${BASE}/{yyyymm}01palIntegrated_csv.zip`,
    retrievedAt: RETRIEVED_AT,
    vintage: `hourly integrated load 2021-01 through ${lastMonthLabel}`,
    notes:
      'avgMW = mean of hourly "Integrated Load" (MW) for zone CENTRL per calendar year; peakMW = max hourly value; ' +
      'hours = hourly observations counted (DST days have 23/25). partial:true marks the in-progress final year. ' +
      'Timestamps are NYISO local time (EST/EDT).',
    ...TERMS.nyiso,
  },
  zone: 'CENTRL (Central NY)',
  annual,
};

const json = JSON.stringify(out);
const outPath = fileURLToPath(new URL('../public/data/nyiso.json', import.meta.url));
writeFileSync(outPath, json);
const kb = Buffer.byteLength(json) / 1024;
if (kb > 3) throw new Error(`nyiso.json is ${kb.toFixed(1)} KB — exceeds the 3KB budget`);

console.log(`nyiso.json written: ${kb.toFixed(2)} KB`);
for (const a of annual) {
  console.log(`  ${a.year}: avg ${a.avgMW} MW, peak ${a.peakMW} MW, ${a.hours} h${a.partial ? ' (partial)' : ''}`);
}
