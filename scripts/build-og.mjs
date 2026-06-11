// build-og.mjs — renders the 1200×630 OG cards in the design system.
//   default:        public/og.png (the site card, committed) + the per-section
//                   cards (R23) → public/og/fNN.png (gitignored)
//   --cards-only:   just the per-section cards — run by `npm run build`, so a
//                   data refresh redeploy always ships cards with the current
//                   headlines and refresh date. og.png itself stays committed
//                   (cross-platform raster drift would churn the repo).
// Uses the committed woff2 fonts (decompressed to ttf for resvg's font loader).
// Run: npm run og
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import wawoff2 from 'wawoff2';
import { geoConicConformal, geoPath } from 'd3-geo';
import { feature, merge } from 'topojson-client';
import { readSections, latestRetrieved } from './lib/sections.mjs';

const CARDS_ONLY = process.argv.includes('--cards-only');

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

const renderPng = (svg) =>
  new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Archivo' },
  })
    .render()
    .asPng();

/* corridor geometry: real projection of the five nodes + state outline */
const topo = JSON.parse(readFileSync(new URL('public/data/ny-geo.json', root), 'utf8'));
const counties = feature(topo, topo.objects.counties);
const stateShape = merge(topo, topo.objects.counties.geometries);

const NODES = [
  { name: 'STAMP', lonlat: [-78.388, 43.096] },
  { name: 'RIT', lonlat: [-77.674, 43.084], hero: true },
  { name: 'CLAY', lonlat: [-76.17, 43.18] },
  { name: 'MARCY', lonlat: [-75.28, 43.17] },
  { name: 'ALBANY', lonlat: [-73.83, 42.69] },
];

/** Map motif fitted to a panel rect; labels optional (the small cards skip them). */
function mapMotif(rect, { labels = true } = {}) {
  const projection = geoConicConformal()
    .parallels([40.5, 44.5])
    .rotate([76.5, 0])
    .fitExtent(
      [
        [rect.x + 10, rect.y + 10],
        [rect.x + rect.w - 10, rect.y + rect.h - 10],
      ],
      counties
    );
  const path = geoPath(projection);
  const pts = NODES.map((n) => projection(n.lonlat));
  const traceD = 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
  let nodesSvg = '';
  NODES.forEach((n, i) => {
    const [x, y] = pts[i];
    const s = (n.hero ? 16 : 13) * (labels ? 1 : 0.8);
    nodesSvg += `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="${T.copper}" stroke="${T.ink}" stroke-width="1.5"/>`;
    if (labels) {
      const above = i % 2 === 0;
      nodesSvg += `<text x="${x}" y="${above ? y - 14 : y + 26}" text-anchor="middle" font-family="IBM Plex Mono" font-size="15" letter-spacing="1.5" fill="${T.ink}">${n.name}</text>`;
    }
  });
  return `<path d="${path(stateShape)}" fill="${T.paper}" stroke="${T.ink}" stroke-width="1.5"/>
  <path d="${traceD}" fill="none" stroke="${T.copper}" stroke-width="3"/>
  ${nodesSvg}`;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ================= the site card (og.png) ================= */
if (!CARDS_ONLY) {
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${T.silicon}"/>
  <rect x="14.5" y="14.5" width="1171" height="601" fill="none" stroke="${T.ink}" stroke-width="1"/>
  <rect x="20.5" y="20.5" width="1159" height="589" fill="none" stroke="${T.hairline}" stroke-width="1"/>

  ${mapMotif({ x: 600, y: 96, w: 560, h: 460 })}

  <text x="64" y="118" font-family="IBM Plex Mono" font-weight="500" font-size="19" letter-spacing="2.2" fill="${T.copper}">FIELD INSTRUMENT · 2022–2045</text>
  <text x="60" y="208" font-family="Archivo" font-weight="900" font-size="76" letter-spacing="-1" fill="${T.ink}">The Second</text>
  <text x="60" y="288" font-family="Archivo" font-weight="900" font-size="76" letter-spacing="-1" fill="${T.ink}">Corridor</text>

  <text x="64" y="356" font-family="Archivo" font-weight="700" font-size="25" fill="${T.ink}">Tracking New York's semiconductor</text>
  <text x="64" y="390" font-family="Archivo" font-weight="700" font-size="25" fill="${T.ink}">buildout — investment, jobs, and the</text>
  <text x="64" y="424" font-family="Archivo" font-weight="700" font-size="25" fill="${T.ink}">talent pipeline, from public data.</text>

  <line x1="64" y1="540" x2="560" y2="540" stroke="${T.ink}" stroke-width="1"/>
  <text x="64" y="572" font-family="IBM Plex Mono" font-size="15" letter-spacing="1.5" fill="${T.muted}">ALL FIGURES CITED · ESTIMATES LABELED</text>
</svg>`;
  const png = renderPng(svg);
  writeFileSync(new URL('public/og.png', root), png);
  console.log(`og.png written: ${(png.length / 1024).toFixed(1)} KB`);
}

/* ================= per-section cards (R23) ================= */
const sections = readSections();
const refreshed = latestRetrieved();
mkdirSync(new URL('public/og/', root), { recursive: true });

/** greedy word wrap; shrinks the font until the headline fits 3 lines */
function fitHeadline(text, maxWidth) {
  for (const size of [46, 40, 34, 29]) {
    const maxChars = Math.floor(maxWidth / (size * 0.52));
    const lines = [];
    let line = '';
    for (const w of text.split(' ')) {
      if (line && (line + ' ' + w).length > maxChars) {
        lines.push(line);
        line = w;
      } else {
        line = line ? line + ' ' + w : w;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 3) return { size, lines };
  }
  return { size: 29, lines: [text] };
}

for (const s of sections) {
  const head = fitHeadline(s.h2, 600);
  const lineH = head.size * 1.12;
  const headSvg = head.lines
    .map(
      (l, i) =>
        `<text x="60" y="${230 + i * lineH}" font-family="Archivo" font-weight="900" font-size="${head.size}" letter-spacing="-0.5" fill="${T.ink}">${esc(l)}</text>`
    )
    .join('\n  ');
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${T.silicon}"/>
  <rect x="14.5" y="14.5" width="1171" height="601" fill="none" stroke="${T.ink}" stroke-width="1"/>
  <rect x="20.5" y="20.5" width="1159" height="589" fill="none" stroke="${T.hairline}" stroke-width="1"/>

  ${mapMotif({ x: 760, y: 330, w: 380, h: 250 }, { labels: false })}

  <text x="64" y="96" font-family="IBM Plex Mono" font-weight="500" font-size="17" letter-spacing="2.2" fill="${T.copper}">THE SECOND CORRIDOR — FIELD INSTRUMENT</text>
  <text x="60" y="172" font-family="Archivo" font-weight="900" font-size="58" letter-spacing="-1" fill="${T.copper}">Fig. ${s.num}</text>
  ${headSvg}
  <text x="64" y="${230 + head.lines.length * lineH + 18}" font-family="IBM Plex Mono" font-weight="500" font-size="16" letter-spacing="1.8" fill="${T.muted}">${esc(s.eyebrow.toUpperCase())}</text>

  <line x1="64" y1="540" x2="700" y2="540" stroke="${T.ink}" stroke-width="1"/>
  <text x="64" y="570" font-family="IBM Plex Mono" font-size="14" letter-spacing="1.4" fill="${T.muted}">DATA REFRESHED ${refreshed} · ALL FIGURES CITED · ESTIMATES LABELED</text>
  <text x="64" y="594" font-family="IBM Plex Mono" font-size="14" letter-spacing="1.4" fill="${T.muted}">SECOND-CORRIDOR.VERCEL.APP/F/${s.num}</text>
</svg>`;
  writeFileSync(new URL(`public/og/f${s.num}.png`, root), renderPng(svg));
}
console.log(`section cards written: ${sections.length} → public/og/ (refreshed ${refreshed})`);
