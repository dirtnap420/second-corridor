// live.js — sections 06–11: the measured reality. Every panel renders fetched
// public data with vintages printed from provenance, suppression carried
// through, and a view-the-numbers table.
import { registerSources, cite } from './data.js';
import { responsiveMount } from './responsive.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const fmt = (v) => Math.round(v).toLocaleString('en-US');
const fmtUSD = (v) => '$' + Math.round(v).toLocaleString('en-US');

function show(plateId) {
  document.getElementById(plateId).hidden = false;
}

function setVintage(elId, prov) {
  const el = document.getElementById(elId);
  if (el && prov) el.textContent = `${prov.vintage} · retrieved ${prov.retrievedAt}`;
}

function isSupp(v) {
  return v && typeof v === 'object' && (v.suppressed || v.absent);
}

async function fetchJson(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* ================= 06a — QCEW small multiples ================= */
function renderQcew(data) {
  const prov = data.provenance;
  show('qcew-plate');
  setVintage('qcew-vintage', prov);
  const panel = document.getElementById('qcew-panel');

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:18px 22px;justify-content:flex-start';
  panel.appendChild(grid);

  const MW = 212;
  const MH = 128;
  const plotH = 78;
  const n = cite('qcew-data');

  for (const c of data.corridor) {
    const years = c.series.map((s) => s.year);
    const vals = c.series.map((s) => (isSupp(s.semi) ? null : s.semi));
    const max = Math.max(40, ...vals.filter((v) => v !== null));
    const latest = c.series[c.series.length - 1];
    const bw = Math.floor((MW - 30) / years.length) - 6;

    let bars = '';
    c.series.forEach((s, i) => {
      const x = 26 + i * (bw + 6);
      if (isSupp(s.semi)) {
        bars += `<rect x="${x}" y="${20 + plotH - 26}" width="${bw}" height="26" fill="url(#hatch-s)" stroke="var(--muted)" stroke-width="0.5" opacity="0.7"></rect>
        <text x="${x + bw / 2}" y="${20 + plotH - 32}" text-anchor="middle" class="chart-label">S</text>`;
      } else {
        const h = Math.max(1.5, (s.semi / max) * plotH);
        bars += `<rect x="${x}" y="${20 + plotH - h}" width="${bw}" height="${h}" fill="var(--copper)"></rect>`;
      }
      bars += `<text x="${x + bw / 2}" y="${20 + plotH + 12}" text-anchor="middle" class="chart-label">${String(s.year).slice(2)}</text>`;
    });

    const latestLabel = isSupp(latest.semi)
      ? 'suppressed (BLS confidentiality)'
      : latest.semi === 0
        ? 'no covered NAICS-3344 employers'
        : `${fmt(latest.semi)} · ${((latest.semi / latest.total) * 100).toFixed(1)}% of county emp.`;

    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0';
    fig.innerHTML = `
      <svg width="${MW}" height="${MH}" viewBox="0 0 ${MW} ${MH}" role="img" aria-label="NAICS 3344 employment, ${c.name} County">
        <title>${c.name} County semiconductor employment</title>
        <defs><pattern id="hatch-s" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--muted)" stroke-width="1"></line></pattern></defs>
        <text x="0" y="11" class="chart-label" style="fill:var(--ink);font-weight:500">${c.name.toUpperCase()} (${c.fips})</text>
        <text x="0" y="${20 + plotH - 2}" class="chart-label" transform="rotate(-90 10 ${20 + plotH - 2})" ></text>
        <text x="22" y="${20 + 8}" text-anchor="end" class="chart-label">${max >= 1000 ? (max / 1000).toFixed(1) + 'K' : max}</text>
        <line x1="26" y1="${20 + plotH}" x2="${MW - 4}" y2="${20 + plotH}" stroke="var(--hairline)"></line>
        ${bars}
        <text x="0" y="${MH - 2}" class="chart-label">${latestLabel}</text>
      </svg>`;
    grid.appendChild(fig);
  }

  /* numbers table */
  const numbersEl = document.getElementById('qcew-numbers');
  const years = data.corridor[0].series.map((s) => s.year);
  let head = `<tr><th>County</th>${years.map((y) => `<th>${y}</th>`).join('')}<th>Source</th></tr>`;
  let rows = '';
  for (const c of data.corridor) {
    rows += `<tr><td>${c.name}</td>${c.series
      .map((s) => `<td>${isSupp(s.semi) ? 'suppr.' : fmt(s.semi)}</td>`)
      .join('')}<td>[${n}]</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead>${head}</thead><tbody>${rows}</tbody>`;
  numbersEl.appendChild(table);
}

/* ================= 06b — OEWS wage strip ================= */
function renderOews(data) {
  const prov = data.provenance;
  show('oews-plate');
  setVintage('oews-vintage', prov);
  const panel = document.getElementById('oews-panel');
  const n = cite('oews-data');

  const cell = (d) => {
    if (!d || d.absent) return '<td>not published</td>';
    if (isSupp(d.median) || d.median === null || d.median === undefined)
      return d && d.topcoded ? '<td>≥ top code</td>' : '<td>suppressed</td>';
    return `<td>${fmtUSD(d.median)}</td>`;
  };

  const table = document.createElement('table');
  table.className = 'mono';
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px';
  table.innerHTML = `
    <thead><tr>
      <th style="text-align:left">SOC · occupation</th>
      <th>Rochester median</th><th>Syracuse median</th><th>National median</th>
    </tr></thead>
    <tbody>${data.occupations
      .map(
        (o) => `<tr>
        <td style="text-align:left">${o.soc} · ${o.title}</td>
        ${cell(o.rochester)}${cell(o.syracuse)}${cell(o.national)}
      </tr>`
      )
      .join('')}</tbody>`;
  // mono table chrome
  for (const td of table.querySelectorAll('td,th')) {
    td.style.padding = '7px 10px';
    td.style.borderTop = '1px dotted var(--hairline)';
    if (!td.style.textAlign) td.style.textAlign = 'right';
  }
  panel.appendChild(table);

  const numbersEl = document.getElementById('oews-numbers');
  let rows = '';
  for (const o of data.occupations) {
    const e = (d) =>
      !d || d.absent ? '—' : isSupp(d.emp) || d.emp == null ? 'suppr.' : fmt(d.emp);
    rows += `<tr><td>${o.soc} ${o.title}</td><td>${e(o.rochester)}</td><td>${e(
      o.syracuse
    )}</td><td>${e(o.national)}</td><td>[${n}]</td></tr>`;
  }
  const t2 = document.createElement('table');
  t2.innerHTML = `<thead><tr><th>Employment</th><th>Rochester</th><th>Syracuse</th><th>National</th><th>Source</th></tr></thead><tbody>${rows}</tbody>`;
  numbersEl.appendChild(t2);
}

/* ================= 06c — IPEDS stacked bars ================= */
function renderIpeds(data) {
  const prov = data.provenance;
  show('ipeds-plate');
  setVintage('ipeds-vintage', prov);
  const n = cite('ipeds-data');

  const INSTS = [
    { key: 'Rochester Institute of Technology', short: 'RIT', color: 'var(--copper)' },
    { key: 'Monroe Community College', short: 'MCC', color: 'var(--violet)' },
    { key: 'Finger Lakes Community College', short: 'FLCC', color: 'var(--green)' },
  ];
  const instOf = (name) =>
    INSTS.find((i) => name.toLowerCase().includes(i.short.toLowerCase()) || name === i.key) ||
    INSTS.find((i) => name.toLowerCase().startsWith(i.key.toLowerCase().slice(0, 9)));

  // totals per year × inst
  const years = [...new Set(data.series.map((s) => s.year))].sort();
  const byYear = {};
  for (const y of years) byYear[y] = { RIT: 0, MCC: 0, FLCC: 0 };
  for (const s of data.series) {
    const inst = instOf(s.inst);
    if (!inst) continue;
    byYear[s.year][inst.short] += (s.cert || 0) + (s.assoc || 0) + (s.bach || 0) + (s.grad || 0);
  }

  const mount = document.getElementById('ipeds-panel');
  responsiveMount(mount, (w) => {
    const W = Math.max(330, w);
    const H = 300;
    const M = { l: 44, r: 8, t: 20, b: 36 };
    const maxTotal = Math.max(...years.map((y) => byYear[y].RIT + byYear[y].MCC + byYear[y].FLCC));
    const yMax = Math.ceil(maxTotal / 50) * 50;
    const bw = Math.min(64, ((W - M.l - M.r) / years.length) * 0.62);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Completions by year and institution');
    let html = `<title>Degrees and certificates by year</title>`;
    for (const v of [0, yMax / 2, yMax]) {
      const y = M.t + (H - M.t - M.b) * (1 - v / yMax);
      html += `<line x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}" stroke="var(--hairline)" stroke-width="0.5"></line>
        <text x="${M.l - 6}" y="${y + 3}" text-anchor="end" class="chart-label">${v}</text>`;
    }
    years.forEach((yr, i) => {
      const cx = M.l + ((i + 0.5) * (W - M.l - M.r)) / years.length;
      let y0 = H - M.b;
      for (const inst of INSTS) {
        const v = byYear[yr][inst.short];
        const h = ((H - M.t - M.b) * v) / yMax;
        if (v > 0)
          html += `<rect x="${cx - bw / 2}" y="${y0 - h}" width="${bw}" height="${h}" fill="${inst.color}" opacity="${inst.short === 'MCC' ? 0.65 : 0.9}"></rect>`;
        y0 -= h;
      }
      html += `<text x="${cx}" y="${H - M.b + 14}" text-anchor="middle" class="chart-label">${yr}</text>`;
    });
    // key
    let kx = M.l;
    for (const inst of INSTS) {
      html += `<rect x="${kx}" y="4" width="9" height="9" fill="${inst.color}" opacity="${inst.short === 'MCC' ? 0.65 : 0.9}"></rect>
        <text x="${kx + 13}" y="12" class="chart-label">${inst.short}</text>`;
      kx += 62;
    }
    svg.innerHTML = html;
    mount.appendChild(svg);
    return {};
  });

  // footnote: exact CIP codes + titles
  const foot = document.getElementById('ipeds-footnote');
  foot.innerHTML = `<span>CIP ${data.cips
    .map((c) => `${c.code} (${c.title})`)
    .join(' · ')} · latest completions year ${years[years.length - 1]} — IPEDS lags ~2 years.</span>`;

  const numbersEl = document.getElementById('ipeds-numbers');
  let rows = '';
  for (const s of data.series) {
    rows += `<tr><td>${s.year}</td><td>${s.inst}</td><td>${s.cert || 0}</td><td>${s.assoc || 0}</td><td>${s.bach || 0}</td><td>${s.grad || 0}</td><td>[${n}]</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Year</th><th>Institution</th><th>Certs</th><th>Assoc</th><th>Bach</th><th>Grad+</th><th>Source</th></tr></thead><tbody>${rows}</tbody>`;
  numbersEl.appendChild(table);
}

/* ================= boot ================= */
export async function initLive() {
  const [qcew, oews, ipeds] = await Promise.all([
    fetchJson('/data/qcew.json'),
    fetchJson('/data/oews.json'),
    fetchJson('/data/ipeds.json'),
  ]);

  // register data sources into the numbered sources list (after the Phase 0 set)
  const entries = [];
  if (qcew)
    entries.push({
      keys: ['qcew-data'],
      title: 'Quarterly Census of Employment and Wages — NAICS 3344, corridor counties',
      publisher: 'U.S. Bureau of Labor Statistics',
      url: 'https://www.bls.gov/cew/',
      date: qcew.provenance.vintage,
      retrieved: qcew.provenance.retrievedAt,
    });
  if (oews)
    entries.push({
      keys: ['oews-data'],
      title: 'Occupational Employment and Wage Statistics — metro wage files',
      publisher: 'U.S. Bureau of Labor Statistics',
      url: 'https://www.bls.gov/oes/',
      date: oews.provenance.vintage,
      retrieved: oews.provenance.retrievedAt,
    });
  if (ipeds)
    entries.push({
      keys: ['ipeds-data'],
      title: 'IPEDS completions by 6-digit CIP (via Urban Institute Education Data API)',
      publisher: 'NCES / Urban Institute',
      url: 'https://educationdata.urban.org/',
      date: ipeds.provenance.vintage,
      retrieved: ipeds.provenance.retrievedAt,
    });
  registerSources(entries);

  if (qcew) renderQcew(qcew);
  if (oews) renderOews(oews);
  if (ipeds) renderIpeds(ipeds);

  return { qcew, oews, ipeds };
}
