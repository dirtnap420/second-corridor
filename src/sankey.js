// sankey.js — section 03 (capital stack, to scale) and section 04 (talent lattice,
// structure cited / widths illustrative). Re-rendered at container width.
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';
import { CAPITAL_SANKEY, TALENT_SANKEY, cite } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function fmtB(v) {
  if (v >= 1) return `$${String(Number(v.toFixed(3)))}B`;
  return `$${Math.round(v * 1000)}M`;
}

function mark(key) {
  const n = cite(key);
  return n ? ` [${n}]` : '';
}

function makeSvg(container, w, h, title, desc) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', w);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);
  svg.innerHTML = `<title>${title}</title><desc>${desc}</desc>`;
  container.appendChild(svg);
  return svg;
}

// wrap a label into tspans of ~n chars, breaking on spaces
function wrap(text, n, x, anchor, y, cls) {
  const words = String(text).split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length > n) lines.push(w);
    else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
  }
  const dy0 = -((lines.length - 1) * 11) / 2;
  const spans = lines
    .map(
      (l, i) =>
        `<tspan x="${x}" dy="${i === 0 ? dy0 : 11}">${l}</tspan>`
    )
    .join('');
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${spans}</text>`;
}

function layout(def, w, h, pad, lm, rm) {
  const gen = sankey()
    .nodeId((d) => d.id)
    .nodeWidth(12)
    .nodePadding(pad)
    .nodeAlign(sankeyJustify)
    .extent([
      [lm, 26],
      [w - rm, h - 26],
    ]);
  return gen({
    nodes: def.nodes.map((d) => ({ ...d })),
    links: def.links.map((d) => ({ ...d })),
  });
}

/* ---------------- capital stack ---------------- */
export function renderCapitalSankey(container, width) {
  const def = {
    nodes: CAPITAL_SANKEY.nodes,
    links: CAPITAL_SANKEY.links.filter((l) => cite(l.src)),
  };
  const used = new Set(def.links.flatMap((l) => [l.source, l.target]));
  def.nodes = def.nodes.filter((n) => used.has(n.id));

  const W = Math.max(330, width);
  const narrow = W < 640;
  const H = narrow ? 420 : 440;
  const lm = narrow ? 118 : 196;
  const rm = narrow ? 128 : 220;
  const svg = makeSvg(
    container,
    W,
    H,
    'The capital stack',
    'Sankey of cited capital commitments, drawn to scale in billions of dollars.'
  );
  const graph = layout(def, W, H, narrow ? 22 : 30, lm, rm);

  const colors = {
    micron: 'var(--copper)',
    greenchips: 'var(--green)',
    chipsdirect: 'var(--violet)',
    fedrd: 'var(--violet)',
  };

  let html = '';
  for (const l of graph.links) {
    const wpx = Math.max(l.width, 1.25); // $65M at true scale is sub-pixel; floor noted on plate
    html += `<path d="${sankeyLinkHorizontal()(l)}" fill="none" stroke="${
      colors[l.source.id] || 'var(--muted)'
    }" stroke-width="${wpx}" opacity="0.62"></path>`;
  }
  const wrapN = narrow ? 15 : 24;
  // de-collide labels per column: greedy push-down with min spacing
  const SPACING = 44;
  for (const side of [true, false]) {
    const col = graph.nodes
      .filter((n) => (n.x0 < W / 2) === side)
      .sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
    let prev = -Infinity;
    for (const n of col) {
      n.labelY = Math.max((n.y0 + n.y1) / 2, prev + SPACING);
      prev = n.labelY;
    }
    // if the last label ran past the bottom, shift the column back up
    const over = prev - (H - 18);
    if (over > 0) for (const n of col) n.labelY -= over;
  }
  for (const n of graph.nodes) {
    html += `<rect x="${n.x0}" y="${n.y0}" width="${n.x1 - n.x0}" height="${Math.max(
      n.y1 - n.y0,
      2
    )}" fill="var(--ink)"></rect>`;
    const left = n.x0 < W / 2;
    const lx = left ? n.x0 - 8 : n.x1 + 8;
    const anchor = left ? 'end' : 'start';
    const cy = n.labelY;
    html += wrap(`${n.label}${n.src ? mark(n.src) : ''}`, wrapN, lx, anchor, cy - 4, 'sankey-label');
    html += `<text x="${lx}" y="${cy + (narrow ? 16 : 14)}" text-anchor="${anchor}" class="sankey-value">${fmtB(n.value)}</text>`;
    // hairline from label to node when nudged away
    if (Math.abs(cy - (n.y0 + n.y1) / 2) > 12) {
      const nx = left ? n.x0 - 4 : n.x1 + 4;
      html += `<line x1="${nx}" y1="${(n.y0 + n.y1) / 2}" x2="${nx}" y2="${cy - 8}" stroke="var(--hairline)" stroke-width="1"></line>`;
    }
  }
  html += `<text x="8" y="14" class="sankey-note">SUB-PIXEL BANDS DRAWN AT 1.25PX MINIMUM</text>`;
  const g = document.createElementNS(SVG_NS, 'g');
  g.innerHTML = html;
  svg.appendChild(g);
  return {};
}

export function buildCapitalNumbers(numbersEl) {
  let rows = '';
  for (const l of CAPITAL_SANKEY.links) {
    if (!cite(l.src)) continue;
    const s = CAPITAL_SANKEY.nodes.find((n) => n.id === l.source);
    const t = CAPITAL_SANKEY.nodes.find((n) => n.id === l.target);
    rows += `<tr><td>${s.label} → ${t.label}</td><td>${fmtB(l.value)}</td><td>[${cite(l.src)}]</td></tr>`;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Flow</th><th>Committed</th><th>Source</th></tr></thead><tbody>${rows}</tbody>`;
  numbersEl.appendChild(table);
}

/* ---------------- talent lattice ---------------- */
// D3: below 560px the sankey is illegible (labels clip the viewBox and sit on
// ribbons), so it renders as a stacked route list instead — one block per
// program/mechanism, listing its inbound schools and outbound employers. The
// widths were always illustrative; a structure-only list loses nothing.
function citeMark(key) {
  const n = cite(key);
  return n ? `<a class="cite" href="#src-${n}">[${n}]</a>` : '';
}

function renderTalentRouteList(container) {
  const nodeById = Object.fromEntries(TALENT_SANKEY.nodes.map((n) => [n.id, n]));
  const ul = document.createElement('ul');
  ul.className = 'route-list';
  ul.setAttribute(
    'aria-label',
    'Talent pathways: schools through programs to employers. Structure from the public record.'
  );
  for (const mid of TALENT_SANKEY.nodes.filter((n) => n.layer === 1)) {
    const from = TALENT_SANKEY.links
      .filter((l) => l.target === mid.id)
      .map((l) => `${nodeById[l.source].label}${citeMark(nodeById[l.source].src)}`);
    const to = TALENT_SANKEY.links
      .filter((l) => l.source === mid.id)
      .map((l) => `${nodeById[l.target].label}${citeMark(nodeById[l.target].src)}`);
    const li = document.createElement('li');
    li.className = 'route';
    li.innerHTML = `
      <span class="route-chip">${mid.label.toUpperCase()}${citeMark(mid.src)}</span>
      <div class="route-from">${from.join(' · ')}</div>
      <div class="route-to">→ ${to.join(' · ')}</div>`;
    ul.appendChild(li);
  }
  container.appendChild(ul);
  return {};
}

export function renderTalentSankey(container, width) {
  const W = Math.max(330, width);
  if (width < 560) return renderTalentRouteList(container);
  const narrow = W < 640;
  const H = narrow ? 480 : 470;
  const lm = narrow ? 104 : 230;
  const rm = narrow ? 110 : 240;
  const svg = makeSvg(
    container,
    W,
    H,
    'The talent lattice',
    'Talent pathways from corridor schools through co-ops, certificates, and apprenticeships to corridor employers. Structure from the public record; widths illustrative.'
  );
  const graph = layout(TALENT_SANKEY, W, H, narrow ? 16 : 20, lm, rm);

  let html = '';
  for (const l of graph.links) {
    html += `<path d="${sankeyLinkHorizontal()(l)}" fill="none" stroke="var(--ink)" stroke-width="${Math.max(
      l.width,
      1
    )}" opacity="0.14"></path>`;
  }
  const wrapN = narrow ? 13 : 22;
  for (const n of graph.nodes) {
    const isMid = n.depth === 1;
    html += `<rect x="${n.x0}" y="${n.y0}" width="${n.x1 - n.x0}" height="${
      n.y1 - n.y0
    }" fill="${isMid ? 'var(--copper)' : 'var(--ink)'}"></rect>`;
    const label = `${n.label}${n.src ? mark(n.src) : ''}`;
    if (isMid) {
      html += wrap(label, narrow ? 18 : 30, (n.x0 + n.x1) / 2, 'middle', n.y0 - 12, 'sankey-label');
    } else {
      const left = n.depth === 0;
      const lx = left ? n.x0 - 8 : n.x1 + 8;
      html += wrap(label, wrapN, lx, left ? 'end' : 'start', (n.y0 + n.y1) / 2 + 3, 'sankey-label');
    }
  }
  const g = document.createElementNS(SVG_NS, 'g');
  g.innerHTML = html;
  svg.appendChild(g);
  return {};
}

export function buildTalentNumbers(numbersEl) {
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
