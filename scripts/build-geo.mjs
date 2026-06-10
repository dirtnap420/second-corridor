// build-geo.mjs — us-atlas counties-10m → NY counties TopoJSON, simplified + quantized.
// Emits public/data/ny-geo.json: a TopoJSON topology with objects {counties, state},
// `state` being the merged outline. Target: <25KB on disk.
// Run: npm run geo
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { feature, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';

const atlasPath = fileURLToPath(import.meta.resolve('us-atlas/counties-10m.json'));
const us = JSON.parse(readFileSync(atlasPath, 'utf8'));

const all = feature(us, us.objects.counties);
const ny = all.features.filter((f) => String(f.id).startsWith('36'));
if (ny.length !== 62) {
  throw new Error(`Expected 62 NY counties, got ${ny.length} — us-atlas schema changed?`);
}

// Keep only id + name; drop everything else.
const counties = {
  type: 'FeatureCollection',
  features: ny.map((f) => ({
    type: 'Feature',
    id: f.id,
    properties: { name: f.properties.name },
    geometry: f.geometry,
  })),
};

// Rebuild a topology from the NY subset so shared borders stay topologically merged,
// then simplify (retain ~35% of detail) and re-quantize to ~0.005° resolution.
let topo = topology({ counties }, 1e6);
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 1 - 0.35));
// NY spans ~7.6° of longitude; 0.005° steps → ~1520 cells. Use 2000 for margin.
topo = quantize(topo, 2000);

topo.provenance = {
  source: 'U.S. Census Bureau cartographic boundaries via us-atlas (counties-10m)',
  url: 'https://github.com/topojson/us-atlas',
  retrievedAt: new Date().toISOString().slice(0, 10),
  vintage: 'us-atlas 3.x (Census 2017 cartographic boundary files)',
  notes:
    'FIPS 36 counties only; topology simplified to ~35% detail and quantized to ~0.005°. State outline derived client-side via topojson.merge.',
};

const out = JSON.stringify(topo);
writeFileSync(new URL('../public/data/ny-geo.json', import.meta.url), out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log(`ny-geo.json written: ${kb} KB, ${ny.length} counties`);
if (Buffer.byteLength(out) > 25 * 1024) {
  throw new Error(`ny-geo.json is ${kb} KB — exceeds the 25KB geometry budget`);
}
