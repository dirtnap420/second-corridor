// fetch-lodes.mjs — Census LEHD LODES8 origin-destination → public/data/lodes.json
//
// Where do the people who hold jobs in Onondaga County (36067) live?
// Streams ny_od_main_JT00_{year}.csv.gz (live & work in NY) and
// ny_od_aux_JT00_{year}.csv.gz (work in NY, live outside NY), filters to
// workplace blocks w_geocode startsWith '36067', and aggregates S000 (total
// jobs, all job types JT00) by home county = first 5 digits of h_geocode.
//
// Per LODESTechDoc8: OD files have columns
//   w_geocode, h_geocode, S000, SA01..SA03, SE01..SE03, SI01..SI03, createdate
// "main" = residence in-state, "aux" = residence out-of-state. LODES OD data
// are noise-infused, not cell-suppressed, so no {suppressed:true} cells arise.
//
// Raw .gz files cached in raw/lodes/ (gitignored) and reused on re-run.
// Run: node scripts/fetch-lodes.mjs

import {
  createReadStream, createWriteStream, mkdirSync, existsSync,
  readdirSync, readFileSync, writeFileSync, renameSync, rmSync,
} from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { RETRIEVED_AT, SCHEMA_VERSION } from './lib/run-meta.mjs';

const LODES_BASE = 'https://lehd.ces.census.gov/data/lodes/LODES8/ny/od';
const COUNTY_CODES_URL = 'https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DELAY_MS = 150;

const WORK_COUNTY = '36067'; // Onondaga County, NY (workplace filter)
const TOP_N = 30;
const CORRIDOR_FIPS = ['36037', '36055', '36067', '36065', '36001', '36093', '36091'];
const PROBE_FROM = new Date().getUTCFullYear(); // descend until a year exists
const PROBE_TO = 2015;

const rawDir = fileURLToPath(new URL('../raw/lodes/', import.meta.url));
mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let madeNetworkRequest = false;
async function politeDelay() {
  if (madeNetworkRequest) await sleep(DELAY_MS);
  madeNetworkRequest = true;
}

const mainName = (y) => `ny_od_main_JT00_${y}.csv.gz`;
const auxName = (y) => `ny_od_aux_JT00_${y}.csv.gz`;

/** HEAD-probe a URL; true if 200, false if 404, throw otherwise. */
async function headOk(url) {
  await politeDelay();
  const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`HEAD ${url} failed: HTTP ${res.status}`);
  return true;
}

/** Stream-download url → dest (atomic via .part rename). No-op if cached.
 *  P43: a published LODES year is immutable; NO_CACHE=1 forces a refetch. */
async function download(url, dest) {
  if (existsSync(dest) && !process.env.NO_CACHE) {
    console.log(`  cache hit: ${dest.split(/[\\/]/).pop()}`);
    return;
  }
  await politeDelay();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  if (!res.body) throw new Error(`Empty response body for ${url}`);
  const tmp = `${dest}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
    renameSync(tmp, dest);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  console.log(`  downloaded ${url.split('/').pop()}`);
}

// ---------------------------------------------------------------------------
// 1. Determine the latest LODES year. P43: always probe — the old
// reuse-cached-pair shortcut meant a newly published year was never noticed.
// HEAD probes are cheap; the per-file cache below still avoids re-downloads.
// Falls back to the newest cached pair only if probing fails outright.
// ---------------------------------------------------------------------------
let year = null;
try {
  for (let y = PROBE_FROM; y >= PROBE_TO; y--) {
    if (await headOk(`${LODES_BASE}/${mainName(y)}`)) {
      if (!(await headOk(`${LODES_BASE}/${auxName(y)}`))) {
        throw new Error(`LODES8 ny od: main exists for ${y} but aux is missing — refusing a partial year`);
      }
      year = y;
      break;
    }
  }
  if (year === null) throw new Error(`No LODES8 ny_od_main_JT00 file found for any year ${PROBE_TO}-${PROBE_FROM}`);
  console.log(`Latest LODES year available: ${year}`);
} catch (probeErr) {
  const cachedYears = readdirSync(rawDir)
    .map((f) => f.match(/^ny_od_main_JT00_(\d{4})\.csv\.gz$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .filter((y) => existsSync(`${rawDir}${auxName(y)}`));
  if (cachedYears.length === 0) throw probeErr;
  year = Math.max(...cachedYears);
  console.log(`Probe failed (${probeErr.message}); falling back to cached LODES year ${year}`);
}

const mainPath = `${rawDir}${mainName(year)}`;
const auxPath = `${rawDir}${auxName(year)}`;
await download(`${LODES_BASE}/${mainName(year)}`, mainPath);
await download(`${LODES_BASE}/${auxName(year)}`, auxPath);

// ---------------------------------------------------------------------------
// 2. Stream-decompress + parse line-by-line; aggregate S000 by home county.
// ---------------------------------------------------------------------------
const byHomeCounty = new Map(); // h_geocode[0..5) -> total jobs

/**
 * Stream one OD .csv.gz. homeInNY: true → every h_geocode must start '36'
 * (main file), false → none may (aux file). Verifies header columns by name.
 */
async function aggregateFile(path, { homeInNY }) {
  const label = path.split(/[\\/]/).pop();
  const rl = createInterface({
    input: createReadStream(path).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let isHeader = true;
  let iW, iH, iS;
  let rows = 0;
  let matched = 0;
  let jobs = 0;
  for await (const line of rl) {
    if (line === '') continue;
    if (isHeader) {
      isHeader = false;
      const header = line.trim().split(',');
      iW = header.indexOf('w_geocode');
      iH = header.indexOf('h_geocode');
      iS = header.indexOf('S000');
      if (iW === -1 || iH === -1 || iS === -1) {
        throw new Error(`${label}: expected columns w_geocode, h_geocode, S000 — header was: ${line}`);
      }
      if (iW !== 0 || iH !== 1) {
        // The fast-path prefix filter below assumes w,h are the first two columns.
        throw new Error(`${label}: w_geocode/h_geocode not at columns 0/1 (got ${iW}/${iH}) — header was: ${line}`);
      }
      continue;
    }
    rows++;
    // Cheap semantic check on every row: home-state prefix (2nd column).
    const c1 = line.indexOf(',');
    const hPrefix = line.slice(c1 + 1, c1 + 3);
    if (homeInNY ? hPrefix !== '36' : hPrefix === '36') {
      throw new Error(
        `${label} row ${rows}: h_geocode starts '${hPrefix}' — violates ${homeInNY ? 'main (live in NY)' : 'aux (live outside NY)'} semantics: ${line}`,
      );
    }
    // Workplace filter: w_geocode is column 0, so a string prefix test suffices.
    if (!line.startsWith(WORK_COUNTY)) continue;

    const cells = line.split(',');
    const w = cells[iW];
    const h = cells[iH];
    if (!/^\d{15}$/.test(w) || !/^\d{15}$/.test(h)) {
      throw new Error(`${label} row ${rows}: malformed geocode (w='${w}', h='${h}')`);
    }
    const s000 = Number(cells[iS]);
    if (!Number.isInteger(s000) || s000 <= 0) {
      throw new Error(`${label} row ${rows}: S000='${cells[iS]}' is not a positive integer`);
    }
    const homeCounty = h.slice(0, 5);
    byHomeCounty.set(homeCounty, (byHomeCounty.get(homeCounty) ?? 0) + s000);
    matched++;
    jobs += s000;
  }
  if (rows === 0) throw new Error(`${label}: no data rows`);
  if (matched === 0) throw new Error(`${label}: no rows with w_geocode in ${WORK_COUNTY}`);
  console.log(`  ${label}: ${rows.toLocaleString()} rows, ${matched.toLocaleString()} matched, ${jobs.toLocaleString()} jobs`);
}

console.log('Aggregating OD pairs (streaming)...');
await aggregateFile(mainPath, { homeInNY: true });
await aggregateFile(auxPath, { homeInNY: false });

// ---------------------------------------------------------------------------
// 3. County FIPS → name/state lookup (codes2020, pipe-delimited).
// ---------------------------------------------------------------------------
const countyCodesPath = `${rawDir}national_county2020.txt`;
await download(COUNTY_CODES_URL, countyCodesPath);
const countyLines = readFileSync(countyCodesPath, 'utf8').split(/\r?\n/).filter((l) => l.length > 0);
const expectedCols = ['STATE', 'STATEFP', 'COUNTYFP', 'COUNTYNS', 'COUNTYNAME', 'CLASSFP', 'FUNCSTAT'];
const ccHeader = countyLines[0].split('|');
for (const col of expectedCols) {
  if (!ccHeader.includes(col)) {
    throw new Error(`national_county2020.txt: column "${col}" missing — header was: ${countyLines[0]}`);
  }
}
const ix = Object.fromEntries(expectedCols.map((c) => [c, ccHeader.indexOf(c)]));
const countyByFips = new Map();
for (const lineText of countyLines.slice(1)) {
  const cells = lineText.split('|');
  const fips = cells[ix.STATEFP] + cells[ix.COUNTYFP];
  if (!/^\d{5}$/.test(fips)) throw new Error(`national_county2020.txt: bad FIPS '${fips}' in line: ${lineText}`);
  countyByFips.set(fips, {
    // Strip the bare " County" suffix; keep Parish/Borough/city/Census Area etc.
    name: cells[ix.COUNTYNAME].replace(/ County$/, ''),
    state: cells[ix.STATE],
  });
}
if (countyByFips.size < 3000) {
  throw new Error(`national_county2020.txt: only ${countyByFips.size} counties parsed — expected ~3200`);
}

// ---------------------------------------------------------------------------
// 4. Rank, name, sanity-check, emit.
// ---------------------------------------------------------------------------
const ranked = [...byHomeCounty.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const totalJobs = ranked.reduce((sum, [, jobs]) => sum + jobs, 0);

if (totalJobs < 200_000 || totalJobs > 280_000) {
  throw new Error(`Sanity check failed: total jobs in Onondaga workplace = ${totalJobs} (expected ~200k-280k)`);
}
if (ranked[0][0] !== WORK_COUNTY) {
  throw new Error(`Sanity check failed: #1 origin county is ${ranked[0][0]} (${ranked[0][1]} jobs), expected Onondaga ${WORK_COUNTY}`);
}

const round4 = (x) => Math.round(x * 10_000) / 10_000;
const origins = ranked.slice(0, TOP_N).map(([fips, jobs]) => {
  const county = countyByFips.get(fips);
  if (!county) throw new Error(`County FIPS ${fips} (${jobs} jobs) not found in national_county2020.txt`);
  return { fips, name: county.name, state: county.state, jobs, share: round4(jobs / totalJobs) };
});
const otherJobs = totalJobs - origins.reduce((sum, o) => sum + o.jobs, 0);
if (otherJobs < 0) throw new Error(`otherJobs is negative (${otherJobs}) — aggregation bug`);

const corridorJobs = CORRIDOR_FIPS.reduce((sum, fips) => sum + (byHomeCounty.get(fips) ?? 0), 0);
for (const fips of CORRIDOR_FIPS) {
  if (!byHomeCounty.has(fips)) {
    throw new Error(`Corridor county ${fips} has zero OD flows into Onondaga — implausible, refusing to emit`);
  }
}
const corridorShare = round4(corridorJobs / totalJobs);
if (corridorShare <= origins[0].share || corridorShare > 1) {
  throw new Error(`Sanity check failed: corridorShare ${corridorShare} should exceed Onondaga's own share and be ≤ 1`);
}

const out = {
  schemaVersion: SCHEMA_VERSION,
  provenance: {
    source: 'U.S. Census Bureau, LEHD Origin-Destination Employment Statistics (LODES8), OD main + aux, JT00 all jobs',
    url: `${LODES_BASE}/{ny_od_main_JT00_${year}.csv.gz, ny_od_aux_JT00_${year}.csv.gz}`,
    retrievedAt: RETRIEVED_AT,
    vintage: `LODES8 OD reference year ${year}`,
    notes:
      `Jobs at workplace blocks in Onondaga County NY (w_geocode prefix ${WORK_COUNTY}), S000 total jobs, ` +
      'summed by home county (first 5 digits of h_geocode); main = residents of NY, aux = residents of other states. ' +
      'LODES OD counts are noise-infused by Census, not cell-suppressed. ' +
      'County names from codes2020/national_county2020.txt with the bare " County" suffix stripped. ' +
      `corridorShare = combined share of home counties ${CORRIDOR_FIPS.join(', ')}.`,
  },
  workCounty: WORK_COUNTY,
  totalJobs,
  origins,
  otherJobs,
  corridorShare,
};

const json = JSON.stringify(out);
const outPath = fileURLToPath(new URL('../public/data/lodes.json', import.meta.url));
mkdirSync(fileURLToPath(new URL('../public/data/', import.meta.url)), { recursive: true });
writeFileSync(outPath, json);
const kb = Buffer.byteLength(json) / 1024;
if (kb > 8) throw new Error(`lodes.json is ${kb.toFixed(1)} KB — exceeds the 8KB budget`);

console.log(`lodes.json written: ${kb.toFixed(2)} KB`);
console.log(`  vintage: LODES8 OD ${year}; totalJobs ${totalJobs.toLocaleString()}; ${byHomeCounty.size} origin counties`);
console.log(`  #1 origin: ${origins[0].name}, ${origins[0].state} (${origins[0].jobs.toLocaleString()} jobs, ${(origins[0].share * 100).toFixed(1)}%)`);
console.log(`  corridorShare: ${(corridorShare * 100).toFixed(1)}%; otherJobs beyond top ${TOP_N}: ${otherJobs.toLocaleString()}`);
