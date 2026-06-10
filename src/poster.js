// poster.js — composes a self-contained A2-proportioned SVG of the instrument
// at the current scrub year: title block, corridor map, milestone ledger,
// series strip, sources footer, colophon. Fonts embedded as data URIs so the
// file is portable. Dynamically imported when the EXPORT POSTER control is
// used; never part of the main bundle.
import { geoConicConformal, geoPath, line as d3line, curveCatmullRom, area as d3area, scaleLinear } from 'd3';
import { feature, mesh, merge } from 'topojson-client';
import {
  NODES,
  MILESTONES,
  SOURCE_LIST,
  YEAR_MIN,
  YEAR_MAX,
  investAt,
  constrLowAt,
  constrHighAt,
  permAt,
  supplyAt,
  cite,
} from './data.js';

const W = 1122; // A2 proportion (1 : √2)
const H = 1587;
const T = {
  silicon: '#E8EAEF',
  paper: '#F7F8FB',
  ink: '#14161D',
  muted: '#5B5F6F',
  copper: '#B5562A',
  violet: '#565880',
  hairline: '#D4D7E0',
};

async function fontDataUri(path) {
  const buf = await fetch(path).then((r) => r.arrayBuffer());
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:font/woff2;base64,${btoa(bin)}`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function composePoster({ year }) {
  const y = Math.floor(year);
  const [a700, a900, m400, m500, topo] = await Promise.all([
    fontDataUri('/fonts/archivo-v25-latin-700.woff2'),
    fontDataUri('/fonts/archivo-v25-latin-900.woff2'),
    fontDataUri('/fonts/ibm-plex-mono-v20-latin-regular.woff2'),
    fontDataUri('/fonts/ibm-plex-mono-v20-latin-500.woff2'),
    fetch('/data/ny-geo.json').then((r) => r.json()),
  ]);

  /* ---------- map block ---------- */
  const MAP = { x: 56, y: 240, w: W - 112, h: 480 };
  const counties = feature(topo, topo.objects.counties);
  const projection = geoConicConformal()
    .parallels([40.5, 44.5])
    .rotate([76.5, 0])
    .fitExtent(
      [
        [MAP.x + 12, MAP.y + 12],
        [MAP.x + MAP.w - 12, MAP.y + MAP.h - 12],
      ],
      counties
    );
  const path = geoPath(projection);
  const stateShape = merge(topo, topo.objects.counties.geometries);
  const interior = mesh(topo, topo.objects.counties, (a, b) => a !== b);
  const pts = NODES.map((n) => projection(n.lonlat));
  const traceD = d3line()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(curveCatmullRom.alpha(0.7))(pts);

  let nodesSvg = '';
  NODES.forEach((n, i) => {
    const [x, py] = pts[i];
    const active = y >= n.activeFrom;
    const s = n.hero ? 16 : 13;
    const above = i % 2 === 0;
    nodesSvg += `<rect x="${x - s / 2}" y="${py - s / 2}" width="${s}" height="${s}" fill="${
      active ? T.copper : T.paper
    }" stroke="${T.ink}" stroke-width="1.25"/>
    <text x="${x}" y="${above ? py - 14 : py + 26}" text-anchor="middle" font-family="IBM Plex Mono" font-size="13" letter-spacing="1.2" fill="${T.ink}">${n.name}</text>`;
  });

  /* ---------- series strip ---------- */
  const CH = { x: 56, y: 760, w: W - 112, h: 250 };
  const xs = scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([CH.x + 50, CH.x + CH.w - 16]);
  const yI = scaleLinear().domain([0, 100]).range([CH.y + 70, CH.y + 10]);
  const yJ = scaleLinear().domain([0, 52000]).range([CH.y + CH.h, CH.y + 100]);
  const ys = [];
  for (let yy = YEAR_MIN; yy <= YEAR_MAX + 1e-9; yy += 0.25) ys.push(yy);
  const areaGen = (y0fn, y1fn) =>
    d3area()
      .x((d) => xs(d))
      .y0((d) => yJ(y0fn(d)))
      .y1((d) => yJ(y1fn(d)))(ys);
  const investLine = d3line()
    .x((d) => xs(d))
    .y((d) => yI(investAt(d)))(ys);

  /* ---------- ledger ---------- */
  const LG = { x: 56, y: 1072, w: 560 };
  const LROW = 18.5;
  let ledger = '';
  const curYear = [...MILESTONES].filter((mm) => mm.year <= y).map((mm) => mm.year).pop();
  MILESTONES.forEach((m, i) => {
    const ly = LG.y + 22 + i * LROW;
    if (m.year === curYear) {
      ledger += `<rect x="${LG.x - 6}" y="${ly - 12}" width="${LG.w + 6}" height="${LROW - 1.5}" fill="${T.silicon}"/>
        <rect x="${LG.x - 6}" y="${ly - 12}" width="3" height="${LROW - 1.5}" fill="${T.copper}"/>`;
    }
    ledger += `<text x="${LG.x + 4}" y="${ly}" font-family="IBM Plex Mono" font-weight="500" font-size="11" fill="${m.year <= y ? T.ink : T.muted}">${m.year}</text>
      <text x="${LG.x + 50}" y="${ly}" font-family="IBM Plex Mono" font-size="11" fill="${m.year <= y ? T.ink : T.muted}">${esc(m.label)}</text>`;
  });

  /* ---------- readouts column ---------- */
  const RD = { x: 660, y: 1072 };
  const lo = constrLowAt(y);
  const hi = constrHighAt(y);
  const readouts = [
    ['CUMULATIVE INVESTMENT', `$${investAt(y).toFixed(1)}B`],
    ['CONSTRUCTION WORKFORCE', lo === hi ? `${Math.round(lo).toLocaleString('en-US')}` : `${Math.round(lo).toLocaleString('en-US')}–${Math.round(hi).toLocaleString('en-US')}`],
    ['PERMANENT JOBS', Math.round(permAt(y)).toLocaleString('en-US')],
    ['INDIRECT & INDUCED (DERIVED)', Math.round(supplyAt(y)).toLocaleString('en-US')],
  ];
  let readoutSvg = '';
  readouts.forEach(([label, val], i) => {
    const ry = RD.y + 30 + i * 74;
    readoutSvg += `<text x="${RD.x}" y="${ry}" font-family="IBM Plex Mono" font-size="10.5" letter-spacing="1.2" fill="${T.muted}">${label}</text>
      <text x="${RD.x}" y="${ry + 34}" font-family="IBM Plex Mono" font-weight="500" font-size="32" fill="${T.ink}">${val}</text>`;
  });

  /* ---------- sources footer (four columns) ---------- */
  const SRC = { x: 56, y: 1376, colW: (W - 112) / 4 };
  const perCol = Math.ceil(SOURCE_LIST.length / 4);
  let sources = '';
  SOURCE_LIST.forEach((s, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const sx = SRC.x + col * SRC.colW;
    const sy = SRC.y + 14 + row * 10.5;
    const text = `[${s.n}] ${s.publisher} — ${s.title}`.slice(0, 44);
    sources += `<text x="${sx}" y="${sy}" font-family="IBM Plex Mono" font-size="6.8" fill="${T.muted}">${esc(text)}… (${esc(String(s.date).slice(0, 10))})</text>`;
  });

  /* ---------- title block ---------- */
  const drawn = new Date().toISOString().slice(0, 10);
  const rev = typeof __BUILD_REV__ !== 'undefined' ? __BUILD_REV__ : 'dev';
  const TB = { x: 40, y: H - 96, w: W - 80, h: 56 };
  const cells = [
    ['THE SECOND CORRIDOR', 0.3],
    ['SHEET 1 OF 1', 0.14],
    [`YEAR ${y}`, 0.14],
    [`DRAWN ${drawn}`, 0.22],
    [`REV ${rev}`, 0.2],
  ];
  let titleBlock = `<rect x="${TB.x}" y="${TB.y}" width="${TB.w}" height="${TB.h}" fill="${T.paper}" stroke="${T.ink}" stroke-width="1.25"/>`;
  let cx = TB.x;
  for (const [label, frac] of cells) {
    const cw = TB.w * frac;
    titleBlock += `<line x1="${cx}" y1="${TB.y}" x2="${cx}" y2="${TB.y + TB.h}" stroke="${T.ink}" stroke-width="1"/>
      <text x="${cx + 14}" y="${TB.y + 34}" font-family="IBM Plex Mono" font-weight="500" font-size="13" letter-spacing="1.2" fill="${T.ink}">${label}</text>`;
    cx += cw;
  }

  /* ---------- compose ---------- */
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><style>
    @font-face{font-family:'Archivo';font-weight:700;src:url('${a700}') format('woff2')}
    @font-face{font-family:'Archivo';font-weight:900;src:url('${a900}') format('woff2')}
    @font-face{font-family:'IBM Plex Mono';font-weight:400;src:url('${m400}') format('woff2')}
    @font-face{font-family:'IBM Plex Mono';font-weight:500;src:url('${m500}') format('woff2')}
  </style>
  <pattern id="phatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="${T.ink}" stroke-width="1" opacity="0.55"/>
  </pattern></defs>

  <rect width="${W}" height="${H}" fill="${T.silicon}"/>
  <rect x="40.5" y="40.5" width="${W - 81}" height="${H - 81}" fill="none" stroke="${T.ink}" stroke-width="1.5"/>
  <rect x="48.5" y="48.5" width="${W - 97}" height="${H - 97}" fill="none" stroke="${T.hairline}" stroke-width="1"/>

  <text x="56" y="96" font-family="IBM Plex Mono" font-weight="500" font-size="15" letter-spacing="2" fill="${T.copper}">FIELD INSTRUMENT · NY SEMICONDUCTOR BUILDOUT · 2022–2045</text>
  <text x="56" y="164" font-family="Archivo" font-weight="900" font-size="64" letter-spacing="-1" fill="${T.ink}">The Second Corridor</text>
  <text x="56" y="200" font-family="Archivo" font-weight="700" font-size="19" fill="${T.ink}">Investment, jobs, and the talent pipeline between Buffalo and Albany — from public data, at year ${y}.</text>
  <text x="${W - 56}" y="164" text-anchor="end" font-family="IBM Plex Mono" font-weight="500" font-size="58" fill="${T.copper}">${y}</text>

  <rect x="${MAP.x}" y="${MAP.y}" width="${MAP.w}" height="${MAP.h}" fill="${T.paper}" stroke="${T.ink}" stroke-width="1"/>
  <path d="${path(stateShape)}" fill="${T.silicon}" stroke="none"/>
  <path d="${path(interior)}" fill="none" stroke="${T.hairline}" stroke-width="0.6"/>
  <path d="${path(stateShape)}" fill="none" stroke="${T.ink}" stroke-width="1.25"/>
  <path d="${traceD}" fill="none" stroke="${T.hairline}" stroke-width="1.5" stroke-dasharray="3 3"/>
  ${nodesSvg}
  <text x="${MAP.x + 10}" y="${MAP.y + MAP.h - 12}" font-family="IBM Plex Mono" font-size="10" letter-spacing="1" fill="${T.muted}">FIG. 01 — THE CORRIDOR · NODE STATE AT ${y} · CONIC CONFORMAL</text>

  <rect x="${CH.x}" y="${CH.y - 24}" width="${CH.w}" height="${CH.h + 56}" fill="${T.paper}" stroke="${T.ink}" stroke-width="1"/>
  <text x="${CH.x + 10}" y="${CH.y - 6}" font-family="IBM Plex Mono" font-size="10" letter-spacing="1" fill="${T.muted}">FIG. 02 — DERIVED SERIES · INTERPOLATED BETWEEN CITED ANCHORS — NOT A FORECAST</text>
  <path d="${areaGen(() => 0, permAt)}" fill="${T.copper}" opacity="0.9"/>
  <path d="${areaGen(permAt, (d) => permAt(d) + supplyAt(d))}" fill="${T.violet}" opacity="0.5"/>
  <path d="${areaGen(constrLowAt, constrHighAt)}" fill="url(#phatch)"/>
  <path d="${investLine}" fill="none" stroke="${T.copper}" stroke-width="1.75"/>
  <line x1="${xs(y)}" y1="${CH.y}" x2="${xs(y)}" y2="${CH.y + CH.h}" stroke="${T.copper}" stroke-width="1.5"/>
  <text x="${CH.x + 14}" y="${yI(0) + 4}" font-family="IBM Plex Mono" font-size="9" fill="${T.muted}">$B</text>
  <text x="${CH.x + 14}" y="${yJ(0) + 4}" font-family="IBM Plex Mono" font-size="9" fill="${T.muted}">JOBS</text>
  <text x="${xs(YEAR_MIN)}" y="${CH.y + CH.h + 20}" font-family="IBM Plex Mono" font-size="10" fill="${T.muted}">2022</text>
  <text x="${xs(YEAR_MAX)}" y="${CH.y + CH.h + 20}" text-anchor="end" font-family="IBM Plex Mono" font-size="10" fill="${T.muted}">2045</text>

  <text x="${LG.x}" y="${LG.y - 6}" font-family="IBM Plex Mono" font-size="10" letter-spacing="1" fill="${T.muted}">MILESTONE LEDGER · CITED RECORD</text>
  ${ledger}
  ${readoutSvg}

  <line x1="56" y1="${SRC.y - 10}" x2="${W - 56}" y2="${SRC.y - 10}" stroke="${T.hairline}" stroke-width="1"/>
  <text x="56" y="${SRC.y}" font-family="IBM Plex Mono" font-size="9" letter-spacing="1" fill="${T.muted}">SOURCES — RETRIEVED 2026-06-10 · FULL CITATIONS AT SECOND-CORRIDOR.VERCEL.APP</text>
  ${sources}

  ${titleBlock}
  <text x="${W - 56}" y="${H - 110}" text-anchor="end" font-family="IBM Plex Mono" font-size="8.5" letter-spacing="1" fill="${T.muted}">BUILT BY [NAME] · [CONTACT/URL] · ALL FIGURES CITED · ESTIMATES LABELED</text>
</svg>`;

  return { svg, year: y };
}

export async function exportPoster({ year }) {
  const { svg, year: y } = await composePoster({ year });
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `second-corridor-${y}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
