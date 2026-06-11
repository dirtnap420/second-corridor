// fetch-acs.mjs — Census ACS 5-year estimates (table B15003) → public/data/acs.json
//
// Educational attainment of the population 25+ for eleven NY corridor counties,
// latest available 5-year vintage (probes 2023, then 2022).
//
//   pop25       = B15003_001E (Total)
//   hs          = B15003_017E..018E (regular HS diploma + GED)
//   someCollege = B15003_019E..021E (some college <1yr, 1+yr no degree, associate's)
//   baPlus      = B15003_022E..025E (bachelor's, master's, professional, doctorate)
//   lessHS      = pop25 − (hs + someCollege + baPlus)
// lessHS is cross-checked against the sum of B15003_002E..016E (explicit <HS cells).
// Variable meanings are VERIFIED at runtime against the vintage's variables.json
// (that metadata endpoint remains keyless).
//
// Data access: as of 2025 the Census data API (api.census.gov/data/...) REQUIRES
// an API key — verified empirically: keyless requests return an HTML "Missing
// Key" page for both the 2023 and 2022 vintages. So:
//   - if process.env.CENSUS_API_KEY is set → query the data API (as specified);
//   - otherwise → fall back to the official, keyless ACS 5-Year Summary File
//     (table-based format) on www2.census.gov, streaming only the leading slice
//     of acsdt5y{year}-b15003.dat that contains the county rows (the file is
//     sorted by GEO_ID, so counties 0500000US* come before tracts/block groups).
//     County names are then verified against the Census county codes reference
//     file (st36_ny_cou2020.txt), since the .dat carries no NAME column.
//
// Output is raw counts (the UI computes shares). Missing/annotation sentinel
// estimates (empty, ".", or negative jam values) → { suppressed: true }, never 0.
//
// Raw downloads are cached in raw/acs/ (gitignored). Run: node scripts/fetch-acs.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RETRIEVED_AT, SCHEMA_VERSION, TERMS } from './lib/run-meta.mjs';

const API_BASE = 'https://api.census.gov/data';
const SF_BASE = 'https://www2.census.gov/programs-surveys/acs/summary_file';
const CODES_URL = 'https://www2.census.gov/geo/docs/reference/codes2020/cou/st36_ny_cou2020.txt';
const PROBE_YEARS = [2023, 2022];
const STATE = '36'; // New York
const NY_COUNTY_COUNT = 62;
const DELAY_MS = 150;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const COUNTIES = [
  { fips: '037', name: 'Genesee' },
  { fips: '055', name: 'Monroe' },
  { fips: '067', name: 'Onondaga' },
  { fips: '065', name: 'Oneida' },
  { fips: '001', name: 'Albany' },
  { fips: '093', name: 'Schenectady' },
  { fips: '091', name: 'Saratoga' },
  { fips: '075', name: 'Oswego' },
  { fips: '053', name: 'Madison' },
  { fips: '011', name: 'Cayuga' },
  { fips: '023', name: 'Cortland' },
];

// Expected final label segment (after the last "!!", trailing ":" stripped,
// lowercased) for every B15003 estimate variable we use, per Census variables.json.
const EXPECTED_LABELS = {
  B15003_001E: 'total',
  B15003_002E: 'no schooling completed',
  B15003_003E: 'nursery school',
  B15003_004E: 'kindergarten',
  B15003_005E: '1st grade',
  B15003_006E: '2nd grade',
  B15003_007E: '3rd grade',
  B15003_008E: '4th grade',
  B15003_009E: '5th grade',
  B15003_010E: '6th grade',
  B15003_011E: '7th grade',
  B15003_012E: '8th grade',
  B15003_013E: '9th grade',
  B15003_014E: '10th grade',
  B15003_015E: '11th grade',
  B15003_016E: '12th grade, no diploma',
  B15003_017E: 'regular high school diploma',
  B15003_018E: 'ged or alternative credential',
  B15003_019E: 'some college, less than 1 year',
  B15003_020E: 'some college, 1 or more years, no degree',
  B15003_021E: "associate's degree",
  B15003_022E: "bachelor's degree",
  B15003_023E: "master's degree",
  B15003_024E: 'professional school degree',
  B15003_025E: 'doctorate degree',
};
const VARS = Object.keys(EXPECTED_LABELS); // B15003_001E..025E in order

const padVar = (n) => `B15003_${String(n).padStart(3, '0')}E`;
const HS_VARS = [17, 18].map(padVar);
const SOME_COLLEGE_VARS = [19, 20, 21].map(padVar);
const BA_PLUS_VARS = [22, 23, 24, 25].map(padVar);
const LESS_HS_VARS = Array.from({ length: 15 }, (_, i) => padVar(i + 2)); // 002..016

const rawDir = fileURLToPath(new URL('../raw/acs/', import.meta.url));
mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let madeNetworkRequest = false;
async function politeDelay() {
  if (madeNetworkRequest) await sleep(DELAY_MS);
  madeNetworkRequest = true;
}

const SUPPRESSED = Symbol('suppressed');
const emit = (v) => (v === SUPPRESSED ? { suppressed: true } : v);

/** Parse one estimate string: integer count, or SUPPRESSED for sentinels. */
function parseEstimate(v, code, context) {
  if (v === null || v === undefined || v === '' || v === '.') return SUPPRESSED;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`Non-integer ${code}="${v}" in ${context}`);
  if (n < 0) return SUPPRESSED; // Census annotation jam value (e.g. -666666666)
  return n;
}

/** Sum a group of canonical-code cells; SUPPRESSED if any member is suppressed. */
function sumGroup(values, codes) {
  let sum = 0;
  for (const code of codes) {
    const v = values[code];
    if (v === SUPPRESSED) return SUPPRESSED;
    sum += v;
  }
  return sum;
}

/** Fetch text with raw/ cache. Returns text, or null on 404 if allow404. */
async function fetchText(url, cacheName, { allow404 = false } = {}) {
  const cachePath = `${rawDir}${cacheName}`;
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');
  await politeDelay();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 404 && allow404) return null;
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status} for ${url}`);
  const text = await res.text();
  writeFileSync(cachePath, text);
  console.log(`  fetched ${url} (${(text.length / 1024).toFixed(0)} KB)`);
  return text;
}

// ---------------------------------------------------------------------------
// Path A — Census data API (requires CENSUS_API_KEY since 2025).
// Returns { year, rows: Map<countyFips, {values, name}> } or throws.
// ---------------------------------------------------------------------------
async function loadFromApi(key) {
  for (const year of PROBE_YEARS) {
    const url =
      `${API_BASE}/${year}/acs/acs5?get=NAME,${VARS.join(',')}&for=county:*&in=state:${STATE}`;
    const cachePath = `${rawDir}acs5-${year}-b15003-ny.json`;
    let text;
    // P43: a published ACS vintage is immutable; the probe loop tries newer
    // vintages first, so a new release is fetched before any cache can hit.
    // NO_CACHE=1 forces refetch.
    if (existsSync(cachePath) && !process.env.NO_CACHE) {
      text = readFileSync(cachePath, 'utf8');
    } else {
      await politeDelay();
      const res = await fetch(`${url}&key=${key}`, { headers: { 'User-Agent': USER_AGENT } });
      if (res.status === 404) {
        console.log(`  vintage ${year} not available on the API (404), trying next`);
        continue;
      }
      if (!res.ok) throw new Error(`Census API fetch failed: HTTP ${res.status} for ${url}`);
      text = await res.text();
      if (text.trimStart().startsWith('<')) {
        throw new Error(
          `Census API rejected the request (HTML response, likely an invalid/missing key). ` +
            `Check CENSUS_API_KEY. URL: ${url}`,
        );
      }
      writeFileSync(cachePath, text);
      console.log(`  fetched ${url} (${(text.length / 1024).toFixed(0)} KB)`);
    }

    const table = JSON.parse(text);
    if (!Array.isArray(table) || table.length < 2 || !Array.isArray(table[0])) {
      throw new Error(`Unexpected ACS API response shape for vintage ${year}`);
    }
    const header = table[0];
    const idx = new Map(header.map((h, i) => [h, i]));
    for (const col of ['NAME', 'state', 'county', ...VARS]) {
      if (!idx.has(col)) {
        throw new Error(`Column "${col}" missing in ACS API header: ${header.join(', ')}`);
      }
    }
    const rows = new Map();
    for (const row of table.slice(1)) {
      if (row[idx.get('state')] !== STATE) {
        throw new Error(`API row with unexpected state "${row[idx.get('state')]}"`);
      }
      const fips = row[idx.get('county')];
      const ctx = `county ${STATE}${fips} (API ${year})`;
      const values = {};
      for (const code of VARS) values[code] = parseEstimate(row[idx.get(code)], code, ctx);
      rows.set(fips, { values, name: row[idx.get('NAME')] });
    }
    // API rows carry NAME like "Monroe County, New York" — verify directly.
    for (const { fips, name } of COUNTIES) {
      const r = rows.get(fips);
      if (!r) throw new Error(`No API row for county ${STATE}${fips} (${name}), vintage ${year}`);
      if (r.name !== `${name} County, New York`) {
        throw new Error(`NAME mismatch for ${STATE}${fips}: expected "${name} County, New York", got "${r.name}"`);
      }
    }
    return {
      year,
      rows,
      provenance: {
        source: `U.S. Census Bureau, American Community Survey 5-Year Estimates (data API), table B15003`,
        url,
      },
    };
  }
  throw new Error(`No ACS 5-year vintage available on the data API among ${PROBE_YEARS.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Path B — keyless ACS 5-Year Summary File (table-based format).
// Streams acsdt5y{year}-b15003.dat until past the NY county block, caches the
// county slice, and verifies names via the Census county codes file.
// ---------------------------------------------------------------------------

/** Stream the .dat and return [headerLine, ...nyCountyLines], or null on 404. */
async function streamNyCountySlice(url) {
  await politeDelay();
  const controller = new AbortController();
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: controller.signal,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Summary file fetch failed: HTTP ${res.status} for ${url}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let header = null;
  const nyLines = [];
  let sawNY = false;
  let bytes = 0;
  let aborted = false;

  const handleLine = (line) => {
    if (header === null) { header = line; return false; }
    if (line.startsWith(`0500000US${STATE}`)) { nyLines.push(line); sawNY = true; }
    else if (sawNY) return true; // sorted by GEO_ID — past the NY county block
    return false;
  };

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).replace(/\r$/, '');
      buf = buf.slice(nl + 1);
      if (handleLine(line)) { aborted = true; controller.abort(); break outer; }
    }
    if (bytes > 64 * 1024 * 1024) {
      throw new Error(`Read ${bytes} bytes of ${url} without passing the NY county block — sort assumption violated`);
    }
  }
  if (!aborted && buf.trim()) handleLine(buf.trim()); // flush a final unterminated line
  console.log(`  streamed ${(bytes / 1024 / 1024).toFixed(1)} MB of ${url} → ${nyLines.length} NY county rows`);

  if (header === null) throw new Error(`Empty summary file at ${url}`);
  if (nyLines.length !== NY_COUNTY_COUNT) {
    throw new Error(`Expected ${NY_COUNTY_COUNT} NY county rows in ${url}, got ${nyLines.length}`);
  }
  return [header, ...nyLines];
}

async function loadFromSummaryFile() {
  let year = null;
  let lines = null;
  let url = null;
  for (const y of PROBE_YEARS) {
    url = `${SF_BASE}/${y}/table-based-SF/data/5YRData/acsdt5y${y}-b15003.dat`;
    const cachePath = `${rawDir}sf-${y}-b15003-ny.psv`;
    // P43: same immutable-vintage reasoning as the API path; NO_CACHE=1 refetches
    if (existsSync(cachePath) && !process.env.NO_CACHE) {
      lines = readFileSync(cachePath, 'utf8').split('\n').filter((l) => l.length > 0);
      year = y;
      break;
    }
    const slice = await streamNyCountySlice(url);
    if (slice === null) {
      console.log(`  summary file vintage ${y} not available (404), trying next`);
      continue;
    }
    writeFileSync(cachePath, slice.join('\n'));
    lines = slice;
    year = y;
    break;
  }
  if (year === null) {
    throw new Error(`No ACS 5-year summary file available among ${PROBE_YEARS.join(', ')}`);
  }

  // Header check: summary-file columns are B15003_E001/B15003_M001 style.
  const header = lines[0].split('|');
  const idx = new Map(header.map((h, i) => [h, i]));
  if (!idx.has('GEO_ID')) throw new Error(`GEO_ID column missing in SF header: ${lines[0].slice(0, 200)}`);
  const sfCol = (code) => {
    const m = code.match(/^B15003_(\d{3})E$/);
    return `B15003_E${m[1]}`;
  };
  for (const code of VARS) {
    if (!idx.has(sfCol(code))) {
      throw new Error(`Column "${sfCol(code)}" (for ${code}) missing in SF header: ${lines[0].slice(0, 300)}`);
    }
  }

  const rows = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split('|');
    const geoid = cells[idx.get('GEO_ID')];
    if (!/^0500000US36\d{3}$/.test(geoid)) {
      throw new Error(`Unexpected GEO_ID "${geoid}" in cached NY county slice`);
    }
    const fips = geoid.slice(-3);
    const ctx = `county ${STATE}${fips} (SF ${year})`;
    const values = {};
    for (const code of VARS) values[code] = parseEstimate(cells[idx.get(sfCol(code))], code, ctx);
    rows.set(fips, { values, name: null });
  }

  // The .dat has no NAME column — verify county names against the official
  // Census county codes reference file instead.
  const codesText = await fetchText(CODES_URL, 'ny-county-codes-2020.txt');
  const codeLines = codesText.split(/\r?\n/).filter((l) => l.length > 0);
  const codeHeader = codeLines[0].split('|');
  const cIdx = new Map(codeHeader.map((h, i) => [h, i]));
  for (const col of ['STATEFP', 'COUNTYFP', 'COUNTYNAME']) {
    if (!cIdx.has(col)) throw new Error(`Column "${col}" missing in ${CODES_URL}: ${codeLines[0]}`);
  }
  const namesByFips = new Map();
  for (const l of codeLines.slice(1)) {
    const c = l.split('|');
    if (c[cIdx.get('STATEFP')] !== STATE) throw new Error(`Non-NY row in ${CODES_URL}: ${l}`);
    namesByFips.set(c[cIdx.get('COUNTYFP')], c[cIdx.get('COUNTYNAME')]);
  }
  for (const { fips, name } of COUNTIES) {
    if (!rows.has(fips)) throw new Error(`No SF row for county ${STATE}${fips} (${name}), vintage ${year}`);
    const official = namesByFips.get(fips);
    if (official !== `${name} County`) {
      throw new Error(`County name mismatch for ${STATE}${fips}: expected "${name} County", Census codes file says "${official}"`);
    }
  }

  return {
    year,
    rows,
    provenance: {
      source: `U.S. Census Bureau, American Community Survey 5-Year Summary File (table-based format), table B15003`,
      url,
    },
  };
}

// ---------------------------------------------------------------------------
// Load data (API if a key is provided; otherwise keyless summary file).
// ---------------------------------------------------------------------------
const key = process.env.CENSUS_API_KEY;
let loaded;
if (key) {
  console.log('CENSUS_API_KEY set — using the Census data API');
  loaded = await loadFromApi(key);
} else {
  console.log('CENSUS_API_KEY not set — the data API requires a key (verified), using the keyless ACS Summary File');
  loaded = await loadFromSummaryFile();
}
const { year, rows } = loaded;
console.log(`Using ACS 5-year vintage ${year} (${year - 4}-${year})`);

// ---------------------------------------------------------------------------
// Verify variable meanings against the vintage's variables.json (keyless).
// ---------------------------------------------------------------------------
const variablesUrl = `${API_BASE}/${year}/acs/acs5/variables.json`;
const variablesDoc = JSON.parse(await fetchText(variablesUrl, `variables-${year}.json`));
if (!variablesDoc || typeof variablesDoc.variables !== 'object') {
  throw new Error(`Malformed variables.json from ${variablesUrl}: missing "variables" object`);
}
for (const code of VARS) {
  const def = variablesDoc.variables[code];
  if (!def) throw new Error(`Variable ${code} not found in ${variablesUrl}`);
  const label = String(def.label ?? '');
  const lastSegment = label.split('!!').pop().replace(/:$/, '').trim().toLowerCase();
  if (lastSegment !== EXPECTED_LABELS[code]) {
    throw new Error(
      `Variable ${code} label mismatch in vintage ${year}: expected "${EXPECTED_LABELS[code]}", got "${label}"`,
    );
  }
  const concept = String(def.concept ?? '').toLowerCase();
  if (!concept.includes('educational attainment')) {
    throw new Error(`Variable ${code} concept "${def.concept}" does not mention educational attainment`);
  }
}
console.log(`Verified ${VARS.length} B15003 variable labels against variables.json`);

// ---------------------------------------------------------------------------
// Build the output counties.
// ---------------------------------------------------------------------------
const counties = [];
for (const { fips, name } of COUNTIES) {
  const ctx = `county ${STATE}${fips} (${name})`;
  const { values } = rows.get(fips); // presence already asserted per-path

  const pop25 = values.B15003_001E;
  if (pop25 === SUPPRESSED) throw new Error(`Total pop25 suppressed in ${ctx} — cannot proceed`);

  const hs = sumGroup(values, HS_VARS);
  const someCollege = sumGroup(values, SOME_COLLEGE_VARS);
  const baPlus = sumGroup(values, BA_PLUS_VARS);

  let lessHS;
  if (hs === SUPPRESSED || someCollege === SUPPRESSED || baPlus === SUPPRESSED) {
    lessHS = SUPPRESSED;
  } else {
    lessHS = pop25 - (hs + someCollege + baPlus);
    if (lessHS < 0) throw new Error(`Negative lessHS=${lessHS} in ${ctx}: groups exceed total ${pop25}`);
    // Cross-check the residual against the explicit <HS cells (B15003_002E..016E).
    const explicit = sumGroup(values, LESS_HS_VARS);
    if (explicit !== SUPPRESSED && explicit !== lessHS) {
      throw new Error(`lessHS cross-check failed in ${ctx}: residual ${lessHS} != sum(002..016) ${explicit}`);
    }
  }

  counties.push({
    fips: `${STATE}${fips}`,
    name,
    pop25,
    lessHS: emit(lessHS),
    hs: emit(hs),
    someCollege: emit(someCollege),
    baPlus: emit(baPlus),
  });
}

// ---------------------------------------------------------------------------
// Sanity checks.
// ---------------------------------------------------------------------------
if (counties.length !== COUNTIES.length) {
  throw new Error(`Expected ${COUNTIES.length} counties, got ${counties.length}`);
}
const monroe = counties.find((c) => c.fips === '36055');
if (typeof monroe.pop25 !== 'number' || monroe.pop25 < 250_000 || monroe.pop25 > 1_000_000) {
  throw new Error(`Sanity check failed: Monroe pop25 = ${JSON.stringify(monroe.pop25)}, expected ~500k (within 2x)`);
}

// ---------------------------------------------------------------------------
// Emit.
// ---------------------------------------------------------------------------
const out = {
  schemaVersion: SCHEMA_VERSION,
  provenance: {
    source: loaded.provenance.source,
    url: loaded.provenance.url,
    retrievedAt: RETRIEVED_AT,
    vintage: `ACS 5-year ${year - 4}-${year}`,
    notes:
      'Table B15003, educational attainment, population 25+. Counts, not percentages. ' +
      "hs = regular HS diploma + GED (017+018); someCollege = some college + associate's (019-021); " +
      "baPlus = bachelor's through doctorate (022-025); lessHS = total minus the three groups, " +
      'cross-checked against B15003_002..016. Variable labels verified against the vintage variables.json. ' +
      (key
        ? 'Retrieved via the Census data API with an API key.'
        : 'Retrieved from the keyless ACS Summary File because the Census data API now requires an API key; ' +
          'county names verified against the Census 2020 county codes reference file.'),
    ...TERMS.acsBase,
    // the Census API notice is a ToS condition of the API path only
    attribution:
      'U.S. Census Bureau, American Community Survey' +
      (key ? ` — ${TERMS.acsApiNotice}` : ''),
  },
  counties,
};

const json = JSON.stringify(out);
const outPath = fileURLToPath(new URL('../public/data/acs.json', import.meta.url));
writeFileSync(outPath, json);
const kb = Buffer.byteLength(json) / 1024;
if (kb > 4) throw new Error(`acs.json is ${kb.toFixed(1)} KB — exceeds the 4KB budget`);

console.log(`acs.json written: ${kb.toFixed(2)} KB`);
console.log(`  vintage: ACS 5-year ${year - 4}-${year}`);
console.log(`  counties: ${counties.length}; Monroe pop25 = ${monroe.pop25.toLocaleString('en-US')}`);
