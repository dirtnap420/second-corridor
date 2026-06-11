// archive-sources.mjs — P27: Wayback-archive every cited source URL.
// ~37 citations underpin the site; press releases and agency pages move
// constantly. Reads public/data/sources.json (P32), POSTs each URL to the
// Internet Archive's save endpoint, and records archiveUrl + archivedAt in
// public/data/archives.json (consumed by R15≡P28 in Wave 6).
//
//   node scripts/archive-sources.mjs              archive URLs not yet archived
//   node scripts/archive-sources.mjs --refresh    re-archive everything
//
// Fail-soft per URL: the Archive rate-limits and hiccups; a failed save is
// recorded and retried on the next weekly run. Exit 0 unless NOTHING could
// be archived (signal of a systemic problem), so the weekly refresh never
// blocks on archive.org weather.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const SOURCES_PATH = fileURLToPath(new URL('public/data/sources.json', root));
const OUT_PATH = fileURLToPath(new URL('public/data/archives.json', root));
const STAMP = process.env.REFRESH_TIMESTAMP || new Date().toISOString().slice(0, 10);
const REFRESH_ALL = process.argv.includes('--refresh');
const DELAY_MS = 6000; // SPN is rate-limited; be a polite citizen

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const registry = JSON.parse(readFileSync(SOURCES_PATH, 'utf8'));
const prev = existsSync(OUT_PATH)
  ? JSON.parse(readFileSync(OUT_PATH, 'utf8'))
  : { schemaVersion: 1, archives: {} };

const urls = [...new Set(registry.sources.map((s) => s.url))];
let saved = 0;
let kept = 0;
let failed = 0;

// fall back to the availability API — an existing snapshot is fine
async function existingSnapshot(url) {
  const av = await fetch(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(30000) }
  ).then((r) => r.json());
  const snap = av?.archived_snapshots?.closest;
  return snap?.available ? snap.url : null;
}

for (const url of urls) {
  if (!REFRESH_ALL && prev.archives[url]?.archiveUrl) {
    kept++;
    continue;
  }
  try {
    // SPN2 without auth: GET https://web.archive.org/save/<url> follows
    // through to the archived copy; the final response URL is the snapshot.
    const res = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'second-corridor-archiver (citation preservation)' },
      signal: AbortSignal.timeout(90000),
    });
    if (res.ok && /web\.archive\.org\/web\//.test(res.url)) {
      prev.archives[url] = { archiveUrl: res.url, archivedAt: STAMP };
      saved++;
      console.log(`  archived: ${url}`);
      await sleep(DELAY_MS);
      continue;
    }
    throw new Error(`save returned HTTP ${res.status}`);
  } catch (e) {
    try {
      const snap = await existingSnapshot(url);
      if (snap) {
        prev.archives[url] = { archiveUrl: snap, archivedAt: STAMP, note: 'existing snapshot' };
        saved++;
        console.log(`  existing snapshot: ${url}`);
      } else {
        failed++;
        console.error(`  FAILED (${e.message?.slice(0, 60)}): ${url}`);
      }
    } catch (e2) {
      failed++;
      console.error(`  FAILED (${e2.message?.slice(0, 60)}): ${url}`);
    }
  }
  await sleep(DELAY_MS);
}

/* R19 — self-archive the SITE, not just its sources: the recommended
   citation says "retrieved <date>", and that must resolve against what the
   site actually said. Always re-saved (no skip) — weekly granularity
   matches the data cadence. Recorded under prev.site so the source-URL
   logic above stays untouched. */
prev.site = prev.site || {};
for (const path of ['', 'methods']) {
  const url = `https://second-corridor.vercel.app/${path}`;
  try {
    const res = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'second-corridor-archiver (citation preservation)' },
      signal: AbortSignal.timeout(90000),
    });
    if (res.ok && /web\.archive\.org\/web\//.test(res.url)) {
      prev.site[url] = { archiveUrl: res.url, archivedAt: STAMP };
      console.log(`  site archived: ${url}`);
    } else {
      console.error(`  site archive failed (HTTP ${res.status}): ${url}`);
    }
  } catch (e) {
    console.error(`  site archive failed (${e.message?.slice(0, 60)}): ${url}`);
  }
  await sleep(DELAY_MS);
}

writeFileSync(OUT_PATH, JSON.stringify(prev));
console.log(`archives.json: ${saved} saved, ${kept} already archived, ${failed} failed of ${urls.length} URLs`);
if (saved === 0 && kept === 0 && urls.length > 0) {
  console.error('ARCHIVE FAIL: nothing archived at all');
  process.exit(1);
}
