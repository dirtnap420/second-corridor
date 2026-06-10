// chart.js — section 02: the derived-series chart. Jobs as a stacked composition
// (constr band hatched, perm copper, supply violet) with the invest line in its
// own strip above. Chart cursor rides the master scrubber.
import { scaleLinear, area as d3area, line as d3line } from 'd3';
import {
  YEAR_MIN,
  YEAR_MAX,
  MILESTONES,
  investAt,
  constrLowAt,
  constrHighAt,
  permAt,
  supplyAt,
  cite,
} from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 980;
const H = 470;
const M = { l: 64, r: 24 };
const INVEST = { top: 30, h: 80 };
const JOBS = { top: 150, h: 270 };

export function initChart(container, { numbersEl }) {
  const x = scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([M.l, W - M.r]);
  const yI = scaleLinear().domain([0, 100]).range([INVEST.top + INVEST.h, INVEST.top]);
  const yJ = scaleLinear().domain([0, 55000]).range([JOBS.top + JOBS.h, JOBS.top]);

  // sample at quarter-year steps
  const ys = [];
  for (let y = YEAR_MIN; y <= YEAR_MAX + 1e-9; y += 0.25) ys.push(y);

  const bandLow = (y) => constrLowAt(y);
  const bandHigh = (y) => constrHighAt(y);
  const permTop = (y) => bandHigh(y) + permAt(y);
  const supplyTop = (y) => permTop(y) + supplyAt(y);

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
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Derived buildout series 2022 to 2045');
  svg.innerHTML = `
    <title>The buildout, 2022–2045</title>
    <desc>Cumulative capital line above a stacked jobs composition: construction workforce band, Micron permanent jobs, and indirect and induced jobs.</desc>
    <defs>
      <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink)" stroke-width="1" opacity="0.55"></line>
      </pattern>
    </defs>`;
  container.appendChild(svg);

  const put = (html) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.innerHTML = html;
    svg.appendChild(g);
    return g;
  };

  /* milestone hairlines + flags (unique years) */
  const uniqYears = [...new Set(MILESTONES.map((m) => m.year))];
  let flags = '';
  uniqYears.forEach((y, i) => {
    const px = x(y);
    const row = i % 2 === 0 ? 12 : 24;
    flags += `<g class="milestone-flag">
      <line x1="${px}" y1="${INVEST.top - 4}" x2="${px}" y2="${JOBS.top + JOBS.h}"></line>
      <text x="${px}" y="${row}" text-anchor="middle">${y}</text>
    </g>`;
  });
  put(flags);

  /* axes */
  let ax = '';
  for (const v of [0, 25, 50, 75, 100]) {
    ax += `<text class="chart-label" x="${M.l - 8}" y="${yI(v) + 3}" text-anchor="end">${v}</text>
           <line x1="${M.l}" x2="${W - M.r}" y1="${yI(v)}" y2="${yI(v)}" stroke="var(--hairline)" stroke-width="0.5"></line>`;
  }
  for (const v of [0, 10000, 20000, 30000, 40000, 50000]) {
    ax += `<text class="chart-label" x="${M.l - 8}" y="${yJ(v) + 3}" text-anchor="end">${v / 1000}K</text>
           <line x1="${M.l}" x2="${W - M.r}" y1="${yJ(v)}" y2="${yJ(v)}" stroke="var(--hairline)" stroke-width="0.5"></line>`;
  }
  for (let y = YEAR_MIN; y <= YEAR_MAX; y += (window.innerWidth < 640 ? 4 : 2) - 0) {
    ax += `<text class="chart-label" x="${x(y)}" y="${JOBS.top + JOBS.h + 18}" text-anchor="middle">${y}</text>`;
  }
  put(ax);

  /* strip labels */
  put(`
    <text class="chart-label" x="${M.l}" y="${INVEST.top - 10}">CUMULATIVE CAPITAL AT CLAY · $B${srcMarks('invest')}</text>
    <text class="chart-label" x="${M.l}" y="${JOBS.top - 10}">JOBS · STACKED${srcMarks('jobs')}</text>
  `);

  /* series */
  put(`
    <path d="${areaGen(bandHigh, permTop)}" fill="var(--copper)" opacity="0.9"></path>
    <path d="${areaGen(permTop, supplyTop)}" fill="var(--violet)" opacity="0.55"></path>
    <path d="${areaGen(bandLow, bandHigh)}" fill="url(#hatch)"></path>
    <path d="${areaGen(bandLow, bandHigh)}" fill="var(--ink)" opacity="0.08"></path>
    <path d="${investLine}" fill="none" stroke="var(--copper)" stroke-width="1.75"></path>
  `);

  /* series key */
  put(`
    <g class="chart-label">
      <rect x="${W - 320}" y="${JOBS.top - 16}" width="9" height="9" fill="url(#hatch)" stroke="var(--ink)" stroke-width="0.5"></rect>
      <text x="${W - 306}" y="${JOBS.top - 8}">CONSTR (BAND)</text>
      <rect x="${W - 214}" y="${JOBS.top - 16}" width="9" height="9" fill="var(--copper)"></rect>
      <text x="${W - 200}" y="${JOBS.top - 8}">PERM</text>
      <rect x="${W - 142}" y="${JOBS.top - 16}" width="9" height="9" fill="var(--violet)" opacity="0.55"></rect>
      <text x="${W - 128}" y="${JOBS.top - 8}">SUPPLY</text>
    </g>
  `);

  /* cursor */
  const cursor = put(`
    <line x1="${x(YEAR_MIN)}" x2="${x(YEAR_MIN)}" y1="${INVEST.top - 4}" y2="${JOBS.top + JOBS.h}" stroke="var(--copper)" stroke-width="1.5"></line>
    <rect x="${x(YEAR_MIN) - 18}" y="${JOBS.top + JOBS.h + 24}" width="36" height="16" fill="var(--copper)"></rect>
    <text x="${x(YEAR_MIN)}" y="${JOBS.top + JOBS.h + 36}" text-anchor="middle" style="font-family:var(--font-mono);font-size:10px;fill:var(--paper)">2022</text>
  `);
  const [cLine, cRect, cText] = cursor.children;

  function srcMarks(which) {
    const keys =
      which === 'invest'
        ? ['micron-100b', 'micron-20b-first-phase']
        : ['constr-3000-4000', 'micron-9000-direct', 'micron-50000-total'];
    return keys
      .filter((k) => cite(k))
      .map((k) => ` [${cite(k)}]`)
      .join('');
  }

  /* numbers table */
  if (numbersEl) {
    let rows = '';
    for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
      rows += `<tr><td>${y}</td><td>${investAt(y).toFixed(1)}</td><td>${Math.round(
        constrLowAt(y)
      )}–${Math.round(constrHighAt(y))}</td><td>${Math.round(permAt(y))}</td><td>${Math.round(
        supplyAt(y)
      )}</td></tr>`;
    }
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Year</th><th>Invest $B${srcMarks('invest')}</th><th>Constr band</th><th>Perm</th><th>Supply</th></tr></thead><tbody>${rows}</tbody>`;
    numbersEl.appendChild(table);
    const note = document.createElement('p');
    note.className = 'method-note';
    note.style.padding = '0 14px 10px';
    note.textContent = 'INTERPOLATED BETWEEN CITED ANCHORS — NOT A FORECAST';
    numbersEl.appendChild(note);
  }

  function update(year) {
    const px = x(year);
    cLine.setAttribute('x1', px);
    cLine.setAttribute('x2', px);
    cRect.setAttribute('x', px - 18);
    cText.setAttribute('x', px);
    cText.textContent = String(Math.floor(year + 1e-6));
  }

  return { update };
}
