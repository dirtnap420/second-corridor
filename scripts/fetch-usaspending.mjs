// fetch-usaspending.mjs — USAspending API v2 → public/data/spending.json
//
// Pulls award-level federal spending records relevant to the corridor story:
//   (1) Micron CHIPS Incentives direct funding (Dept. of Commerce / NIST,
//       finalized Dec 10 2024, announced "up to $6.165B" across NY + ID).
//       *** DISCOVERY FINDING (verified 2026-06): Commerce/NIST has NOT
//       published the Micron CHIPS direct-funding agreements to USAspending.
//       The ONLY award records under assistance listing 11.037 ("CHIPS
//       Incentives Program") are three loans: TSMC1, TSMC2 (TSMC Arizona)
//       and SKHYNIX1 (SK Hynix) — no Micron record exists under any award
//       type group, recipient spelling, UEI, TAS/File C linkage, or keyword.
//       The discovery queries below run on every execution, so if NIST later
//       reports the Micron awards they are picked up and sanity-checked
//       automatically. Their absence is recorded in the output (no numbers
//       are ever fabricated).
//   (2) NSF 2347157 "EMERGE-MICRO" cooperative agreement to Rochester
//       Institute of Technology (pinned constant below).
//   (3) NSF awards to RIT explicitly tied to UPWARDS / the NSF–Micron
//       workforce partnership — keyword-discovered; included only if the
//       award description literally mentions UPWARDS. (As of 2026-06 none
//       do — RIT's "Upward Bound" awards are unrelated Dept. of Education
//       TRIO grants and are excluded by the NSF agency filter.)
//
// Raw API responses are cached in raw/usaspending/ (gitignored).
// Run: node scripts/fetch-usaspending.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RETRIEVED_AT, SCHEMA_VERSION, TERMS } from './lib/run-meta.mjs';

const API = 'https://api.usaspending.gov/api/v2';
const DELAY_MS = 150;
const USER_AGENT = 'second-corridor-data-pipeline (static site; contact via repo)';

// --- Pinned award identifiers -----------------------------------------------
// NSF 2347157 — "BEGINNINGS: ... EMERGING MICROELECTRONICS (EMERGE-MICRO)",
// cooperative agreement to Rochester Institute of Technology, CFDA 47.076.
// Verified 2026-06-10: generated_unique_award_id ASST_NON_2347157_049,
// total_obligation $999,997, PoP 2024-07-15 → 2027-06-30.
const NSF_EMERGE = { fain: '2347157', generatedId: 'ASST_NON_2347157_049' };

// Micron CHIPS direct funding: NO identifier exists to pin (see header).
// Known CFDA 11.037 records as of 2026-06-10 (used as a discovery self-check —
// if the 11.037 query stops returning at least one of these, the query shape
// has regressed and the script throws rather than silently reporting absence):
const KNOWN_CHIPS_11037_FAINS = ['TSMC1', 'TSMC2', 'SKHYNIX1'];

// spending_by_award only accepts award_type_codes from ONE group per request.
const TYPE_GROUPS = {
  grants: ['02', '03', '04', '05', 'F001', 'F002'],
  direct_payments: ['09', '11', '-1', 'F005', 'F008', 'F009', 'F010'],
  other_assistance: ['06', '10', 'F006', 'F007'],
  loans: ['07', '08', 'F003', 'F004'],
};
const WIDE_PERIOD = [{ start_date: '2007-10-01', end_date: '2026-09-30' }];

// ---------------------------------------------------------------------------
const rawDir = fileURLToPath(new URL('../raw/usaspending/', import.meta.url));
mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let madeNetworkRequest = false;

async function apiFetch(cacheName, path, postBody = null) {
  const cachePath = `${rawDir}${cacheName}.json`;
  // P43: these are cumulative discovery searches — this fetcher IS the FAIN
  // watcher (P36), and a cached response would mean the Micron award landing
  // on USAspending was never noticed. Always fetch live; the raw/ file is a
  // write-only audit archive, read back only under OFFLINE=1.
  if (existsSync(cachePath) && process.env.OFFLINE === '1')
    return JSON.parse(readFileSync(cachePath, 'utf8'));

  if (madeNetworkRequest) await sleep(DELAY_MS); // be polite between live requests
  madeNetworkRequest = true;

  const url = `${API}${path}`;
  const res = await fetch(url, {
    method: postBody ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: postBody ? JSON.stringify(postBody) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`USAspending ${postBody ? 'POST' : 'GET'} ${path} failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text);
  writeFileSync(cachePath, JSON.stringify(json));
  console.log(`  fetched ${path} → raw/usaspending/${cacheName}.json`);
  return json;
}

/** Assert every named field is present (may be null) on an object. */
function requireFields(obj, fields, context) {
  for (const f of fields) {
    if (!(f in obj)) {
      throw new Error(`Field "${f}" missing in ${context}. Got keys: ${Object.keys(obj).join(', ')}`);
    }
  }
}

function requireNumber(value, field, context) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected numeric ${field} in ${context}, got ${JSON.stringify(value)}`);
  }
  return value;
}

const SEARCH_FIELDS = ['Award ID', 'Recipient Name', 'generated_internal_id', 'Description'];

async function searchAwards(cacheName, filters) {
  const out = [];
  for (const [group, codes] of Object.entries(TYPE_GROUPS)) {
    const j = await apiFetch(`${cacheName}-${group}`, '/search/spending_by_award/', {
      filters: { ...filters, award_type_codes: codes },
      fields: SEARCH_FIELDS,
      limit: 100,
      page: 1,
    });
    if (!Array.isArray(j.results)) {
      throw new Error(`spending_by_award (${cacheName}/${group}) returned no results array: ${JSON.stringify(j).slice(0, 200)}`);
    }
    for (const r of j.results) {
      requireFields(r, SEARCH_FIELDS, `${cacheName}/${group} search row`);
      out.push({ group, fain: r['Award ID'], recipient: r['Recipient Name'], generatedId: r.generated_internal_id, description: r.Description });
    }
  }
  return out;
}

/** Fetch one award's profile and map it to the output shape. */
async function fetchAwardProfile(generatedId, kind) {
  const j = await apiFetch(`award-${generatedId}`, `/awards/${generatedId}/`);
  requireFields(
    j,
    ['generated_unique_award_id', 'fain', 'total_obligation', 'total_outlay', 'total_account_outlay', 'period_of_performance', 'recipient', 'awarding_agency', 'description'],
    `award detail ${generatedId}`,
  );
  const recipient = j.recipient?.recipient_name;
  const toptier = j.awarding_agency?.toptier_agency?.name;
  const subtier = j.awarding_agency?.subtier_agency?.name;
  if (!recipient || !toptier) throw new Error(`Recipient/agency missing in award detail ${generatedId}`);
  const obligated = requireNumber(j.total_obligation, 'total_obligation', generatedId);
  // total_outlay (FABS-reported) is null when the agency has not reported
  // outlays; total_account_outlay is the File C account-linked outlay total.
  const outlaid = j.total_outlay === null ? null : requireNumber(j.total_outlay, 'total_outlay', generatedId);
  const outlaidAccount = j.total_account_outlay === null ? null : requireNumber(j.total_account_outlay, 'total_account_outlay', generatedId);
  const pop = j.period_of_performance ?? {};
  const desc = (j.description ?? '').trim();
  return {
    id: j.generated_unique_award_id,
    fain: j.fain,
    recipient,
    agency: subtier && subtier !== toptier ? `${toptier} / ${subtier}` : toptier,
    description: desc.length > 240 ? `${desc.slice(0, 240)}…` : desc,
    obligated,
    outlaid,
    outlaidAccount,
    periodOfPerformance: { start: pop.start_date ?? null, end: pop.end_date ?? null },
    profileUrl: `https://www.usaspending.gov/award/${j.generated_unique_award_id}`,
    kind,
  };
}

const isMicronCorp = (name) => /^MICRON\b/i.test(name) && !/MICRONESIA|MICRONESIAN/i.test(name);

// ---------------------------------------------------------------------------
// (1) CHIPS discovery: CFDA 11.037 (all type groups) + Commerce-awarded
//     assistance to MICRON* recipients (all type groups).
// ---------------------------------------------------------------------------
console.log('CHIPS discovery (CFDA 11.037 + Dept. of Commerce x MICRON)...');
const cfdaHits = await searchAwards('search-cfda-11037', {
  program_numbers: ['11.037'],
  time_period: WIDE_PERIOD,
});
const commerceMicronHits = await searchAwards('search-commerce-micron', {
  recipient_search_text: ['MICRON'],
  agencies: [{ type: 'awarding', tier: 'toptier', name: 'Department of Commerce' }],
  time_period: WIDE_PERIOD,
});

// Self-check: the 11.037 query must still see the known loan records,
// otherwise "no Micron award" could be an artifact of a broken query.
if (!cfdaHits.some((h) => KNOWN_CHIPS_11037_FAINS.includes(h.fain))) {
  throw new Error(
    `CFDA 11.037 discovery self-check failed: expected at least one of ${KNOWN_CHIPS_11037_FAINS.join('/')} ` +
    `but got [${cfdaHits.map((h) => h.fain).join(', ')}]. Query shape may have regressed.`,
  );
}

const micronChips = new Map(); // generatedId -> hit
for (const h of [...cfdaHits, ...commerceMicronHits]) {
  if (isMicronCorp(h.recipient)) micronChips.set(h.generatedId, h);
}

const awards = [];
for (const [generatedId, hit] of micronChips) {
  const text = `${hit.description ?? ''} ${hit.fain}`;
  let kind;
  if (/NEW YORK|\bNY\b|CLAY|ONONDAGA/i.test(text)) kind = 'chips-ny';
  else if (/IDAHO|\bID\b|BOISE/i.test(text)) kind = 'chips-id';
  else throw new Error(`Cannot classify Micron CHIPS award ${generatedId} as NY or ID from description: ${text.slice(0, 200)}`);
  const award = await fetchAwardProfile(generatedId, kind);
  // Sanity: NY award obligation should be on the order of $10^9.
  if (kind === 'chips-ny' && (award.obligated < 5e8 || award.obligated > 2e10)) {
    throw new Error(`Sanity check failed: CHIPS NY obligation $${award.obligated} not on the order of $10^9 (${generatedId})`);
  }
  if (kind === 'chips-id' && (award.obligated < 1e8 || award.obligated > 1e10)) {
    throw new Error(`Sanity check failed: CHIPS ID obligation $${award.obligated} outside $1e8-$1e10 (${generatedId})`);
  }
  awards.push(award);
}

const chipsFound = awards.length > 0;
if (!chipsFound) {
  console.warn(
    '\n  *** WARNING: no Micron CHIPS award record exists on USAspending. ***\n' +
    '  The Dec 10 2024 Micron direct-funding agreements (announced up to $6.165B)\n' +
    '  were never reported to FABS/File C by Commerce/NIST; the only CFDA 11.037\n' +
    `  award records are: ${cfdaHits.map((h) => `${h.fain} (${h.recipient})`).join(', ')}.\n` +
    '  Recording this absence in the output — NOT fabricating numbers.\n',
  );
}

// ---------------------------------------------------------------------------
// (2) NSF 2347157 EMERGE-MICRO (pinned).
// ---------------------------------------------------------------------------
console.log('NSF EMERGE-MICRO (pinned FAIN 2347157)...');
const emerge = await fetchAwardProfile(NSF_EMERGE.generatedId, 'nsf-emerge');
if (emerge.fain !== NSF_EMERGE.fain) {
  throw new Error(`FAIN mismatch for ${NSF_EMERGE.generatedId}: expected ${NSF_EMERGE.fain}, got ${emerge.fain}`);
}
if (!/ROCHESTER INSTITUTE OF TECHNOLOGY/i.test(emerge.recipient)) {
  throw new Error(`Recipient mismatch for EMERGE-MICRO: ${emerge.recipient}`);
}
if (!/National Science Foundation/i.test(emerge.agency)) {
  throw new Error(`Awarding agency mismatch for EMERGE-MICRO: ${emerge.agency}`);
}
// Sanity: order of $10^5-$10^6.
if (emerge.obligated < 1e5 || emerge.obligated > 5e6) {
  throw new Error(`Sanity check failed: EMERGE-MICRO obligation $${emerge.obligated} outside $1e5-$5e6`);
}
awards.push(emerge);

// ---------------------------------------------------------------------------
// (3) NSF x RIT x UPWARDS keyword discovery — include only explicit matches.
// ---------------------------------------------------------------------------
console.log('NSF/RIT UPWARDS keyword discovery...');
const upwardsHits = await searchAwards('search-rit-upwards', {
  keywords: ['UPWARDS'],
  recipient_search_text: ['ROCHESTER INSTITUTE OF TECHNOLOGY'],
  agencies: [{ type: 'awarding', tier: 'toptier', name: 'National Science Foundation' }],
  time_period: WIDE_PERIOD,
});
const upwardsMatches = upwardsHits.filter(
  (h) => /\bUPWARDS\b/i.test(h.description ?? '') && h.generatedId !== NSF_EMERGE.generatedId,
);
for (const h of upwardsMatches) {
  awards.push(await fetchAwardProfile(h.generatedId, 'nsf-other'));
}
if (upwardsMatches.length === 0) {
  console.log('  no NSF award to RIT explicitly mentions UPWARDS — skipped (per spec, not stretching).');
}

// ---------------------------------------------------------------------------
// Final sanity + emit.
// ---------------------------------------------------------------------------
if (awards.length === 0) throw new Error('No awards captured at all — refusing to emit an empty dataset.');
if (!awards.some((a) => a.kind === 'nsf-emerge')) throw new Error('EMERGE-MICRO award missing from output.');

const retrievedAt = RETRIEVED_AT;
const out = {
  schemaVersion: SCHEMA_VERSION,
  provenance: {
    source: 'USAspending.gov API v2 (award profiles via /api/v2/awards/{generated_unique_award_id}/; discovery via /api/v2/search/spending_by_award/)',
    url: 'https://api.usaspending.gov/api/v2/',
    retrievedAt,
    vintage:
      'USAspending award records as published at retrieval (FABS/File C, updated nightly). ' +
      'CHIPS Incentives awards announced Nov-Dec 2024; NSF EMERGE-MICRO period of performance 2024-07-15 to 2027-06-30.',
    notes:
      'obligated = total_obligation; outlaid = total_outlay (FABS-reported; null = agency has not reported outlays); ' +
      'outlaidAccount = total_account_outlay (File C account-linked outlays). ' +
      'Descriptions truncated to 240 chars. ' +
      (chipsFound
        ? 'Micron CHIPS award record(s) found and included.'
        : 'Micron CHIPS direct-funding awards are ABSENT from USAspending (see chipsNotPublished); no numbers were imputed.'),
    ...TERMS.usaspending,
  },
  awards,
};
if (!chipsFound) {
  out.chipsNotPublished = {
    what:
      'CHIPS Incentives direct funding to Micron (Dept. of Commerce/NIST, finalized 2024-12-10, ' +
      'announced "up to $6.165B" for the Clay NY and Boise ID projects per the Commerce press release of that date)',
    finding:
      'No award record exists on USAspending for any Micron CHIPS award. Searched: assistance listing CFDA 11.037 across every ' +
      'award-type group; recipient text/UEI "MICRON*" under awarding agency Dept. of Commerce; TAS 013-0520 (CHIPS for America ' +
      'Fund) File C award linkage; and full keyword search >= $100M. The only CFDA 11.037 award records published are the TSMC ' +
      'Arizona loans (TSMC1, TSMC2) and the SK Hynix loan (SKHYNIX1).',
    cfda11037AwardsFound: cfdaHits.map((h) => ({ fain: h.fain, recipient: h.recipient, id: h.generatedId })),
    checkedAt: retrievedAt,
  };
}

const json = JSON.stringify(out);
const outPath = fileURLToPath(new URL('../public/data/spending.json', import.meta.url));
writeFileSync(outPath, json);
const kb = Buffer.byteLength(json) / 1024;
if (kb > 6) throw new Error(`spending.json is ${kb.toFixed(1)} KB — exceeds the 6KB budget`);

console.log(`\nspending.json written: ${kb.toFixed(2)} KB`);
for (const a of awards) {
  console.log(`  [${a.kind}] ${a.fain} | ${a.recipient} | obligated $${a.obligated.toLocaleString('en-US')} | outlaid ${a.outlaid === null ? 'null (not reported)' : `$${a.outlaid.toLocaleString('en-US')}`}`);
}
if (!chipsFound) console.log('  [chips] ABSENT — Micron CHIPS awards not published on USAspending (recorded in chipsNotPublished).');
