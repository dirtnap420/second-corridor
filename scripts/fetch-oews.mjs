#!/usr/bin/env node
/**
 * fetch-oews.mjs — BLS OEWS wages/employment for semiconductor-relevant occupations.
 *
 * Pulls the May OEWS metro-area zip (oesm{yy}ma.zip) and national zip (oesm{yy}nat.zip)
 * from bls.gov (probing the newest vintage first), extracts the MSA and national
 * workbooks, and emits public/data/oews.json with four SOC codes for the
 * Syracuse NY and Rochester NY MSAs plus national figures.
 *
 * The MSA workbook is ~40MB xlsx (~400k rows), so we do NOT load it through a DOM-style
 * parser. An .xlsx is a zip of XML; we stream-decompress xl/worksheets/sheet1.xml with
 * fflate and parse rows incrementally, keeping memory flat.
 *
 * Conventions carried through (never as 0):
 *   '*'  wage estimate not available      -> { suppressed: true }
 *   '**' employment estimate not available-> { suppressed: true }
 *   '#'  wage >= publication top-code     -> { topcoded: true }
 *   row absent for an MSA                 -> { absent: true }
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Unzip, UnzipInflate, unzipSync, strFromU8 } from 'fflate';
import { RETRIEVED_AT, SCHEMA_VERSION, TERMS } from './lib/run-meta.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'raw', 'oews');
const OUT_PATH = join(ROOT, 'public', 'data', 'oews.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const FETCH_HEADERS = {
  'User-Agent': UA,
  Accept: 'application/zip,application/octet-stream,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Newest first. yy -> "May 20yy".
const CANDIDATE_YEARS = ['25', '24'];
const BASE = 'https://www.bls.gov/oes/special-requests';

const TARGET_SOCS = [
  { soc: '51-9141', titleRe: /semiconductor/i },
  { soc: '17-3023', titleRe: /electr.*(technologists|technicians)/i },
  { soc: '17-2071', titleRe: /^electrical engineers$/i },
  { soc: '17-2112', titleRe: /^industrial engineers$/i },
];
const SOC_SET = new Set(TARGET_SOCS.map((t) => t.soc));

const MSA_MATCHERS = [
  { key: 'syracuse', needle: 'Syracuse, NY' },
  { key: 'rochester', needle: 'Rochester, NY' },
];

function fail(msg) {
  throw new Error(`fetch-oews: ${msg}`);
}

// ---------------------------------------------------------------------------
// Download / cache
// ---------------------------------------------------------------------------

async function headOk(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', headers: FETCH_HEADERS });
    const ct = r.headers.get('content-type') || '';
    return r.status === 200 && /zip/i.test(ct);
  } catch {
    return false;
  }
}

async function download(url, dest) {
  // P43: an OEWS vintage is immutable once published, so cache-if-present is
  // correct here; NO_CACHE=1 still forces a refetch (CI / cache repair)
  if (existsSync(dest) && statSync(dest).size > 10_000 && !process.env.NO_CACHE) {
    console.log(`  cache hit: ${dest} (${(statSync(dest).size / 1e6).toFixed(1)} MB)`);
    return readFileSync(dest);
  }
  console.log(`  downloading ${url} ...`);
  const r = await fetch(url, { headers: FETCH_HEADERS });
  if (r.status !== 200) fail(`GET ${url} returned HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  // BLS serves an HTML page with HTTP 200 for some bad paths — verify zip magic bytes.
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    fail(`GET ${url} did not return a zip file (first bytes: ${buf.subarray(0, 8).toString('hex')})`);
  }
  const tmp = dest + '.tmp';
  writeFileSync(tmp, buf);
  renameSync(tmp, dest);
  console.log(`  saved ${dest} (${(buf.length / 1e6).toFixed(1)} MB)`);
  return buf;
}

async function pickVintage() {
  for (const yy of CANDIDATE_YEARS) {
    const maUrl = `${BASE}/oesm${yy}ma.zip`;
    const natUrl = `${BASE}/oesm${yy}nat.zip`;
    const maDest = join(RAW_DIR, `oesm${yy}ma.zip`);
    const natDest = join(RAW_DIR, `oesm${yy}nat.zip`);
    const cached =
      !process.env.NO_CACHE &&
      existsSync(maDest) && statSync(maDest).size > 10_000 &&
      existsSync(natDest) && statSync(natDest).size > 10_000;
    if (cached || ((await headOk(maUrl)) && (await headOk(natUrl)))) {
      return { yy, year: `20${yy}`, maUrl, natUrl, maDest, natDest };
    }
    console.log(`  oesm${yy}ma.zip / oesm${yy}nat.zip not available, trying older vintage...`);
  }
  fail(`no OEWS vintage found among years: ${CANDIDATE_YEARS.join(', ')}`);
}

// ---------------------------------------------------------------------------
// xlsx (zip-of-XML) parsing helpers
// ---------------------------------------------------------------------------

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeXml(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return XML_ENTITIES[e] ?? m;
  });
}

/** List entry names of a zip buffer without decompressing payloads. */
function listZipEntries(buf) {
  const names = [];
  unzipSync(buf, {
    filter: (f) => {
      names.push(f.name);
      return false; // skip decompression
    },
  });
  return names;
}

/** Decompress a single zip entry fully into a Uint8Array. */
function extractEntry(buf, name) {
  const out = unzipSync(buf, { filter: (f) => f.name === name });
  if (!out[name]) fail(`zip entry not found: ${name} (have: ${listZipEntries(buf).slice(0, 20).join(', ')} ...)`);
  return out[name];
}

/**
 * Stream-decompress one zip entry, invoking onChunk(Uint8Array, final) as data arrives.
 * Memory stays bounded by chunk size, not entry size.
 */
function streamEntry(zipBuf, entryName, onChunk) {
  return new Promise((resolve, reject) => {
    let found = false;
    let done = false;
    const unzip = new Unzip((file) => {
      if (file.name !== entryName) return;
      found = true;
      file.ondata = (err, data, final) => {
        if (done) return;
        if (err) {
          done = true;
          return reject(err);
        }
        try {
          onChunk(data, final);
        } catch (e) {
          done = true;
          return reject(e);
        }
        if (final) {
          done = true;
          resolve();
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    const CHUNK = 1 << 20;
    try {
      for (let i = 0; i < zipBuf.length; i += CHUNK) {
        unzip.push(zipBuf.subarray(i, Math.min(i + CHUNK, zipBuf.length)), i + CHUNK >= zipBuf.length);
        if (done) break;
      }
    } catch (e) {
      if (!done) reject(e);
      return;
    }
    if (!found) reject(new Error(`fetch-oews: zip entry not found while streaming: ${entryName}`));
  });
}

/** Parse xl/sharedStrings.xml into an array of strings. */
function parseSharedStrings(xml) {
  const sst = [];
  for (const m of xml.matchAll(/<si(?:\/>|>([\s\S]*?)<\/si>)/g)) {
    let s = '';
    if (m[1]) {
      for (const t of m[1].matchAll(/<t(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/t>)/g)) s += t[1] ?? '';
    }
    sst.push(decodeXml(s));
  }
  return sst;
}

const COL_RE = /(?:^|\s)r="([A-Z]+)(\d+)"/;
const TYPE_RE = /(?:^|\s)t="([^"]+)"/;
const CELL_RE = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
const V_RE = /<v>([\s\S]*?)<\/v>/;

/**
 * Parse one <row>...</row> XML fragment into { rowNum, cells: Map<colLetter, value> }.
 * Values: numbers stay numbers; shared/inline strings are decoded.
 */
function parseRowXml(rowXml, sst) {
  const rn = /<row[^>]*\br="(\d+)"/.exec(rowXml);
  const rowNum = rn ? parseInt(rn[1], 10) : null;
  const cells = new Map();
  for (const c of rowXml.matchAll(CELL_RE)) {
    const attrs = c[1];
    const inner = c[2];
    if (inner === undefined) continue; // self-closing empty cell
    const colM = COL_RE.exec(attrs);
    if (!colM) fail(`cell without r= reference in row ${rowNum}: ${rowXml.slice(0, 200)}`);
    const col = colM[1];
    const t = TYPE_RE.exec(attrs)?.[1] ?? 'n';
    let value;
    if (t === 's') {
      const v = V_RE.exec(inner);
      if (!v) continue;
      const idx = parseInt(v[1], 10);
      if (!(idx >= 0 && idx < sst.length)) fail(`shared-string index ${v[1]} out of range (sst size ${sst.length})`);
      value = sst[idx];
    } else if (t === 'inlineStr') {
      let s = '';
      for (const tm of inner.matchAll(/<t(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/t>)/g)) s += tm[1] ?? '';
      value = decodeXml(s);
    } else if (t === 'str') {
      const v = V_RE.exec(inner);
      value = v ? decodeXml(v[1]) : '';
    } else {
      // numeric (t="n" or untyped); booleans/errors don't occur in these files
      const v = V_RE.exec(inner);
      if (!v) continue;
      value = Number(v[1]);
      if (!Number.isFinite(value)) fail(`non-finite numeric cell ${col}${rowNum}: ${v[1]}`);
    }
    cells.set(col, value);
  }
  return { rowNum, cells };
}

/**
 * Resolve the zip entry path of the FIRST sheet listed in xl/workbook.xml
 * (the data sheet in BLS dl workbooks; the others are "Field Descriptions"
 * and hidden Filler/UpdateTime tabs). Uses the r:id -> rels target mapping
 * rather than assuming sheetN.xml numbering.
 */
function resolveFirstSheet(xlsxBuf, label) {
  const wb = strFromU8(extractEntry(xlsxBuf, 'xl/workbook.xml'));
  const sheetTag = /<sheet\s[^>]*>/.exec(wb)?.[0];
  if (!sheetTag) fail(`${label}: no <sheet> elements in xl/workbook.xml`);
  const sheetName = /\bname="([^"]*)"/.exec(sheetTag)?.[1] ?? '(unnamed)';
  const rid = /\br:id="([^"]*)"/.exec(sheetTag)?.[1];
  if (!rid) fail(`${label}: first sheet tag has no r:id: ${sheetTag}`);
  const rels = strFromU8(extractEntry(xlsxBuf, 'xl/_rels/workbook.xml.rels'));
  const rel = new RegExp(`<Relationship\\s[^>]*Id="${rid}"[^>]*>`).exec(rels)?.[0];
  const target = rel && /\bTarget="([^"]*)"/.exec(rel)?.[1];
  if (!target) fail(`${label}: no rels Target for ${rid}`);
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  return { path, sheetName };
}

/**
 * Stream-parse the primary worksheet of an xlsx buffer.
 * onRow(headerName->value object) is called for every data row (header row consumed internally).
 * Returns the header array (uppercased) after completion.
 */
async function scanWorksheet(xlsxBuf, label, requiredCols, onRow) {
  const entries = listZipEntries(xlsxBuf);
  const { path: sheetName, sheetName: tabName } = resolveFirstSheet(xlsxBuf, label);
  if (!entries.includes(sheetName)) fail(`${label}: resolved sheet ${sheetName} not in zip (entries: ${entries.join(', ')})`);
  const sstEntry = entries.find((n) => n === 'xl/sharedStrings.xml');
  const sst = sstEntry ? parseSharedStrings(strFromU8(extractEntry(xlsxBuf, sstEntry))) : [];
  console.log(`  ${label}: data sheet "${tabName}" -> ${sheetName}, sharedStrings=${sst.length}`);

  let headerMap = null; // colLetter -> header name (uppercased)
  let header = null;
  let rowCount = 0;
  const decoder = new TextDecoder('utf-8');
  let tail = '';

  const handleRow = (rowXml) => {
    const { rowNum, cells } = parseRowXml(rowXml, sst);
    if (!headerMap) {
      if (rowNum !== 1) fail(`${label}: first row is r=${rowNum}, expected header at r=1`);
      headerMap = new Map();
      for (const [col, v] of cells) headerMap.set(col, String(v).trim().toUpperCase());
      header = [...headerMap.values()];
      const missing = requiredCols.filter((c) => !header.includes(c));
      if (missing.length) {
        fail(`${label}: missing expected column(s) [${missing.join(', ')}] — actual header: ${header.join(', ')}`);
      }
      return;
    }
    const obj = {};
    for (const [col, v] of cells) {
      const name = headerMap.get(col);
      if (name) obj[name] = v;
    }
    rowCount++;
    onRow(obj);
  };

  await streamEntry(xlsxBuf, sheetName, (chunk, final) => {
    tail += decoder.decode(chunk, { stream: !final });
    // Drop self-closing empty rows so they can't be glued onto a following real row.
    tail = tail.replace(/<row\b[^>]*\/>/g, '');
    let end;
    while ((end = tail.indexOf('</row>')) !== -1) {
      const start = tail.indexOf('<row');
      if (start === -1 || start > end) fail(`${label}: malformed sheet XML near: ${tail.slice(0, 200)}`);
      handleRow(tail.slice(start, end));
      tail = tail.slice(end + 6);
    }
    // Keep tail from growing without bound on pathological input.
    if (tail.length > 10_000_000) fail(`${label}: row larger than 10MB — sheet XML not row-structured as expected`);
  });

  if (!headerMap) fail(`${label}: no rows parsed from worksheet`);
  console.log(`  ${label}: scanned ${rowCount} data rows`);
  return header;
}

// ---------------------------------------------------------------------------
// OEWS cell-value conventions
// ---------------------------------------------------------------------------

function asNumber(v, what) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  fail(`unparseable ${what} value: ${JSON.stringify(v)}`);
}

/** A_MEDIAN: '*' = not available, '#' = >= top-code. */
function wageCell(v, ctx) {
  if (v === '*') return { suppressed: true };
  if (v === '#') return { topcoded: true };
  if (v === undefined || v === null || v === '') fail(`empty A_MEDIAN for ${ctx}`);
  const n = asNumber(v, `A_MEDIAN (${ctx})`);
  if (n < 15_000 || n > 400_000) fail(`A_MEDIAN ${n} outside sanity range for ${ctx}`);
  return Math.round(n);
}

/** TOT_EMP: '**' = not available. */
function empCell(v, ctx) {
  if (v === '**') return { suppressed: true };
  if (v === undefined || v === null || v === '') fail(`empty TOT_EMP for ${ctx}`);
  const n = asNumber(v, `TOT_EMP (${ctx})`);
  if (n <= 0 || n > 200_000_000) fail(`TOT_EMP ${n} outside sanity range for ${ctx}`);
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });

  console.log('Probing OEWS vintages...');
  const v = await pickVintage();
  console.log(`Using OEWS May ${v.year}`);

  const maZip = await download(v.maUrl, v.maDest);
  const natZip = await download(v.natUrl, v.natDest);

  // Locate the workbooks inside the BLS zips.
  const maEntries = listZipEntries(maZip);
  const natEntries = listZipEntries(natZip);
  const maXlsxName = maEntries.find((n) => /(^|\/)MSA[^/]*\.xlsx$/i.test(n));
  if (!maXlsxName) fail(`no MSA .xlsx found in ${v.maUrl} — entries: ${maEntries.join(', ')}`);
  const natXlsxName = natEntries.find((n) => /national[^/]*\.xlsx$/i.test(n));
  if (!natXlsxName) fail(`no national .xlsx found in ${v.natUrl} — entries: ${natEntries.join(', ')}`);
  console.log(`MSA workbook: ${maXlsxName}; national workbook: ${natXlsxName}`);

  const maXlsx = extractEntry(maZip, maXlsxName);
  const natXlsx = extractEntry(natZip, natXlsxName);

  // ---- national ----
  const natRows = new Map(); // soc -> row
  await scanWorksheet(natXlsx, 'national', ['OCC_CODE', 'OCC_TITLE', 'TOT_EMP', 'A_MEDIAN', 'H_MEDIAN'], (row) => {
    const occ = String(row.OCC_CODE ?? '').trim();
    if (!SOC_SET.has(occ)) return;
    if (natRows.has(occ)) fail(`national file has multiple rows for OCC_CODE ${occ}`);
    natRows.set(occ, row);
  });
  for (const t of TARGET_SOCS) {
    if (!natRows.has(t.soc)) fail(`national file has no row for OCC_CODE ${t.soc}`);
    const title = String(natRows.get(t.soc).OCC_TITLE ?? '');
    if (!t.titleRe.test(title)) {
      fail(`national OCC_TITLE for ${t.soc} is "${title}" — does not match expected pattern ${t.titleRe}`);
    }
  }

  // ---- MSA ----
  // One pass: capture target-SOC rows for any AREA_TITLE containing our needles,
  // and record the AREA codes we see for those titles.
  const areaFound = new Map(); // key -> { code, title }
  const msaRows = new Map(); // `${key}|${soc}` -> row
  await scanWorksheet(
    maXlsx,
    'MSA',
    ['AREA', 'AREA_TITLE', 'OCC_CODE', 'OCC_TITLE', 'TOT_EMP', 'A_MEDIAN', 'H_MEDIAN'],
    (row) => {
      const title = String(row.AREA_TITLE ?? '');
      const m = MSA_MATCHERS.find((mm) => title.includes(mm.needle));
      if (!m) return;
      const code = String(row.AREA ?? '').trim();
      const prev = areaFound.get(m.key);
      if (prev && prev.code !== code) {
        fail(`multiple AREA codes match "${m.needle}": ${prev.code} ("${prev.title}") and ${code} ("${title}")`);
      }
      if (!prev) areaFound.set(m.key, { code, title });
      const occ = String(row.OCC_CODE ?? '').trim();
      if (!SOC_SET.has(occ)) return;
      const k = `${m.key}|${occ}`;
      if (msaRows.has(k)) fail(`duplicate row for ${k}`);
      msaRows.set(k, row);
    }
  );
  for (const mm of MSA_MATCHERS) {
    if (!areaFound.has(mm.key)) fail(`no AREA_TITLE containing "${mm.needle}" found in MSA file`);
  }

  // ---- assemble ----
  const occupations = TARGET_SOCS.map((t) => {
    const nat = natRows.get(t.soc);
    const natCtx = `national ${t.soc}`;
    const entry = {
      soc: t.soc,
      title: String(nat.OCC_TITLE),
      national: {
        median: wageCell(nat.A_MEDIAN, natCtx),
        emp: empCell(nat.TOT_EMP, natCtx),
      },
    };
    for (const mm of MSA_MATCHERS) {
      const row = msaRows.get(`${mm.key}|${t.soc}`);
      if (!row) {
        entry[mm.key] = { absent: true };
        continue;
      }
      const occTitle = String(row.OCC_TITLE ?? '');
      if (!t.titleRe.test(occTitle)) {
        fail(`MSA OCC_TITLE for ${mm.key} ${t.soc} is "${occTitle}" — does not match expected pattern`);
      }
      const ctx = `${mm.key} ${t.soc}`;
      entry[mm.key] = {
        median: wageCell(row.A_MEDIAN, ctx),
        emp: empCell(row.TOT_EMP, ctx),
      };
    }
    return entry;
  });

  // Cross-file sanity: electrical engineers are a big national occupation.
  const ee = occupations.find((o) => o.soc === '17-2071').national;
  if (typeof ee.emp !== 'number' || ee.emp < 50_000) fail(`national 17-2071 employment implausibly low: ${JSON.stringify(ee)}`);
  if (typeof ee.median !== 'number' || ee.median < 60_000) fail(`national 17-2071 median implausibly low: ${JSON.stringify(ee)}`);

  const out = {
    schemaVersion: SCHEMA_VERSION,
    provenance: {
      source: 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics (OEWS)',
      url: 'https://www.bls.gov/oes/tables.htm',
      files: [v.maUrl, v.natUrl],
      retrievedAt: RETRIEVED_AT,
      vintage: `OEWS May ${v.year}`,
      notes:
        `Annual median wage (A_MEDIAN) and employment (TOT_EMP) from ${maXlsxName} and ${natXlsxName}. ` +
        `MSA AREA codes matched by AREA_TITLE: ` +
        MSA_MATCHERS.map((mm) => `${areaFound.get(mm.key).title} = ${areaFound.get(mm.key).code}`).join('; ') +
        `. {suppressed:true} = BLS-nondisclosed estimate ('*' wage / '**' employment); ` +
        `{topcoded:true} = wage at or above the OEWS publication top-code ('#'); ` +
        `{absent:true} = occupation not published for that MSA at all.`,
      ...TERMS.oews,
    },
    areas: Object.fromEntries(MSA_MATCHERS.map((mm) => [mm.key, areaFound.get(mm.key)])),
    occupations,
  };

  const json = JSON.stringify(out, null, 1);
  const kb = Buffer.byteLength(json) / 1024;
  if (kb > 6) fail(`output ${kb.toFixed(1)} KB exceeds 6 KB target`);
  writeFileSync(OUT_PATH, json + '\n');

  console.log('\n--- summary ---');
  console.log(`vintage: OEWS May ${v.year}`);
  console.log(`areas:   ${MSA_MATCHERS.map((mm) => `${mm.key}=${areaFound.get(mm.key).code} ("${areaFound.get(mm.key).title}")`).join(', ')}`);
  for (const o of occupations) {
    const f = (c) =>
      c.absent ? 'absent' : `median=${c.median?.suppressed ? 'suppr' : c.median?.topcoded ? 'topcode' : '$' + c.median}, emp=${c.emp?.suppressed ? 'suppr' : c.emp}`;
    console.log(`${o.soc} ${o.title}`);
    console.log(`   national:  ${f(o.national)}`);
    console.log(`   syracuse:  ${f(o.syracuse)}`);
    console.log(`   rochester: ${f(o.rochester)}`);
  }
  console.log(`wrote ${OUT_PATH} (${kb.toFixed(2)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
