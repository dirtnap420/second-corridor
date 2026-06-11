// chart.js — section 02: the derived-series chart. Jobs as a stacked area
// (perm copper + supply violet, stack top = the cited ~50,000 total) with the
// constr band overlaid at its own cited values (ink hatch between band edges).
// The invest line rides in its own strip above. Cursor follows the scrubber.
// F9: scoped imports — no meta-package guesswork for the bundler
import { scaleLinear } from 'd3-scale';
import { area as d3area, line as d3line } from 'd3-shape';
import { onTick } from './ticker.js';
import {
  YEAR_MIN,
  YEAR_MAX,
  TODAY,
  MILESTONES,
  investAt,
  constrLowAt,
  constrHighAt,
  permAt,
  supplyAt,
  cite,
} from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let wipeSeq = 0; // S40: unique clipPath ids across responsive re-mounts

function srcMarks(keys) {
  return [...new Set(keys.map((k) => cite(k)).filter(Boolean))].map((n) => ` [${n}]`).join('');
}

export function renderChart(container, width, qcew = null, commitYear = null) {
  const W = Math.max(330, width);
  const narrow = W < 620;
  const H = narrow ? 420 : 470;
  // D23: wide layouts reserve a right gutter for series end-labels
  const M = { l: narrow ? 44 : 60, r: narrow ? 14 : 106 };
  const INVEST = { top: 36, h: narrow ? 64 : 80 };
  const JOBS = { top: INVEST.top + INVEST.h + 44, h: H - (INVEST.top + INVEST.h + 44) - 50 };

  const x = scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([M.l, W - M.r]);
  const yI = scaleLinear().domain([0, 100]).range([INVEST.top + INVEST.h, INVEST.top]);
  const yJ = scaleLinear().domain([0, 52000]).range([JOBS.top + JOBS.h, JOBS.top]);

  const ys = [];
  for (let y = YEAR_MIN; y <= YEAR_MAX + 1e-9; y += 0.25) ys.push(y);

  const areaGen = (y0fn, y1fn) =>
    d3area()
      .x((d) => x(d))
      .y0((d) => yJ(y0fn(d)))
      .y1((d) => yJ(y1fn(d)))(ys);

  const investLine = d3line()
    .x((d) => x(d))
    .y((d) => yI(investAt(d)))(ys);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Derived buildout series 2022 to 2045');
  svg.innerHTML = `
    <title>The buildout, 2022–2045</title>
    <desc>Cumulative capital line above a stacked jobs area: Micron permanent jobs and indirect and induced jobs, with the construction workforce band overlaid.</desc>
    <defs>
      <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" stroke-width="1" opacity="0.6"></line>
      </pattern>
    </defs>`;
  container.appendChild(svg);

  const put = (html) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.innerHTML = html;
    svg.appendChild(g);
    return g;
  };

  /* milestone hairlines + rotated mono flags — D4: below 620px the rotated
     year labels collide (2022–2030 cluster), so narrow widths keep the
     hairlines and drop the labels */
  const uniqYears = [...new Set(MILESTONES.map((m) => m.year))];
  const flagLabels = W >= 620;
  let flags = '';
  for (const y of uniqYears) {
    const px = x(y);
    flags += `<g class="milestone-flag">
      <line x1="${px}" y1="${INVEST.top - 6}" x2="${px}" y2="${JOBS.top + JOBS.h}"></line>
      ${flagLabels ? `<text transform="rotate(-90 ${px} ${INVEST.top - 10})" x="${px}" y="${INVEST.top - 10}" text-anchor="start">${y}</text>` : ''}
    </g>`;
  }
  put(flags);

  /* S17: the TODAY hairline — visibly splits the derived series into
     history behind us and interpolation ahead (the caption's "not a
     forecast" made visible). Same flag typography, copper, always shown. */
  const tx = x(TODAY);
  put(`
    <line x1="${tx}" y1="${INVEST.top - 6}" x2="${tx}" y2="${JOBS.top + JOBS.h}" stroke="var(--copper)" stroke-width="1.25" stroke-dasharray="4 3"></line>
    <text transform="rotate(-90 ${tx} ${INVEST.top - 10})" x="${tx}" y="${INVEST.top - 10}" text-anchor="end" class="chart-label" style="fill:var(--copper-text);font-weight:500">TODAY</text>
  `);

  /* axes */
  let ax = '';
  for (const v of [0, 50, 100]) {
    ax += `<text class="chart-label" x="${M.l - 6}" y="${yI(v) + 3}" text-anchor="end">${v}</text>
           <line x1="${M.l}" x2="${W - M.r}" y1="${yI(v)}" y2="${yI(v)}" stroke="var(--hairline)" stroke-width="0.5"></line>`;
  }
  const jTicks = narrow ? [0, 25000, 50000] : [0, 10000, 20000, 30000, 40000, 50000];
  for (const v of jTicks) {
    ax += `<text class="chart-label" x="${M.l - 6}" y="${yJ(v) + 3}" text-anchor="end">${v / 1000}K</text>
           <line x1="${M.l}" x2="${W - M.r}" y1="${yJ(v)}" y2="${yJ(v)}" stroke="var(--hairline)" stroke-width="0.5"></line>`;
  }
  const step = narrow ? 4 : 2;
  for (let y = 2022; y <= YEAR_MAX; y += step) {
    ax += `<text class="chart-label" x="${x(y)}" y="${JOBS.top + JOBS.h + 16}" text-anchor="middle">${y}</text>`;
  }
  put(ax);

  /* axis titles (rotated, clear of the flag zone) */
  put(`
    <text class="chart-label" transform="rotate(-90 12 ${INVEST.top + INVEST.h})" x="12" y="${INVEST.top + INVEST.h}" text-anchor="start">CAPITAL $B${srcMarks(['micron-100b', 'micron-20b-first-phase'])}</text>
    <text class="chart-label" transform="rotate(-90 12 ${JOBS.top + JOBS.h})" x="12" y="${JOBS.top + JOBS.h}" text-anchor="start">JOBS${srcMarks(['constr-3000-4000', 'micron-9000-direct', 'micron-50000-total'])}</text>
  `);

  /* series: perm + supply stacked; constr band overlaid at its cited values */
  const gSeries = put(`
    <path d="${areaGen(() => 0, permAt)}" fill="var(--copper)" opacity="0.9"></path>
    <path d="${areaGen(permAt, (d) => permAt(d) + supplyAt(d))}" fill="var(--violet)" opacity="0.5"></path>
    <path d="${areaGen(constrLowAt, constrHighAt)}" fill="url(#hatch)"></path>
    <path d="${areaGen(constrLowAt, constrHighAt)}" fill="none" stroke="var(--ink)" stroke-width="0.75" opacity="0.5"></path>
    <path d="${investLine}" fill="none" stroke="var(--copper)" stroke-width="1.75"></path>
  `);

  /* S23 (approved): the measured Onondaga QCEW series at true scale — the
     thesis image: 52,000 promised against hundreds measured, one frame, one
     scale. The flatness IS the statement (spike decision: floor-line, no
     inset); the callout carries what the pixels can't. */
  let gMeasured = null;
  const onoSeries = qcew?.corridor
    ?.find((c) => c.fips === '36067')
    ?.series.filter((s) => s.year >= YEAR_MIN && typeof s.semi === 'number');
  if (onoSeries && onoSeries.length >= 2) {
    const nQ = cite('qcew-data');
    const d = onoSeries
      .map((s, i) => `${i ? 'L' : 'M'}${x(s.year).toFixed(1)},${yJ(s.semi).toFixed(1)}`)
      .join('');
    const last = onoSeries[onoSeries.length - 1];
    const lx = x(last.year);
    const ly = yJ(last.semi);
    const calloutY = ly - (narrow ? 34 : 44);
    gMeasured = put(`
      <path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2"></path>
      <line x1="${lx}" y1="${ly - 3}" x2="${lx}" y2="${calloutY + 4}" stroke="var(--hairline)" stroke-width="1"></line>
      <text class="chart-label" x="${Math.min(lx, W - M.r - 10)}" y="${calloutY}" text-anchor="${narrow ? 'middle' : 'start'}" style="fill:var(--ink);font-weight:500">ONONDAGA NAICS-3344, MEASURED — ANNUAL · ${last.semi.toLocaleString('en-US')} AT ${last.year}${nQ ? ` [${nQ}]` : ''}</text>
    `);
  }

  /* S40: pen-draw on first reveal — a left-to-right clip wipe over the
     series (areas can't dash-draw), consistent with the plotter identity.
     Reduced motion renders static; the clip rect starts FULL so print and
     captures can never see a half-drawn chart. One shot per mount. */
  if (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    'IntersectionObserver' in window
  ) {
    const clipId = `s40-wipe-${++wipeSeq}`;
    svg.querySelector('defs').innerHTML += `<clipPath id="${clipId}"><rect x="0" y="0" width="${W}" height="${H}"></rect></clipPath>`;
    const clipRect = svg.querySelector(`#${clipId} rect`);
    gSeries.setAttribute('clip-path', `url(#${clipId})`);
    if (gMeasured) gMeasured.setAttribute('clip-path', `url(#${clipId})`);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const DUR = 700;
        clipRect.setAttribute('width', 0);
        const unsub = onTick((now) => {
          const k = Math.min(1, (now - t0) / DUR);
          clipRect.setAttribute('width', (W * k).toFixed(1));
          if (k >= 1) unsub();
        });
      },
      { threshold: 0.3 }
    );
    io.observe(svg);
  }

  /* D23: direct end-labels in the right gutter replace the key at wide
     widths (narrow keeps the wrapped key — a 96px gutter costs too much
     of a 330px plate) */
  if (!narrow) {
    const ex = x(YEAR_MAX) + 6;
    put(`
      <g class="chart-label">
        <text x="${ex}" y="${yJ(permAt(YEAR_MAX) / 2) + 3}" style="fill:var(--copper-text);font-weight:500">PERM ${Math.round(permAt(YEAR_MAX)).toLocaleString('en-US')}</text>
        <text x="${ex}" y="${yJ(permAt(YEAR_MAX) + supplyAt(YEAR_MAX) / 2) + 3}" style="fill:var(--violet);font-weight:500">SUPPLY ~${Math.round(supplyAt(YEAR_MAX)).toLocaleString('en-US')}</text>
        <rect x="${x(2036) - 5}" y="${yJ(constrHighAt(2036)) - 16}" width="9" height="9" fill="url(#hatch)" stroke="var(--ink)" stroke-width="0.5"></rect>
        <text x="${x(2036) + 8}" y="${yJ(constrHighAt(2036)) - 8}">CONSTR BAND</text>
      </g>
    `);
  }

  /* key — narrow widths only (D23's end-labels replace it from 620px up;
     a 96px label gutter costs too much of a 330px plate) */
  if (narrow) {
    const keyY = JOBS.top - 14;
    const keyX = M.l;
    const keyWrap = W < 420;
    const row1Y = keyWrap ? keyY - 15 : keyY; // wrap upward into the gap band
    const supX = keyWrap ? keyX : keyX + 172;
    put(`
      <g class="chart-label">
        <rect x="${keyX}" y="${row1Y - 9}" width="9" height="9" fill="url(#hatch)" stroke="var(--ink)" stroke-width="0.5"></rect>
        <text x="${keyX + 14}" y="${row1Y}">CONSTR BAND</text>
        <rect x="${keyX + 106}" y="${row1Y - 9}" width="9" height="9" fill="var(--copper)"></rect>
        <text x="${keyX + 120}" y="${row1Y}">PERM</text>
        <rect x="${supX}" y="${keyY - 9}" width="9" height="9" fill="var(--violet)" opacity="0.5"></rect>
        <text x="${supX + 14}" y="${keyY}">SUPPLY (STACKED ON PERM)</text>
      </g>
    `);
  }

  /* cursor: hairline + year tag + a carriage square riding the invest line
     with its live value */
  const cursor = put(`
    <line x1="${x(YEAR_MIN)}" x2="${x(YEAR_MIN)}" y1="${INVEST.top - 6}" y2="${JOBS.top + JOBS.h}" stroke="var(--copper)" stroke-width="1.5"></line>
    <rect x="${x(YEAR_MIN) - 17}" y="${JOBS.top + JOBS.h + 22}" width="34" height="15" fill="var(--copper)"></rect>
    <text x="${x(YEAR_MIN)}" y="${JOBS.top + JOBS.h + 33}" text-anchor="middle" style="font-family:var(--font-mono);font-size:10px;fill:var(--paper)">2022</text>
    <rect x="${x(YEAR_MIN) - 3}" y="${yI(0) - 3}" width="6" height="6" fill="var(--copper)" stroke="var(--ink)" stroke-width="1"></rect>
    <text x="${x(YEAR_MIN) + 9}" y="${yI(0) - 6}" class="chart-label" style="fill:var(--copper);font-weight:500">$0.0B</text>
  `);
  const [cLine, cRect, cText, cDot, cVal] = cursor.children;

  /* D24≡S24 (approved): hover-scrub — a crosshair previews the derived
     values at the pointer's year; click commits it to the master scrubber.
     Every chart becoming a controller is the site's signature move.
     Desktop only: narrow viewports drive the real scrubber. */
  if (!narrow) {
    const hover = put(`
      <g style="display:none;pointer-events:none">
        <line x1="0" x2="0" y1="${INVEST.top - 6}" y2="${JOBS.top + JOBS.h}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3"></line>
        <text class="chart-label" x="${M.l}" y="${H - 4}" style="font-weight:500;paint-order:stroke;stroke:var(--silicon);stroke-width:3px"></text>
      </g>
    `);
    const [hLine, hText] = hover.children;
    const yrOf = (e) => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (W / r.width);
      return Math.max(YEAR_MIN, Math.min(YEAR_MAX, YEAR_MIN + ((px - M.l) / (W - M.l - M.r)) * (YEAR_MAX - YEAR_MIN)));
    };
    svg.addEventListener('pointermove', (e) => {
      const yrI = Math.floor(yrOf(e) + 1e-6);
      const px = x(yrI);
      hover.style.display = '';
      hLine.setAttribute('x1', px);
      hLine.setAttribute('x2', px);
      const lo = Math.round(constrLowAt(yrI));
      const hi = Math.round(constrHighAt(yrI));
      hText.textContent =
        `${yrI} · INVESTED $${investAt(yrI).toFixed(1)}B${srcMarks(['micron-100b', 'micron-20b-first-phase'])}` +
        ` · CONSTRUCTION ${lo === hi ? lo.toLocaleString('en-US') : `${lo.toLocaleString('en-US')}–${hi.toLocaleString('en-US')}`}${srcMarks(['constr-3000-4000'])}` +
        ` · PERMANENT ${Math.round(permAt(yrI)).toLocaleString('en-US')}${srcMarks(['micron-9000-direct'])}` +
        ` · SUPPLY & INDUCED ${Math.round(supplyAt(yrI)).toLocaleString('en-US')}${srcMarks(['micron-50000-total'])}`;
    });
    svg.addEventListener('pointerleave', () => {
      hover.style.display = 'none';
    });
    if (commitYear) {
      svg.addEventListener('click', (e) => commitYear(Math.floor(yrOf(e) + 1e-6)));
      svg.style.cursor = 'crosshair';
    }
  }

  function update(year) {
    const px = x(year);
    cLine.setAttribute('x1', px);
    cLine.setAttribute('x2', px);
    cRect.setAttribute('x', px - 17);
    cText.setAttribute('x', px);
    cText.textContent = String(Math.floor(year + 1e-6));
    const iy = yI(investAt(year));
    cDot.setAttribute('x', px - 3);
    cDot.setAttribute('y', iy - 3);
    const flip = px > W - 90;
    cVal.setAttribute('x', flip ? px - 9 : px + 9);
    cVal.setAttribute('text-anchor', flip ? 'end' : 'start');
    cVal.setAttribute('y', iy - 6);
    cVal.textContent = `$${investAt(year).toFixed(1)}B`;
  }

  return { update };
}

export function buildChartNumbers(numbersEl) {
  let rows = '';
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    rows += `<tr><td>${y}</td><td>${investAt(y).toFixed(1)}</td><td>${Math.round(
      constrLowAt(y)
    )}–${Math.round(constrHighAt(y))}</td><td>${Math.round(permAt(y))}</td><td>${Math.round(
      supplyAt(y)
    )}</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Year</th><th>Invest $B${srcMarks(['micron-100b', 'micron-20b-first-phase'])}</th><th>Constr band${srcMarks(['constr-3000-4000'])}</th><th>Perm${srcMarks(['micron-9000-direct'])}</th><th>Supply${srcMarks(['micron-50000-total'])}</th></tr></thead><tbody>${rows}</tbody>`;
  numbersEl.appendChild(table);
  const note = document.createElement('p');
  note.className = 'method-note';
  note.style.padding = '0 14px 10px';
  note.textContent = 'INTERPOLATED BETWEEN CITED ANCHORS — NOT A FORECAST';
  numbersEl.appendChild(note);
}
