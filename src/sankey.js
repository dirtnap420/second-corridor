// sankey.js — section 03 (capital stack, to scale) and section 04 (talent lattice,
// structure cited / widths illustrative).
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';
import { CAPITAL_SANKEY, TALENT_SANKEY, cite } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function fmtB(v) {
  if (v >= 1) return `$${v % 1 === 0 ? v : v.toFixed(1)}B`;
  return `$${Math.round(v * 1000)}M`;
}

function makeSvg(container, w, h, title, desc) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);
  svg.innerHTML = `<title>${title}</title><desc>${desc}</desc>`;
  container.appendChild(svg);
  return svg;
}

function layout(def, w, h, pad) {
  const gen = sankey()
    .nodeId((d) => d.id)
    .nodeWidth(12)
    .nodePadding(pad)
    .nodeAlign(sankeyJustify)
    .extent([
      [200, 24],
      [w - 230, h - 24],
    ]);
  return gen({
    nodes: def.nodes.map((d) => ({ ...d })),
    links: def.links.map((d) => ({ ...d })),
  });
}

function mark(key) {
  const n = cite(key);
  return n ? ` [${n}]` : '';
}

/* ---------------- capital stack ---------------- */
export function initCapitalSankey(container, { numbersEl }) {
  // figures with no located citation do not render
  const def = {
    nodes: CAPITAL_SANKEY.nodes,
    links: CAPITAL_SANKEY.links.filter((l) => cite(l.src)),
  };
  const used = new Set(def.links.flatMap((l) => [l.source, l.target]));
  def.nodes = def.nodes.filter((n) => used.has(n.id));

  const W = 980;
  const H = 430;
  const svg = makeSvg(
    container,
    W,
    H,
    'The capital stack',
    'Sankey of cited capital commitments, drawn to scale in billions of dollars.'
  );
  const graph = layout(def, W, H, 30);

  const colors = {
    micron: 'var(--copper)',
    greenchips: 'var(--green)',
    chipsdirect: 'var(--violet)',
    fedrd: 'var(--violet)',
  };

  let html = '';
  for (const l of graph.links) {
    const wpx = Math.max(l.width, 1.25); // $12M at true scale is sub-pixel; floor noted below
    html += `<path d="${sankeyLinkHorizontal()(l)}" fill="none" stroke="${
      colors[l.source.id] || 'var(--muted)'
    }" stroke-width="${wpx}" opacity="0.62"></path>`;
  }
  for (const n of graph.nodes) {
    html += `<rect x="${n.x0}" y="${n.y0}" width="${n.x1 - n.x0}" height="${Math.max(
      n.y1 - n.y0,
      2
    )}" fill="var(--ink)"></rect>`;
    const left = n.x0 < W / 2;
    const total = n.value;
    const lx = left ? n.x0 - 10 : n.x1 + 10;
    const anchor = left ? 'end' : 'start';
    const cy = (n.y0 + n.y1) / 2;
    html += `<text x="${lx}" y="${cy - 2}" text-anchor="${anchor}" style="font-family:var(--font-mono);font-size:12px;fill:var(--ink)">${n.label}${
      n.src ? mark(n.src) : ''
    }</text>
    <text x="${lx}" y="${cy + 13}" text-anchor="${anchor}" style="font-family:var(--font-mono);font-size:11px;fill:var(--muted)">${fmtB(total)}</text>`;
    if (n.id === 'clay-boise') {
      html += `<text x="${lx}" y="${cy + 28}" text-anchor="${anchor}" style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.05em;fill:var(--muted)">SINGLE AGREEMENT · NY SHARE NOT ITEMIZED</text>`;
    }
  }
  html += `<text x="${W - 230}" y="${H - 6}" text-anchor="end" style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.05em;fill:var(--muted)">BANDS TO SCALE · SUB-PIXEL BANDS DRAWN AT 1.25PX MINIMUM</text>`;
  const g = document.createElementNS(SVG_NS, 'g');
  g.innerHTML = html;
  svg.appendChild(g);

  if (numbersEl) {
    let rows = '';
    for (const l of def.links) {
      const s = def.nodes.find((n) => n.id === l.source);
      const t = CAPITAL_SANKEY.nodes.find((n) => n.id === l.target);
      rows += `<tr><td>${s.label} → ${t.label}</td><td>${fmtB(l.value)}</td><td>[${cite(l.src)}]</td></tr>`;
    }
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Flow</th><th>Committed</th><th>Source</th></tr></thead><tbody>${rows}</tbody>`;
    numbersEl.appendChild(table);
  }
}

/* ---------------- talent lattice ---------------- */
export function initTalentSankey(container, { numbersEl }) {
  const W = 980;
  const H = 460;
  const svg = makeSvg(
    container,
    W,
    H,
    'The talent lattice',
    'Talent pathways from corridor schools through co-ops, certificates, and apprenticeships to corridor employers. Structure from the public record; widths illustrative.'
  );
  const graph = layout(TALENT_SANKEY, W, H, 18);

  let html = '';
  for (const l of graph.links) {
    html += `<path d="${sankeyLinkHorizontal()(l)}" fill="none" stroke="var(--ink)" stroke-width="${Math.max(
      l.width,
      1
    )}" opacity="0.14"></path>`;
  }
  for (const n of graph.nodes) {
    const isMid = n.depth === 1;
    html += `<rect x="${n.x0}" y="${n.y0}" width="${n.x1 - n.x0}" height="${
      n.y1 - n.y0
    }" fill="${isMid ? 'var(--copper)' : 'var(--ink)'}"></rect>`;
    const left = n.depth === 0;
    const right = n.depth === (isMid ? 99 : 2);
    const midLabelAbove = isMid;
    if (midLabelAbove) {
      html += `<text x="${(n.x0 + n.x1) / 2}" y="${n.y0 - 6}" text-anchor="middle" style="font-family:var(--font-mono);font-size:11px;fill:var(--ink)">${n.label}${
        n.src ? mark(n.src) : ''
      }</text>`;
    } else {
      const lx = left ? n.x0 - 10 : n.x1 + 10;
      html += `<text x="${lx}" y="${(n.y0 + n.y1) / 2 + 4}" text-anchor="${
        left ? 'end' : 'start'
      }" style="font-family:var(--font-mono);font-size:11px;fill:var(--ink)">${n.label}${
        n.src ? mark(n.src) : ''
      }</text>`;
    }
  }
  const g = document.createElementNS(SVG_NS, 'g');
  g.innerHTML = html;
  svg.appendChild(g);

  if (numbersEl) {
    let rows = '';
    for (const l of TALENT_SANKEY.links) {
      const s = TALENT_SANKEY.nodes.find((n) => n.id === l.source);
      const t = TALENT_SANKEY.nodes.find((n) => n.id === l.target);
      rows += `<tr><td>${s.label} → ${t.label}</td><td>illustrative</td></tr>`;
    }
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Pathway (structure: public record)</th><th>Width</th></tr></thead><tbody>${rows}</tbody>`;
    numbersEl.appendChild(table);
  }
}
