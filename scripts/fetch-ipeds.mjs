// fetch-ipeds.mjs — IPEDS completions in semiconductor-relevant CIPs for the
// Finger Lakes / Second Corridor talent pipeline (RIT, Monroe CC, Finger Lakes CC).
//
// Source: Urban Institute Education Data API (public, no key).
//   https://educationdata.urban.org/api/v1/college-university/ipeds/completions-cip-6/{year}/?unitid={id}
// Output: public/data/ipeds.json  (target <= 20 KB)
// Cache:  raw/ipeds/  and raw/CIPCode2020.csv  (gitignored)
//
// Notes baked into the pipeline (verified against live responses and raw NCES
// C-files, 2026-06):
// - The task spec's unitids 193283 / 191676 resolve to Mohawk Valley CC and
//   Houghton University. The correct ids (found by searching the NY directory)
//   are 193326 (Monroe Community College) and 191199 (Finger Lakes CC).
// - Record schema: { unitid, year, fips, cipcode_6digit, award_level, majornum,
//   sex, race, awards_6digit }. cipcode_6digit is an integer (141001 = 14.1001).
// - Totals: majornum=1, sex=99, race=99. Verified: the 99/99 cell equals the
//   sum across race categories and across sex categories (checked at runtime).
// - award_level codebook (from /api/v1/api-values/): 1,2,3,5,6,30,31,32,33 =
//   sub-baccalaureate awards/certificates; 4 = associate; 7 = bachelor;
//   8,9,20,21,22,23,24 = postbacc certs, master's, doctorates; 99 = total row;
//   -1/-2/-3 = missing / not applicable / suppressed; null appears on some
//   zero-count rows.
// - YEAR LABELING SEAM (important): the portal's completions year label changed
//   convention at 2019/2020. Verified cell-exact against raw NCES files:
//     Urban 2017 = C2018 (AY 2017-18)   Urban 2020 = C2020 (AY 2019-20)
//     Urban 2018 = C2019 (AY 2018-19)   Urban 2021 = C2021 (AY 2020-21)
//     Urban 2019 = C2020 (AY 2019-20)   Urban 2022 = C2022 (AY 2021-22)
//   i.e. Urban 2019 and Urban 2020 carry THE SAME data (AY 2019-20), and
//   pre-2020 labels are the fall year while 2020+ labels are the survey year.
//   This script re-keys everything to the NCES survey year (= academic year
//   ending: 2022 = AY 2021-22), drops the duplicate, and asserts both the
//   duplication and several cross-source value pins at runtime so any upstream
//   relabeling fails loudly.
// - RIT's Microelectronic Engineering BS has no dedicated CIP 2020 code
//   ("Microelectronics Technology" exists only as an example under 15.0399).
//   RIT reports its EE/microelectronics stream under 14.1001 through AY
//   2019-20 and under 14.4701 from AY 2020-21 (CIP 2020 recode; level-7 awards
//   136 -> 0 in 14.1001 while 14.4701 appears with 106). Both codes are kept
//   so the series is continuous across the recode.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'raw', 'ipeds');
const CIP_CSV = path.join(ROOT, 'raw', 'CIPCode2020.csv');
const OUT_FILE = path.join(ROOT, 'public', 'data', 'ipeds.json');

const API = 'https://educationdata.urban.org/api/v1/college-university/ipeds';
const CIP_CSV_URL = 'https://nces.ed.gov/ipeds/cipcode/Files/CIPCode2020.csv';

const INSTITUTIONS = [
  { unitid: 195003, name: 'Rochester Institute of Technology', short: 'RIT' },
  { unitid: 193326, name: 'Monroe Community College', short: 'MCC' },
  { unitid: 191199, name: 'Finger Lakes Community College', short: 'FLCC' },
  // OCC hosts the $15M Micron Cleanroom Simulation Lab and Micron-aligned
  // Electromechanical Technology AAS/certificate programs (Governor's office,
  // 2023-10-19). unitid verified against the IPEDS directory (Syracuse, NY).
  { unitid: 194222, name: 'Onondaga Community College', short: 'OCC' },
];

// Semiconductor-relevant 6-digit CIPs these institutions actually report
// (integer-coded as in the API). Chosen after inspecting every family-14/15
// CIP each institution reported in 2017-2022.
const KEEP_CIPS = [
  140901, // 14.0901 Computer Engineering, General
  141001, // 14.1001 Electrical and Electronics Engineering (RIT pre-recode code)
  144701, // 14.4701 Electrical and Computer Engineering (RIT recode target; incl. microelectronic engineering BS)
  150303, // 15.0303 Electrical, Electronic, and Communications Engineering Technology/Technician
  150306, // 15.0306 Integrated Circuit Design Technology/Technician (RIT; ~0 completions but reported)
  150403, // 15.0403 Electromechanical Technology — OCC's Micron-aligned AAS/certificate program
  150613, // 15.0613 Manufacturing Engineering Technology/Technician
];
// 15.0616 (Semiconductor Manufacturing Technology/Technician) exists in CIP
// 2020 but none of the three institutions reported completions under it
// through the latest available year — verified at runtime below.

const FIRST_OUT_YEAR = 2018; // NCES survey year (= AY ending year): 2018 = AY 2017-18
const PROBE_FROM = 2025; // probe downward from here for the latest Urban year with data
const SEAM = 2020; // Urban years >= SEAM are survey-year labeled; earlier ones are fall-year labeled

const urbanToSurvey = (u) => (u >= SEAM ? u : u + 1);
const surveyToUrban = (s) => (s >= SEAM ? s : s - 1); // for survey 2020 we use Urban 2020, not its Urban-2019 duplicate

// Cross-source pins from raw NCES C-file CSVs (nces.ed.gov/ipeds/datacenter),
// RIT (195003), majornum 1, totals. These anchor the Urban-year -> survey-year
// mapping at both ends and at the seam; if Urban relabels its years, we throw.
const YEAR_PINS = [
  { urban: 2017, cip: 141001, level: 7, value: 125, src: 'C2018_A (AY 2017-18)' },
  { urban: 2018, cip: 141001, level: 7, value: 118, src: 'C2019_A (AY 2018-19)' },
  { urban: 2020, cip: 141001, level: 7, value: 136, src: 'C2020_A (AY 2019-20)' },
  { urban: 2021, cip: 144701, level: 7, value: 106, src: 'C2021_A (AY 2020-21)' },
  { urban: 2022, cip: 144701, level: 7, value: 119, src: 'C2022_A (AY 2021-22)' },
];

const AWARD_BANDS = {
  cert: new Set([1, 2, 3, 5, 6, 30, 31, 32, 33]), // sub-baccalaureate awards/certificates (non-degree)
  assoc: new Set([4]),
  bach: new Set([7]),
  grad: new Set([8, 9, 20, 21, 22, 23, 24]), // postbacc/post-master's certs, master's, doctorates
};
const TOTAL_LEVEL = 99;
const SUPPRESSED_LEVEL = -3;

const REQUIRED_FIELDS = ['unitid', 'year', 'cipcode_6digit', 'award_level', 'majornum', 'sex', 'race', 'awards_6digit'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { tolerate404and500 = false } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.status === 404 || res.status === 500) {
        // The portal answers 500 (not 404) for years it has not published.
        if (tolerate404and500) return null;
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (tolerate404and500 && /HTTP (404|500)/.test(String(err))) return null;
      if (attempt < 4) await sleep(800 * attempt);
    }
  }
  throw new Error(`Failed after 4 attempts: ${url}\n  last error: ${lastErr}`);
}

// Follow the API's `next` field through all pages and return all records.
async function fetchAllPages(url) {
  const records = [];
  let next = url;
  let pages = 0;
  while (next) {
    const data = await fetchJson(next);
    if (!data || !Array.isArray(data.results)) {
      throw new Error(`Unexpected response shape (no results array) at ${next}`);
    }
    records.push(...data.results);
    next = data.next;
    pages++;
    if (pages > 200) throw new Error(`Pagination runaway (>200 pages) at ${url}`);
    if (next) await sleep(120);
  }
  return records;
}

async function cached(file, producer) {
  const fp = path.join(RAW_DIR, file);
  if (existsSync(fp)) return JSON.parse(await readFile(fp, 'utf8'));
  const data = await producer();
  await writeFile(fp, JSON.stringify(data));
  return data;
}

function assertFields(rec, context) {
  for (const f of REQUIRED_FIELDS) {
    if (!(f in rec)) {
      throw new Error(`Schema mismatch: field "${f}" missing from ${context}. Got fields: ${Object.keys(rec).join(', ')}`);
    }
  }
}

const cipStr = (n) => `${String(n).padStart(6, '0').slice(0, 2)}.${String(n).padStart(6, '0').slice(2)}`;

// --- 1. Verify institution identities against the IPEDS directory -----------
async function verifyInstitutions(aroundYear) {
  for (const inst of INSTITUTIONS) {
    const dir = await cached(`directory-${inst.unitid}.json`, async () => {
      for (const y of [aroundYear + 1, aroundYear, aroundYear - 1]) {
        const d = await fetchJson(`${API}/directory/${y}/?unitid=${inst.unitid}`, { tolerate404and500: true });
        if (d && d.count >= 1) return d.results[0];
      }
      throw new Error(`No directory record found for unitid ${inst.unitid} in years ${aroundYear - 1}-${aroundYear + 1}`);
    });
    if (!dir.inst_name || dir.inst_name.trim() !== inst.name) {
      throw new Error(
        `unitid ${inst.unitid} resolves to "${dir.inst_name}", expected "${inst.name}". ` +
        `Search the directory (e.g. ?fips=36) for the correct unitid.`
      );
    }
    console.log(`  directory ok: ${inst.unitid} = ${dir.inst_name}`);
  }
}

// --- 2. Find the latest completions year (Urban label) with data ------------
async function probeLatestUrbanYear() {
  for (let y = PROBE_FROM; y >= SEAM - 1; y--) {
    const d = await fetchJson(`${API}/completions-cip-6/${y}/?unitid=195003&sex=99&race=99&majornum=1`, { tolerate404and500: true });
    if (d && d.count > 0) {
      console.log(`  latest Urban completions year with data: ${y} (= NCES survey year ${urbanToSurvey(y)}, AY ${urbanToSurvey(y) - 1}-${String(urbanToSurvey(y)).slice(2)})`);
      return y;
    }
    console.log(`  ${y}: no data published`);
  }
  throw new Error(`No completions data found for any Urban year ${SEAM - 1}-${PROBE_FROM}`);
}

// --- 3. Pull totals (majornum=1, sex=99, race=99) per Urban year x inst -----
async function pullCompletions(urbanYear, unitid) {
  const recs = await cached(`completions-${urbanYear}-${unitid}.json`, () =>
    fetchAllPages(`${API}/completions-cip-6/${urbanYear}/?unitid=${unitid}&sex=99&race=99&majornum=1`)
  );
  if (recs.length === 0) throw new Error(`Empty completions pull for unitid ${unitid}, Urban year ${urbanYear}`);
  assertFields(recs[0], `completions-cip-6/${urbanYear}/?unitid=${unitid}`);
  for (const r of recs) {
    if (r.unitid !== unitid || r.year !== urbanYear || r.majornum !== 1 || r.sex !== 99 || r.race !== 99) {
      throw new Error(`Filter leak in completions pull (${urbanYear}/${unitid}): ${JSON.stringify(r)}`);
    }
  }
  return recs;
}

// --- 4. Verify total semantics: sex=99/race=99 equals sum over categories ---
async function verifyTotalSemantics(urbanYear, totalsRecs) {
  // pick the largest kept cell so the check is meaningful
  const candidates = totalsRecs
    .filter((r) => KEEP_CIPS.includes(r.cipcode_6digit) && r.award_level !== TOTAL_LEVEL && r.awards_6digit > 0)
    .sort((a, b) => b.awards_6digit - a.awards_6digit);
  if (candidates.length === 0) throw new Error(`No nonzero kept-CIP cell to run the totals semantics check on (Urban year ${urbanYear})`);
  const cell = candidates[0];
  const all = await cached(`semantics-check-${urbanYear}-${cell.unitid}-${cell.cipcode_6digit}-${cell.award_level}.json`, () =>
    fetchAllPages(`${API}/completions-cip-6/${urbanYear}/?unitid=${cell.unitid}&cipcode_6digit=${cell.cipcode_6digit}&award_level=${cell.award_level}&majornum=1`)
  );
  const raceSum = all.filter((r) => r.sex === 99 && r.race !== 99 && r.race > 0).reduce((s, r) => s + r.awards_6digit, 0);
  const sexSum = all.filter((r) => r.race === 99 && r.sex !== 99 && r.sex > 0).reduce((s, r) => s + r.awards_6digit, 0);
  if (raceSum !== cell.awards_6digit || sexSum !== cell.awards_6digit) {
    throw new Error(
      `Totals semantics check FAILED for ${cell.unitid} Urban year ${urbanYear} cip ${cell.cipcode_6digit} level ${cell.award_level}: ` +
      `total=${cell.awards_6digit}, sum over races=${raceSum}, sum over sexes=${sexSum}`
    );
  }
  console.log(`  totals semantics ok (${cell.unitid} ${urbanYear} cip ${cipStr(cell.cipcode_6digit)} lvl ${cell.award_level}: ${cell.awards_6digit} = race sum = sex sum)`);
}

// --- 5. Band aggregation ------------------------------------------------------
// Returns { sums: {cert,assoc,bach,grad}, suppressed: Set<band>, perCip: Map<cip, {band: n}> }
function aggregateKept(recs, context) {
  const sums = { cert: 0, assoc: 0, bach: 0, grad: 0 };
  const suppressed = new Set();
  const perCip = new Map();
  for (const r of recs) {
    if (!KEEP_CIPS.includes(r.cipcode_6digit)) continue;
    if (r.award_level === TOTAL_LEVEL) continue; // pre-summed total rows: exclude to avoid double counting
    if (r.award_level === SUPPRESSED_LEVEL) {
      throw new Error(`Suppressed award_level row (cannot attribute to a band) in ${context}: ${JSON.stringify(r)}`);
    }
    const band = Object.keys(AWARD_BANDS).find((b) => AWARD_BANDS[b].has(r.award_level));
    if (!band) {
      // -1/-2 (missing/not applicable) or null with a zero count: nothing to attribute
      if ((r.award_level === null || r.award_level < 0) && r.awards_6digit === 0) continue;
      throw new Error(`Unknown award_level ${r.award_level} with count ${r.awards_6digit} in ${context}: ${JSON.stringify(r)}`);
    }
    if (r.awards_6digit === null || r.awards_6digit < 0) {
      suppressed.add(band); // carry through, never as 0
      continue;
    }
    sums[band] += r.awards_6digit;
    if (!perCip.has(r.cipcode_6digit)) perCip.set(r.cipcode_6digit, { cert: 0, assoc: 0, bach: 0, grad: 0 });
    perCip.get(r.cipcode_6digit)[band] += r.awards_6digit;
  }
  return { sums, suppressed, perCip };
}

// --- 6. Official CIP 2020 titles ----------------------------------------------
function parseCsv(text) {
  // Minimal RFC4180-ish parser tolerant of NCES's ="01.0000" Excel-guard fields.
  const rows = [];
  let row = [], field = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuote = false;
      } else field += c;
    } else if (c === '"') inQuote = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function loadCipTitles() {
  if (!existsSync(CIP_CSV)) {
    const res = await fetch(CIP_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${CIP_CSV_URL}`);
    await writeFile(CIP_CSV, Buffer.from(await res.arrayBuffer()));
  }
  const text = (await readFile(CIP_CSV, 'utf8')).replace(/^﻿/, '');
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.replace(/^=/, ''));
  const codeIdx = header.indexOf('CIPCode');
  const titleIdx = header.indexOf('CIPTitle');
  if (codeIdx === -1 || titleIdx === -1) {
    throw new Error(`CIPCode2020.csv schema changed: header = ${header.join(', ')}`);
  }
  const titles = new Map();
  for (const r of rows.slice(1)) {
    const code = (r[codeIdx] || '').replace(/^=/, '').replace(/"/g, '').trim();
    const title = (r[titleIdx] || '').trim().replace(/\.$/, '');
    if (code) titles.set(code, title);
  }
  return titles;
}

// --- main ----------------------------------------------------------------------
async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(path.dirname(OUT_FILE), { recursive: true });

  console.log('Probing latest completions year...');
  const latestUrban = await probeLatestUrbanYear();
  const latestSurvey = urbanToSurvey(latestUrban);
  if (latestSurvey < FIRST_OUT_YEAR) throw new Error(`Latest survey year ${latestSurvey} is before ${FIRST_OUT_YEAR}`);

  console.log('Verifying institution identities...');
  await verifyInstitutions(latestUrban + 1);

  console.log('Loading official CIP 2020 titles...');
  const cipTitles = await loadCipTitles();
  for (const c of KEEP_CIPS) {
    const code = cipStr(c);
    if (!cipTitles.get(code)) throw new Error(`CIP ${code} not found in official CIP 2020 list — cannot verify title`);
  }

  // Urban years to pull: one per output survey year, plus the Urban-2019
  // duplicate (pulled only to verify the seam, never aggregated).
  const surveyYears = [];
  for (let s = FIRST_OUT_YEAR; s <= latestSurvey; s++) surveyYears.push(s);
  const urbanYears = [...new Set([...surveyYears.map(surveyToUrban), SEAM - 1])].sort();

  console.log(`Pulling completions for Urban years ${urbanYears.join(', ')} x ${INSTITUTIONS.length} institutions...`);
  const pulls = new Map(); // `${urbanYear}-${unitid}` -> records
  for (const u of urbanYears) {
    for (const inst of INSTITUTIONS) {
      const recs = await pullCompletions(u, inst.unitid);
      pulls.set(`${u}-${inst.unitid}`, recs);
      console.log(`  Urban ${u} ${inst.short}: ${recs.length} total-rows`);
    }
  }

  console.log('Verifying totals semantics on the largest kept cell of the latest year...');
  await verifyTotalSemantics(latestUrban, pulls.get(`${latestUrban}-195003`));

  // Verify the year-label seam: Urban 2019 must duplicate Urban 2020
  // (band-level, since the certificate award_level coding changed between them).
  console.log('Verifying the Urban year-label seam (2019 duplicates 2020)...');
  for (const inst of INSTITUTIONS) {
    const a = aggregateKept(pulls.get(`${SEAM - 1}-${inst.unitid}`), `Urban ${SEAM - 1}/${inst.short}`);
    const b = aggregateKept(pulls.get(`${SEAM}-${inst.unitid}`), `Urban ${SEAM}/${inst.short}`);
    // compare nonzero cells only: the CIP-2020-coded file adds all-zero program
    // rows (e.g. 15.0306) that do not exist in the CIP-2010-coded duplicate
    const key = (m) => JSON.stringify(
      [...m.perCip.entries()]
        .filter(([, b]) => b.cert + b.assoc + b.bach + b.grad > 0)
        .sort((x, y) => x[0] - y[0])
    );
    if (key(a) !== key(b)) {
      throw new Error(
        `Year-seam assumption broken for ${inst.short}: Urban ${SEAM - 1} and ${SEAM} are no longer duplicates. ` +
        `The portal may have fixed its year labels — re-verify the Urban-year -> survey-year mapping against NCES C-files. ` +
        `${SEAM - 1}: ${key(a)}  ${SEAM}: ${key(b)}`
      );
    }
  }
  console.log('  seam ok: Urban 2019 = Urban 2020 cell-for-cell (AY 2019-20 published under both labels)');

  // Cross-source year pins against raw NCES C-files
  console.log('Verifying cross-source year pins (NCES C-file values)...');
  for (const pin of YEAR_PINS) {
    const recs = pulls.get(`${pin.urban}-195003`);
    if (!recs) continue; // year outside pulled range
    const cell = recs.find((r) => r.cipcode_6digit === pin.cip && r.award_level === pin.level);
    const got = cell ? cell.awards_6digit : undefined;
    if (got !== pin.value) {
      throw new Error(
        `Year pin FAILED: Urban ${pin.urban} RIT cip ${cipStr(pin.cip)} level ${pin.level} = ${got}, ` +
        `expected ${pin.value} from ${pin.src}. The portal's year labeling may have changed — re-verify the mapping.`
      );
    }
    console.log(`  pin ok: Urban ${pin.urban} ${cipStr(pin.cip)} lvl ${pin.level} = ${pin.value} (${pin.src})`);
  }

  // Check whether anyone reports 15.0616 (semiconductor manufacturing tech)
  let any150616 = false;
  for (const recs of pulls.values()) any150616 ||= recs.some((r) => r.cipcode_6digit === 150616);
  if (any150616) {
    throw new Error('15.0616 (Semiconductor Manufacturing Technology) now appears in the data but is not in KEEP_CIPS — add it.');
  }

  // Aggregate, keyed by survey year (Urban 2019 duplicate excluded by surveyToUrban)
  const series = [];
  const cipTotals = new Map(KEEP_CIPS.map((c) => [c, { total: 0, byInst: Object.fromEntries(INSTITUTIONS.map((i) => [i.short, 0])) }]));
  for (const s of surveyYears) {
    const u = surveyToUrban(s);
    for (const inst of INSTITUTIONS) {
      const { sums, suppressed, perCip } = aggregateKept(pulls.get(`${u}-${inst.unitid}`), `Urban ${u}/${inst.short}`);
      for (const [cip, bands] of perCip) {
        const t = cipTotals.get(cip);
        const n = bands.cert + bands.assoc + bands.bach + bands.grad;
        t.total += n;
        t.byInst[inst.short] += n;
      }
      const row = { year: s, inst: inst.short };
      for (const band of ['cert', 'assoc', 'bach', 'grad']) {
        row[band] = suppressed.has(band) ? { suppressed: true } : sums[band];
      }
      series.push(row);
    }
  }

  // Sanity: the corridor's flagship pipeline must be visibly nonzero
  const ritLatest = series.find((r) => r.year === latestSurvey && r.inst === 'RIT');
  if (!(typeof ritLatest.bach === 'number' && ritLatest.bach > 50)) {
    throw new Error(`Sanity check failed: RIT survey year ${latestSurvey} bachelor total in kept CIPs is ${JSON.stringify(ritLatest.bach)} (expected > 50)`);
  }
  const grand = series.reduce((s, r) => s + ['cert', 'assoc', 'bach', 'grad'].reduce((a, b) => a + (typeof r[b] === 'number' ? r[b] : 0), 0), 0);
  if (grand < 500) throw new Error(`Sanity check failed: grand total ${grand} awards across all years/institutions seems too low`);

  const out = {
    provenance: {
      source: 'Urban Institute Education Data Portal (NCES IPEDS completions, 6-digit CIP)',
      url: `${API}/completions-cip-6/{year}/?unitid={unitid}`,
      retrievedAt: new Date().toISOString().slice(0, 10),
      vintage: `IPEDS completions, AY ${FIRST_OUT_YEAR - 1}-${String(FIRST_OUT_YEAR).slice(2)} through AY ${latestSurvey - 1}-${String(latestSurvey).slice(2)} (NCES surveys C${FIRST_OUT_YEAR}-C${latestSurvey}); series year = NCES survey year = academic year ending`,
      notes:
        'Totals only (first major, all races, all sexes; verified that the race=99/sex=99 cell equals the sum across categories). ' +
        'Award bands: cert = sub-baccalaureate awards/certificates (Urban award_level 1,2,3,5,6,30-33); assoc = associate degrees (4); bach = bachelor degrees (7); grad = postbaccalaureate/post-master certificates, master and doctoral degrees (8,9,20-24). ' +
        "The portal's completions year label changed convention at 2019/2020 (pre-2020 = fall year, 2020+ = survey year), publishing AY 2019-20 under both labels; this file re-keys every year to the NCES survey year, drops the duplicate, and the fetch script verifies the mapping against raw NCES C-file values at runtime. " +
        'Task-spec unitids 193283/191676 resolve to Mohawk Valley CC and Houghton University; corrected via IPEDS directory search to 193326 (Monroe CC) and 191199 (Finger Lakes CC). ' +
        "RIT's Microelectronic Engineering BS has no dedicated CIP code; RIT reported its electrical/microelectronics stream under 14.1001 through AY 2019-20 and under 14.4701 from AY 2020-21 (CIP 2020 recode), so both are kept for series continuity. " +
        '15.0616 Semiconductor Manufacturing Technology/Technician exists in CIP 2020 but none of these institutions reported completions under it through the latest year. ' +
        'FLCC reports no completions in the kept CIPs (its engineering-adjacent awards fall under 14.0101, 15.0101, 15.0404, 15.0805); its rows are true zeros, not suppression. ' +
        'CIP titles verified against the official NCES CIP 2020 list (nces.ed.gov/ipeds/cipcode). IPEDS completions lag about two years.',
    },
    institutions: INSTITUTIONS.map((i) => ({ unitid: i.unitid, name: i.name, short: i.short })),
    cips: KEEP_CIPS.map((c) => {
      const t = cipTotals.get(c);
      return { code: cipStr(c), title: cipTitles.get(cipStr(c)), total: t.total, byInst: t.byInst };
    }),
    series,
  };

  const json = JSON.stringify(out);
  await writeFile(OUT_FILE, json);
  const kb = (Buffer.byteLength(json) / 1024).toFixed(1);

  console.log('\n=== Summary ===');
  console.log(`Survey years: ${FIRST_OUT_YEAR}-${latestSurvey} (AY ${FIRST_OUT_YEAR - 1}-${String(FIRST_OUT_YEAR).slice(2)} .. AY ${latestSurvey - 1}-${String(latestSurvey).slice(2)}; latest available, probed Urban ${PROBE_FROM} downward)`);
  console.log(`Institutions: ${INSTITUTIONS.map((i) => `${i.short} (${i.unitid})`).join(', ')}`);
  console.log('Kept CIPs (awards summed over all years/bands):');
  for (const c of out.cips) console.log(`  ${c.code} ${c.title}: ${c.total} (${Object.entries(c.byInst).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  console.log('Series (year = NCES survey year = AY ending):');
  for (const r of series) console.log(`  ${r.year} ${r.inst.padEnd(4)} cert=${JSON.stringify(r.cert)} assoc=${JSON.stringify(r.assoc)} bach=${JSON.stringify(r.bach)} grad=${JSON.stringify(r.grad)}`);
  console.log(`Wrote ${OUT_FILE} (${kb} KB)`);
  if (Buffer.byteLength(json) > 20 * 1024) throw new Error(`Output exceeds 20 KB target: ${kb} KB`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message ?? err);
  process.exit(1);
});
