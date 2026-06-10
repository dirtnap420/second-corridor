// build-og.mjs — renders the 1200×630 OG card in the design system → public/og.png.
// Uses the committed woff2 fonts (decompressed to ttf for resvg's font loader).
// Run: npm run og
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import wawoff2 from 'wawoff2';
import { geoConicConformal, geoPath } from 'd3-geo';
import { feature, merge } from 'topojson-client';

const root = new URL('..', import.meta.url);
const T = {
  silicon: '#E8EAEF',
  paper: '#F7F8FB',
  ink: '#14161D',
  muted: '#5B5F6F',
  copper: '#B5562A',
  hairline: '#D4D7E0',
};

/* fonts: woff2 → ttf into .cache/fonts */
mkdirSync(new URL('.cache/fonts/', root), { recursive: true });
const fontFiles = [];
for (const f of [
  'archivo-v25-latin-700.woff2',
  'archivo-v25-latin-900.woff2',
  'ibm-plex-mono-v20-latin-regular.woff2',
  'ibm-plex-mono-v20-latin-500.woff2',
]) {
  const woff2 = readFileSync(new URL(`public/fonts/${f}`, root));
  const ttf = await wawoff2.decompress(woff2);
  const out = fileURLToPath(new URL(`.cache/fonts/${f.replace('.woff2', '.ttf')}`, root));
  writeFileSync(out, ttf);
  fontFiles.push(out);
}

/* corridor geometry: real projection of the five nodes + state outline */
const topo = JSON.parse(readFileSync(new URL('public/data/ny-geo.json', root), 'utf8'));
const counties = feature(topo, topo.objects.counties);
const stateShape = merge(topo, topo.objects.counties.geometries);

// map panel occupies the right side of the card
const MAP = { x: 600, y: 96, w: 560, h: 460 };
const projection = geoConicConformal()
  .parallels([40.5, 44.5])
  .rotate([76.5, 0])
  .fitExtent(
    [
      [MAP.x + 10, MAP.y + 10],
      [MAP.x + MAP.w - 10, MAP.y + MAP.h - 10],
    ],
    counties
  );
const path = geoPath(projection);

const NODES = [
  { name: 'STAMP', lonlat: [-78.388, 43.096] },
  { name: 'RIT', lonlat: [-77.674, 43.084], hero: true },
  { name: 'CLAY', lonlat: [-76.17, 43.18] },
  { name: 'MARCY', lonlat: [-75.28, 43.17] },
  { name: 'ALBANY', lonlat: [-73.83, 42.69] },
];
const pts = NODES.map((n) => projection(n.lonlat));
const traceD = 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');

let nodesSvg = '';
NODES.forEach((n, i) => {
  const [x, y] = pts[i];
  const s = n.hero ? 16 : 13;
  const above = i % 2 === 0;
  nodesSvg += `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="${T.copper}" stroke="${T.ink}" stroke-width="1.5"/>
  <text x="${x}" y="${above ? y - 14 : y + 26}" text-anchor="middle" font-family="IBM Plex Mono" font-size="15" letter-spacing="1.5" fill="${T.ink}">${n.name}</text>`;
});

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${T.silicon}"/>
  <rect x="14.5" y="14.5" width="1171" height="601" fill="none" stroke="${T.ink}" stroke-width="1"/>
  <rect x="20.5" y="20.5" width="1159" height="589" fill="none" stroke="${T.hairline}" stroke-width="1"/>

  <path d="${path(stateShape)}" fill="${T.paper}" stroke="${T.ink}" stroke-width="1.5"/>
  <path d="${traceD}" fill="none" stroke="${T.copper}" stroke-width="3"/>
  ${nodesSvg}

  <text x="64" y="118" font-family="IBM Plex Mono" font-weight="500" font-size="19" letter-spacing="2.2" fill="${T.copper}">FIELD INSTRUMENT · 2022–2045</text>
  <text x="60" y="208" font-family="Archivo" font-weight="900" font-size="76" letter-spacing="-1" fill="${T.ink}">The Second</text>
  <text x="60" y="288" font-family="Archivo" font-weight="900" font-size="76" letter-spacing="-1" fill="${T.ink}">Corridor</text>

  <text x="64" y="356" font-family="Archivo" font-weight="700" font-size="25" fill="${T.ink}">Tracking New York's semiconductor</text>
  <text x="64" y="390" font-family="Archivo" font-weight="700" font-size="25" fill="${T.ink}">buildout — investment, jobs, and the</text>
  <text x="64" y="424" font-family="Archivo" font-weight="700" font-size="25" fill="${T.ink}">talent pipeline, from public data.</text>

  <line x1="64" y1="540" x2="560" y2="540" stroke="${T.ink}" stroke-width="1"/>
  <text x="64" y="572" font-family="IBM Plex Mono" font-size="15" letter-spacing="1.5" fill="${T.muted}">ALL FIGURES CITED · ESTIMATES LABELED</text>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Archivo' },
});
const png = resvg.render().asPng();
writeFileSync(new URL('public/og.png', root), png);
console.log(`og.png written: ${(png.length / 1024).toFixed(1)} KB`);
