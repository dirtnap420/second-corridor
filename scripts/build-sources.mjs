// build-sources.mjs — P32: emit the consolidated citation registry as
// public/data/sources.json, with the exact footnote numbering the site
// renders (static Phase 0 entries first, then the live-dataset entries in
// LIVE_SOURCE_DEFS order). One canonical list for the Wayback archiver
// (P27), the link-health job (P29), and the reach plan's surfaces.
// Deterministic: content changes only when sources or vintages change.
// Run by `npm run build` before vite copies public/.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOURCE_LIST } from '../src/data.js';
import '../src/sources.js'; // registers the static entries
import { LIVE_SOURCE_DEFS } from '../src/live-sources.js';

const root = new URL('..', import.meta.url);

// join live defs with each dataset's provenance, mirroring live.js
for (const d of LIVE_SOURCE_DEFS) {
  const p = fileURLToPath(new URL(`public/data/${d.dataset}.json`, root));
  if (!existsSync(p)) continue;
  const prov = JSON.parse(readFileSync(p, 'utf8')).provenance;
  SOURCE_LIST.push({
    keys: [d.key],
    title: d.title,
    publisher: d.publisher,
    url: d.url,
    date: prov.vintage,
    retrieved: prov.retrievedAt,
    n: SOURCE_LIST.length + 1,
  });
}

const out = {
  schemaVersion: 1,
  sources: SOURCE_LIST.map((s) => ({
    n: s.n,
    keys: s.keys,
    title: s.title,
    publisher: s.publisher,
    url: s.url,
    date: s.date,
    retrieved: s.retrieved,
  })),
};

writeFileSync(
  fileURLToPath(new URL('public/data/sources.json', root)),
  JSON.stringify(out)
);
console.log(`sources.json written: ${out.sources.length} entries`);
