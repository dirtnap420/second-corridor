// live.js — sections 06–11: the measured reality. Every panel renders fetched
// public data with vintages printed from provenance, suppression carried
// through, and a view-the-numbers table.
import { registerSources, cite, COMPARATORS, PHYS_ANCHORS } from './data.js';
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
  // the wage table can overflow narrow plates and scrolls inside the panel —
  // a scrollable region needs keyboard access (axe: scrollable-region-focusable)
  panel.setAttribute('tabindex', '0');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Wages table, corridor metros vs national — scrollable');
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
    { key: 'Onondaga Community College', short: 'OCC', color: 'var(--ink)' },
    { key: 'Finger Lakes Community College', short: 'FLCC', color: 'var(--green)' },
  ];
  const instOf = (name) =>
    INSTS.find((i) => name.toLowerCase().includes(i.short.toLowerCase()) || name === i.key) ||
    INSTS.find((i) => name.toLowerCase().startsWith(i.key.toLowerCase().slice(0, 9)));

  // totals per year × inst (suppressed band cells count as unknown, not zero —
  // none occur in current data; the numbers table carries the distinction)
  const num = (v) => (typeof v === 'number' ? v : 0);
  const years = [...new Set(data.series.map((s) => s.year))].sort();
  const byYear = {};
  for (const y of years) byYear[y] = Object.fromEntries(INSTS.map((i) => [i.short, 0]));
  for (const s of data.series) {
    const inst = instOf(s.inst);
    if (!inst) continue;
    byYear[s.year][inst.short] += num(s.cert) + num(s.assoc) + num(s.bach) + num(s.grad);
  }

  const mount = document.getElementById('ipeds-panel');
  responsiveMount(mount, (w) => {
    const W = Math.max(330, w);
    const H = 300;
    const M = { l: 44, r: 8, t: 20, b: 36 };
    const maxTotal = Math.max(
      ...years.map((y) => INSTS.reduce((a, i) => a + byYear[y][i.short], 0))
    );
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
          html += `<rect x="${cx - bw / 2}" y="${y0 - h}" width="${bw}" height="${h}" fill="${inst.color}" opacity="${inst.short === 'MCC' ? 0.65 : inst.short === 'OCC' ? 0.78 : 0.9}"></rect>`;
        y0 -= h;
      }
      html += `<text x="${cx}" y="${H - M.b + 14}" text-anchor="middle" class="chart-label">${yr}</text>`;
    });
    // key
    let kx = M.l;
    for (const inst of INSTS) {
      html += `<rect x="${kx}" y="4" width="9" height="9" fill="${inst.color}" opacity="${inst.short === 'MCC' ? 0.65 : inst.short === 'OCC' ? 0.78 : 0.9}"></rect>
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

/* ================= 07 — the labor shed (LODES) ================= */
function renderLodes(data) {
  show('lodes-plate');
  setVintage('lodes-vintage', data.provenance);
  const panel = document.getElementById('lodes-panel');
  const n = cite('lodes-data');

  const TOP = 12;
  const rows = data.origins.slice(0, TOP);
  const restJobs =
    data.origins.slice(TOP).reduce((a, o) => a + o.jobs, 0) + (data.otherJobs || 0);
  const max = rows[0].jobs;

  const wrap = document.createElement('div');
  wrap.className = 'mono';
  wrap.style.cssText = 'font-size:12px';
  let html = '';
  rows.forEach((o, i) => {
    const isMonroe = o.fips === '36055';
    const w = Math.max(0.5, (o.jobs / max) * 100);
    html += `<div style="display:grid;grid-template-columns:minmax(110px,150px) 1fr 130px;gap:10px;align-items:center;padding:4px 0;border-top:1px dotted var(--hairline)">
      <span style="${isMonroe ? 'color:var(--copper);font-weight:500' : ''}">${i + 1}. ${o.name}, ${o.state}</span>
      <span aria-hidden="true" style="display:block;height:13px;width:${w}%;background:${isMonroe ? 'var(--copper)' : 'var(--ink)'};opacity:${isMonroe ? 1 : 0.78}"></span>
      <span style="text-align:right;color:var(--muted)">${fmt(o.jobs)} · ${(o.share * 100).toFixed(1)}%</span>
    </div>`;
  });
  html += `<div style="display:grid;grid-template-columns:minmax(110px,150px) 1fr 130px;gap:10px;align-items:center;padding:4px 0;border-top:1px dotted var(--hairline);color:var(--muted)">
      <span>all other counties</span>
      <span aria-hidden="true" style="display:block;height:13px;width:${(restJobs / max) * 100}%;background:var(--ink);opacity:0.25"></span>
      <span style="text-align:right">${fmt(restJobs)} · ${((restJobs / data.totalJobs) * 100).toFixed(1)}%</span>
    </div>`;
  const monroeRank = data.origins.findIndex((o) => o.fips === '36055') + 1;
  html += `<p class="method-note" style="margin-top:12px">MONROE COUNTY (ROCHESTER) RANKS #${monroeRank} · THE SEVEN CORRIDOR COUNTIES HOLD ${(data.corridorShare * 100).toFixed(1)}% OF ONONDAGA'S ${fmt(data.totalJobs)} JOBS [${n}]</p>`;
  wrap.innerHTML = html;
  panel.appendChild(wrap);

  const numbersEl = document.getElementById('lodes-numbers');
  let trows = '';
  for (const o of data.origins) {
    trows += `<tr><td>${o.name}, ${o.state}</td><td>${fmt(o.jobs)}</td><td>${(o.share * 100).toFixed(2)}%</td><td>[${n}]</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Home county</th><th>Jobs</th><th>Share</th><th>Source</th></tr></thead><tbody>${trows}</tbody>`;
  numbersEl.appendChild(table);
}

/* ================= 08 — follow the money (USAspending) ================= */
function renderSpending(data) {
  show('spending-plate');
  const prov = data.provenance;
  const el = document.getElementById('spending-vintage');
  if (el) el.textContent = `as recorded in USAspending, retrieved ${prov.retrievedAt}`;
  const panel = document.getElementById('spending-panel');
  const nUSA = cite('usaspending-data');
  const nNIST = cite('chips-direct-6_1b');
  const n8K = cite('chips-direct-8k');
  const nNSF = cite('emerge-micro-2024');

  const bar = (v, maxV, color, hatch) =>
    `<span aria-hidden="true" style="display:block;height:10px;width:${Math.max(0.5, (v / maxV) * 100)}%;background:${color}${hatch ? ';opacity:0.45' : ''}"></span>`;

  const nsf = data.awards.find((a) => a.kind === 'nsf-emerge' || a.fain === '2347157');
  const rows = [];

  // CHIPS direct funding — announced per Commerce/SEC; not published to USAspending
  rows.push(`
    <div style="border-top:1px solid var(--hairline);padding:12px 0">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span style="font-weight:500">CHIPS direct funding — Micron NY + ID (Dept. of Commerce / NIST)</span>
        <span style="color:var(--muted)">FAIN: not published</span>
      </div>
      <div style="display:grid;grid-template-columns:110px 1fr 150px;gap:8px;align-items:center;margin-top:8px">
        <span style="color:var(--muted)">ANNOUNCED</span>
        <span aria-hidden="true" style="display:block;height:10px;width:100%;background:var(--copper)"></span>
        <span style="text-align:right">$6.165B <a class="cite" href="#sources">[${nNIST}]</a><a class="cite" href="#sources">[${n8K}]</a></span>
      </div>
      <div style="display:grid;grid-template-columns:110px 1fr 150px;gap:8px;align-items:center;margin-top:4px">
        <span style="color:var(--muted)">OBLIGATED</span>
        <span style="border:1px dotted var(--muted);height:10px"></span>
        <span style="text-align:right;color:var(--muted)">not published</span>
      </div>
      <div style="display:grid;grid-template-columns:110px 1fr 150px;gap:8px;align-items:center;margin-top:4px">
        <span style="color:var(--muted)">OUTLAID</span>
        <span style="border:1px dotted var(--muted);height:10px"></span>
        <span style="text-align:right;color:var(--muted)">not published</span>
      </div>
      <p class="method-note" style="margin-top:8px">AS OF RETRIEVAL, COMMERCE HAS PUBLISHED NO AWARD RECORD FOR THE MICRON FUNDING AGREEMENTS TO USASPENDING — THE ONLY CHIPS INCENTIVES (CFDA 11.037) AWARD RECORDS ARE THE TSMC AND SK HYNIX LOANS. THE ABSENCE IS THE DATAPOINT. [${nUSA}]</p>
    </div>`);

  if (nsf) {
    const ann = 999997;
    rows.push(`
    <div style="border-top:1px solid var(--hairline);padding:12px 0">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span style="font-weight:500">NSF EMERGE-MICRO — RIT + MCC + FLCC (cooperative agreement)</span>
        <span style="color:var(--muted)"><a href="${nsf.profileUrl}" rel="noopener">FAIN ${nsf.fain}</a></span>
      </div>
      <div style="display:grid;grid-template-columns:110px 1fr 150px;gap:8px;align-items:center;margin-top:8px">
        <span style="color:var(--muted)">ANNOUNCED</span>
        ${bar(ann, ann, 'var(--copper)')}
        <span style="text-align:right">$999,997 <a class="cite" href="#sources">[${nNSF}]</a></span>
      </div>
      <div style="display:grid;grid-template-columns:110px 1fr 150px;gap:8px;align-items:center;margin-top:4px">
        <span style="color:var(--muted)">OBLIGATED</span>
        ${bar(nsf.obligated, ann, 'var(--violet)')}
        <span style="text-align:right">${fmtUSD(nsf.obligated)} <a class="cite" href="#sources">[${nUSA}]</a></span>
      </div>
      <div style="display:grid;grid-template-columns:110px 1fr 150px;gap:8px;align-items:center;margin-top:4px">
        <span style="color:var(--muted)">OUTLAID</span>
        ${bar(0.0001, ann, 'var(--green)')}
        <span style="text-align:right;color:var(--muted)">$0 reported to date</span>
      </div>
    </div>`);
  }

  const wrap = document.createElement('div');
  wrap.className = 'mono';
  wrap.style.cssText = 'font-size:12px';
  wrap.innerHTML = rows.join('');
  panel.appendChild(wrap);

  const numbersEl = document.getElementById('spending-numbers');
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Award</th><th>Announced</th><th>Obligated</th><th>Outlaid</th><th>Source</th></tr></thead>
    <tbody>
      <tr><td>CHIPS direct funding (Micron NY+ID)</td><td>$6,165,000,000 (up to)</td><td>not published</td><td>not published</td><td>[${nNIST}][${n8K}][${nUSA}]</td></tr>
      ${nsf ? `<tr><td>NSF EMERGE-MICRO (FAIN ${nsf.fain})</td><td>$999,997</td><td>${fmtUSD(nsf.obligated)}</td><td>$0 reported</td><td>[${nNSF}][${nUSA}]</td></tr>` : ''}
    </tbody>`;
  numbersEl.appendChild(table);
}

/* ================= 09 — the other corridors (comparator QCEW) ================= */
function renderComparators(qcew) {
  show('comp-plate');
  setVintage('comp-vintage', qcew.provenance);
  const panel = document.getElementById('comp-panel');
  const nQ = cite('qcew-data');

  const MAXM = 73; // common clock: months 0..72 since announcement

  const mount = panel;
  responsiveMount(mount, (w) => {
    const W = Math.max(330, w);
    const SH = 86; // strip height
    const M = { l: 56, r: 96 };
    const frag = document.createDocumentFragment();

    for (const c of COMPARATORS) {
      const series = qcew.comparators.find((x) => x.fips === c.fips);
      if (!series) continue;
      const annIdx = series.months.findIndex((m) => m.ym === c.announced + '-01' || m.ym.startsWith(c.announced));
      const months = annIdx >= 0 ? series.months.slice(annIdx) : [];
      const vals = months.map((m) => (isSupp(m.emp) ? null : m.emp));
      const known = vals.filter((v) => v !== null);
      const allSupp = known.length === 0;
      const maxV = allSupp ? 1 : Math.max(...known);
      const nA = cite(c.src);

      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${SH}`);
      svg.setAttribute('width', W);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `${c.project} — NAICS 3344 employment since announcement`);
      const x = (mi) => M.l + (mi / MAXM) * (W - M.l - M.r);
      const y = (v) => 16 + (SH - 34) * (1 - v / maxV);
      let html = `<title>${c.project}</title>
        <line x1="${M.l}" y1="${SH - 18}" x2="${W - M.r}" y2="${SH - 18}" stroke="var(--hairline)"></line>`;
      for (let m = 0; m <= 72; m += 12) {
        html += `<line x1="${x(m)}" y1="${SH - 18}" x2="${x(m)}" y2="${SH - 14}" stroke="var(--muted)" stroke-width="1"></line>
          <text x="${x(m)}" y="${SH - 4}" text-anchor="middle" class="chart-label">${m}</text>`;
      }
      if (allSupp) {
        html += `<rect x="${M.l}" y="14" width="${W - M.l - M.r - 4}" height="${SH - 34}" fill="url(#hatch-s9)" opacity="0.5"></rect>
          <text x="${(W - M.r + M.l) / 2}" y="${SH / 2}" text-anchor="middle" class="chart-label">ALL MONTHS SUPPRESSED (BLS CONFIDENTIALITY)</text>`;
      } else {
        let d = '';
        let pen = false;
        months.forEach((m, i) => {
          if (i > MAXM) return;
          if (isSupp(m.emp)) {
            pen = false;
            return;
          }
          d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(m.emp).toFixed(1)}`;
          pen = true;
        });
        html += `<path d="${d}" fill="none" stroke="${c.hero ? 'var(--copper)' : 'var(--ink)'}" stroke-width="${c.hero ? 2 : 1.25}"></path>`;
        const last = known[known.length - 1];
        html += `<text x="${W - M.r + 6}" y="${y(last) + 3}" class="chart-label" style="fill:${c.hero ? 'var(--copper)' : 'var(--ink)'}">${fmt(last)}</text>`;
      }
      html += `<text x="0" y="11" class="chart-label" style="fill:${c.hero ? 'var(--copper)' : 'var(--ink)'};font-weight:500">${c.project.toUpperCase()} · ${c.name.toUpperCase()} · ANN. ${c.announced} [${nA}]</text>`;
      svg.innerHTML = `<defs><pattern id="hatch-s9" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--muted)" stroke-width="1"></line></pattern></defs>` + html;
      svg.style.marginTop = '10px';
      frag.appendChild(svg);
    }
    const axisNote = document.createElement('p');
    axisNote.className = 'method-note';
    axisNote.textContent = `X: MONTHS SINCE PUBLIC ANNOUNCEMENT · Y: COUNTY NAICS-3344 EMPLOYMENT, INDEPENDENT SCALE PER STRIP [${nQ}]`;
    frag.appendChild(axisNote);
    mount.appendChild(frag);
    return {};
  });

  const numbersEl = document.getElementById('comp-numbers');
  let trows = '';
  for (const c of COMPARATORS) {
    const series = qcew.comparators.find((x) => x.fips === c.fips);
    if (!series) continue;
    const latest = [...series.months].reverse().find((m) => !isSupp(m.emp));
    trows += `<tr><td>${c.project} (${c.name})</td><td>${c.announced}</td><td>${
      latest ? `${fmt(latest.emp)} (${latest.ym})` : 'all suppressed'
    }</td><td>[${cite(c.src)}][${nQ}]</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Project</th><th>Announced</th><th>Latest NAICS-3344 emp.</th><th>Sources</th></tr></thead><tbody>${trows}</tbody>`;
  numbersEl.appendChild(table);
}

/* ================= 10a — building permits (BPS) ================= */
function renderBps(data) {
  show('bps-plate');
  setVintage('bps-vintage', data.provenance);
  const panel = document.getElementById('bps-panel');
  const n = cite('bps-data');

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:18px 22px';
  panel.appendChild(grid);

  const MW = 300;
  const MH = 120;
  const plotH = 72;

  for (const c of data.counties) {
    const years = c.series.map((s) => s.year);
    const max = Math.max(...c.series.map((s) => s.units));
    const x0 = 30;
    const span = MW - x0 - 6;
    const bw = Math.floor(span / (years.length + 1)) - 3;
    let bars = '';
    c.series.forEach((s, i) => {
      const x = x0 + i * (bw + 3);
      const h = Math.max(1, (s.units / max) * plotH);
      bars += `<rect x="${x}" y="${16 + plotH - h}" width="${bw}" height="${h}" fill="var(--ink)" opacity="0.78"></rect>`;
      if (s.year % 5 === 0)
        bars += `<text x="${x + bw / 2}" y="${16 + plotH + 12}" text-anchor="middle" class="chart-label">${s.year}</text>`;
    });
    // event hairlines: 2022 announcement, 2026 groundbreaking (just past the last bar)
    const xOf = (yr) => x0 + (yr - years[0]) * (bw + 3) + bw / 2;
    let events = '';
    if (years.includes(2022))
      events += `<line x1="${xOf(2022)}" y1="10" x2="${xOf(2022)}" y2="${16 + plotH}" stroke="var(--copper)" stroke-width="1"></line>
      <text x="${xOf(2022)}" y="8" text-anchor="middle" class="chart-label" style="fill:var(--copper)">ANN.</text>`;
    const gx = xOf(years[years.length - 1]) + bw + 3;
    // D35: end-anchored just left of the hairline — middle-anchored at the
    // panel's right edge it clipped in every panel
    events += `<line x1="${gx}" y1="10" x2="${gx}" y2="${16 + plotH}" stroke="var(--copper)" stroke-width="1" stroke-dasharray="2 3"></line>
      <text x="${gx - 3}" y="8" text-anchor="end" class="chart-label" style="fill:var(--copper)">GB. '26</text>`;

    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0';
    fig.innerHTML = `<svg width="${MW}" height="${MH}" viewBox="0 0 ${MW} ${MH}" role="img" aria-label="Housing units permitted per year, ${c.name} County">
      <title>${c.name} County housing permits</title>
      <text x="0" y="11" class="chart-label" style="fill:var(--ink);font-weight:500">${c.name.toUpperCase()}</text>
      <text x="${x0 - 5}" y="${16 + 8}" text-anchor="end" class="chart-label">${max}</text>
      <line x1="${x0}" y1="${16 + plotH}" x2="${MW - 4}" y2="${16 + plotH}" stroke="var(--hairline)"></line>
      ${bars}${events}
      <text x="0" y="${MH - 2}" class="chart-label">${c.series[c.series.length - 1].year}: ${fmt(c.series[c.series.length - 1].units)} UNITS</text>
    </svg>`;
    grid.appendChild(fig);
  }

  const numbersEl = document.getElementById('bps-numbers');
  const years = data.counties[0].series.map((s) => s.year);
  let trows = '';
  for (const c of data.counties) {
    trows += `<tr><td>${c.name}</td>${c.series.map((s) => `<td>${s.units}</td>`).join('')}<td>[${n}]</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>County</th>${years.map((y) => `<th>${String(y).slice(2)}</th>`).join('')}<th>Src</th></tr></thead><tbody>${trows}</tbody>`;
  numbersEl.appendChild(table);
}

/* ================= 10b — attainment mix (ACS) ================= */
function renderAcs(data) {
  show('acs-plate');
  setVintage('acs-vintage', data.provenance);
  const panel = document.getElementById('acs-panel');
  const n = cite('acs-data');

  const BANDS = [
    { key: 'lessHS', label: 'LESS THAN HS', color: 'var(--hairline)' },
    { key: 'hs', label: 'HS / GED', color: 'var(--muted)' },
    { key: 'someCollege', label: 'SOME COLLEGE / ASSOC.', color: 'var(--violet)' },
    { key: 'baPlus', label: "BACHELOR'S+", color: 'var(--copper)' },
  ];

  const wrap = document.createElement('div');
  wrap.className = 'mono';
  wrap.style.cssText = 'font-size:12px';
  let html = `<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px">${BANDS.map(
    (b) =>
      `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:10px;letter-spacing:0.08em"><span style="width:10px;height:10px;background:${b.color};display:inline-block"></span>${b.label}</span>`
  ).join('')}</div>`;

  for (const c of data.counties) {
    const segs = BANDS.map((b) => ({ ...b, share: c[b.key] / c.pop25 }));
    html += `<div style="display:grid;grid-template-columns:minmax(96px,130px) 1fr 64px;gap:10px;align-items:center;padding:4px 0;border-top:1px dotted var(--hairline)">
      <span>${c.name}</span>
      <span style="display:flex;height:14px">${segs
        .map(
          (s) =>
            `<span aria-hidden="true" style="width:${(s.share * 100).toFixed(2)}%;background:${s.color}"></span>`
        )
        .join('')}</span>
      <span style="text-align:right;color:var(--muted)">${((c.baPlus / c.pop25) * 100).toFixed(0)}% BA+</span>
    </div>`;
  }
  wrap.innerHTML = html;
  panel.appendChild(wrap);

  const numbersEl = document.getElementById('acs-numbers');
  let trows = '';
  for (const c of data.counties) {
    trows += `<tr><td>${c.name}</td><td>${fmt(c.pop25)}</td><td>${fmt(c.lessHS)}</td><td>${fmt(c.hs)}</td><td>${fmt(c.someCollege)}</td><td>${fmt(c.baPlus)}</td><td>[${n}]</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>County</th><th>Pop 25+</th><th>&lt;HS</th><th>HS/GED</th><th>Some coll./assoc.</th><th>BA+</th><th>Src</th></tr></thead><tbody>${trows}</tbody>`;
  numbersEl.appendChild(table);
}

/* ================= 11 — physical inputs (NYISO + cited anchors) ================= */
function renderPhys(nyiso) {
  // power anchors require their citation; the panel ships with fewer numbers, never soft ones
  const powerOk = PHYS_ANCHORS.power.every((p) => cite(p.src));
  const waterOk = cite(PHYS_ANCHORS.water.src);
  if (!nyiso && !powerOk && !waterOk) return;
  show('phys-plate');
  const nG = cite('nyiso-goldbook');
  const nW = cite('feis-water');
  const nN = cite('nyiso-data');

  const latestFull = nyiso ? [...nyiso.annual].reverse().find((a) => !a.partial) : null;
  const el = document.getElementById('phys-vintage');
  if (el)
    el.textContent = `NYISO Gold Book 2026-04 · FEIS 2025-11 · zone load ${nyiso ? nyiso.provenance.retrievedAt : ''}`;

  const panel = document.getElementById('phys-panel');
  const row = (label, value, maxV, color, sub, hatch) => `
    <div style="display:grid;grid-template-columns:minmax(150px,240px) 1fr 110px;gap:10px;align-items:center;padding:5px 0;border-top:1px dotted var(--hairline)">
      <span>${label}</span>
      <span aria-hidden="true" style="display:block;height:13px;width:${Math.max(0.5, (value / maxV) * 100)}%;background:${color};${hatch ? 'opacity:0.5' : ''}"></span>
      <span style="text-align:right;color:var(--muted)">${sub}</span>
    </div>`;

  const wrap = document.createElement('div');
  wrap.className = 'mono';
  wrap.style.cssText = 'font-size:12px';
  let html = '';

  if (powerOk && latestFull) {
    const maxMW = Math.max(latestFull.peakMW, 1000);
    html += `<p class="method-note" style="margin:4px 0 6px">ELECTRIC · MW</p>`;
    html += row(
      `ZONE C MEASURED PEAK, ${latestFull.year} [${nN}]`,
      latestFull.peakMW,
      maxMW,
      'var(--ink)',
      `${fmt(latestFull.peakMW)} MW`
    );
    html += row(
      `ZONE C MEASURED AVERAGE, ${latestFull.year} [${nN}]`,
      latestFull.avgMW,
      maxMW,
      'var(--ink)',
      `${fmt(latestFull.avgMW)} MW`,
      true
    );
    for (const p of PHYS_ANCHORS.power) {
      html += row(`${p.label.toUpperCase()} [${nG}]`, p.mw, maxMW, 'var(--copper)', `${p.mw} MW · planned`);
    }
    html += `<p class="method-note" style="margin:6px 0 14px">${PHYS_ANCHORS.powerNote} [${nG}]</p>`;
  }

  if (waterOk) {
    const W = PHYS_ANCHORS.water;
    const maxMGD = W.permitted.to;
    html += `<p class="method-note" style="margin:14px 0 6px">WATER · MGD</p>`;
    html += row(
      `OCWA PERMITTED WITHDRAWAL, CURRENT [${nW}]`,
      W.permitted.from,
      maxMGD,
      'var(--ink)',
      `${W.permitted.from} MGD`
    );
    html += row(
      `OCWA WITHDRAWAL, APPLIED-FOR [${nW}]`,
      W.permitted.to,
      maxMGD,
      'var(--ink)',
      `${W.permitted.to} MGD`,
      true
    );
    for (const d of W.demand) {
      html += row(
        `MICRON AVG DEMAND ${d.year} · ${d.label.toUpperCase()} [${nW}]`,
        d.mgd,
        maxMGD,
        'var(--copper)',
        `${d.mgd} MGD · planned`
      );
    }
    html += `<p class="method-note" style="margin-top:6px">${W.note} [${nW}]</p>`;
  }

  wrap.innerHTML = html;
  panel.appendChild(wrap);

  const numbersEl = document.getElementById('phys-numbers');
  let trows = '';
  if (latestFull)
    for (const a of nyiso.annual)
      trows += `<tr><td>Zone C measured, ${a.year}${a.partial ? ' (partial)' : ''}</td><td>avg ${fmt(a.avgMW)} MW</td><td>peak ${fmt(a.peakMW)} MW</td><td>[${nN}]</td></tr>`;
  if (powerOk)
    for (const p of PHYS_ANCHORS.power)
      trows += `<tr><td>${p.label}</td><td colspan="2">${p.mw} MW (planned)</td><td>[${nG}]</td></tr>`;
  if (waterOk) {
    for (const d of PHYS_ANCHORS.water.demand)
      trows += `<tr><td>Micron average water demand, ${d.year} (${d.label})</td><td colspan="2">${d.mgd} MGD (planned)</td><td>[${nW}]</td></tr>`;
    trows += `<tr><td>OCWA permitted Lake Ontario withdrawal</td><td colspan="2">${PHYS_ANCHORS.water.permitted.from} → ${PHYS_ANCHORS.water.permitted.to} MGD (application)</td><td>[${nW}]</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Quantity</th><th colspan="2">Value</th><th>Source</th></tr></thead><tbody>${trows}</tbody>`;
  numbersEl.appendChild(table);
}

/* ================= boot ================= */
export async function initLive() {
  const [qcew, oews, ipeds, lodes, spending, permits, acs, nyiso] = await Promise.all([
    fetchJson('/data/qcew.json'),
    fetchJson('/data/oews.json'),
    fetchJson('/data/ipeds.json'),
    fetchJson('/data/lodes.json'),
    fetchJson('/data/spending.json'),
    fetchJson('/data/permits.json'),
    fetchJson('/data/acs.json'),
    fetchJson('/data/nyiso.json'),
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
  if (lodes)
    entries.push({
      keys: ['lodes-data'],
      title: 'LEHD LODES8 origin–destination employment (NY main + aux, JT00)',
      publisher: 'U.S. Census Bureau',
      url: 'https://lehd.ces.census.gov/data/',
      date: lodes.provenance.vintage,
      retrieved: lodes.provenance.retrievedAt,
    });
  if (spending)
    entries.push({
      keys: ['usaspending-data'],
      title: 'USAspending.gov award records (CHIPS Incentives CFDA 11.037; NSF assistance)',
      publisher: 'U.S. Department of the Treasury',
      url: 'https://www.usaspending.gov/',
      date: spending.provenance.vintage,
      retrieved: spending.provenance.retrievedAt,
    });
  if (permits)
    entries.push({
      keys: ['bps-data'],
      title: 'Building Permits Survey, annual county files',
      publisher: 'U.S. Census Bureau',
      url: 'https://www.census.gov/construction/bps/',
      date: permits.provenance.vintage,
      retrieved: permits.provenance.retrievedAt,
    });
  if (acs)
    entries.push({
      keys: ['acs-data'],
      title: 'American Community Survey 5-year estimates, table B15003 (educational attainment)',
      publisher: 'U.S. Census Bureau',
      url: 'https://www.census.gov/programs-surveys/acs',
      date: acs.provenance.vintage,
      retrieved: acs.provenance.retrievedAt,
    });
  if (nyiso)
    entries.push({
      keys: ['nyiso-data'],
      title: 'NYISO integrated real-time actual load by zone (palIntegrated), Zone C',
      publisher: 'New York Independent System Operator',
      url: 'http://mis.nyiso.com/public/',
      date: nyiso.provenance.vintage,
      retrieved: nyiso.provenance.retrievedAt,
    });
  registerSources(entries);

  if (qcew) renderQcew(qcew);
  if (oews) renderOews(oews);
  if (ipeds) renderIpeds(ipeds);
  if (lodes) renderLodes(lodes);
  if (spending) renderSpending(spending);
  if (qcew) renderComparators(qcew);
  if (permits) renderBps(permits);
  if (acs) renderAcs(acs);
  renderPhys(nyiso);

  return { qcew, oews, ipeds, lodes, spending, permits, acs, nyiso };
}
