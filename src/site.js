// site.js — the axonometric site-assembly panel: four schematic fab volumes
// sequenced purely by the verified milestones (no citable site-plan geometry
// was located, so the spec's diagrammatic fallback applies — labeled as such).
// States: future (dashed footprint), under construction (copper hatch, volume
// rising), built (paper fill, construction ended 2041), operational (violet).
// Fab 1 rise 2026→2028 is cited; the same two-year rise is applied to Fabs
// 2–4 from their cited start years (README → Decisions).
// Elements are created once and updated by attribute — smooth at 60fps.
import { cite } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const FABS = [
  { n: 1, start: 2026, topOut: 2028, ops: 2030 },
  { n: 2, start: 2028, topOut: 2030, ops: 2045 },
  { n: 3, start: 2033, topOut: 2035, ops: 2045 },
  { n: 4, start: 2039, topOut: 2041, ops: 2045 },
];
const CONSTR_END = 2041;
const SITEWORK = 2026;

export function renderSite(container, width) {
  const W = Math.max(320, width);
  const H = Math.round(Math.max(190, Math.min(270, W * 0.27)));
  const s = W / 980;

  // shallow axonometric pitch — reads as a wide, flat site
  const iso = (u, v, z) => [u - v * 0.55, (u + v * 0.55) * 0.16 - z];

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Diagrammatic site assembly of the Clay campus, four fab volumes');
  svg.innerHTML = `<title>The site assembles</title>
    <desc>A schematic axonometric drawing of four fab volumes that construct themselves as the timeline advances, per the cited milestone sequence.</desc>
    <defs>
      <pattern id="hatch-site" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="var(--copper)" stroke-width="1.4"></line>
      </pattern>
    </defs>`;
  container.appendChild(svg);

  const X0 = W * 0.13;
  const Y0 = H * 0.62;
  const FW = 120 * s;
  const FD = 78 * s;
  const FH = 58 * s;
  const GAP = 64 * s;

  const pt = (u, v, z) => {
    const [x, y] = iso(u, v, z);
    return [X0 + x, Y0 + y];
  };
  const px = (u, v, z) => {
    const [x, y] = pt(u, v, z);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  /* sitework pad (opacity transitions in) */
  const padPath = `M${px(-40 * s, -30 * s, 0)} L${px(4 * (FW + GAP) + 10 * s, -30 * s, 0)} L${px(4 * (FW + GAP) + 10 * s, FD + 40 * s, 0)} L${px(-40 * s, FD + 40 * s, 0)} Z`;
  const gPad = document.createElementNS(SVG_NS, 'g');
  gPad.style.transition = 'opacity 450ms linear';
  gPad.innerHTML = `<path d="${padPath}" fill="var(--silicon)" stroke="var(--hairline)" stroke-width="1"></path>
    <text x="10" y="16" class="chart-label">WHITE PINE SITE — SITEWORK ${SITEWORK}</text>`;
  gPad.style.opacity = '0';
  svg.appendChild(gPad);

  /* per-fab persistent elements */
  const fabs = FABS.map((f, i) => {
    const u0 = i * (FW + GAP);
    const g = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(g);
    const mk = (cls) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('stroke', 'var(--ink)');
      p.setAttribute('stroke-width', '1');
      g.appendChild(p);
      return p;
    };
    const footprint = document.createElementNS(SVG_NS, 'path');
    footprint.setAttribute('fill', 'none');
    footprint.setAttribute('stroke', 'var(--muted)');
    footprint.setAttribute('stroke-width', '1');
    footprint.setAttribute('stroke-dasharray', '3 3');
    footprint.setAttribute(
      'd',
      `M${px(u0, 0, 0)} L${px(u0 + FW, 0, 0)} L${px(u0 + FW, FD, 0)} L${px(u0, FD, 0)} Z`
    );
    g.appendChild(footprint);
    const front = mk();
    const side = mk();
    const top = mk();
    const leader = document.createElementNS(SVG_NS, 'line');
    leader.setAttribute('stroke', 'var(--hairline)');
    leader.setAttribute('stroke-width', '1');
    g.appendChild(leader);
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'chart-label');
    label.setAttribute('text-anchor', 'middle');
    label.style.fill = 'var(--ink)';
    g.appendChild(label);
    const topCenter = pt(u0 + FW / 2, FD / 2, FH);
    const rowY = i % 2 === 0 ? 30 : 46;
    label.setAttribute('x', topCenter[0].toFixed(1));
    label.setAttribute('y', rowY);
    leader.setAttribute('x1', topCenter[0].toFixed(1));
    leader.setAttribute('y1', rowY + 4);
    leader.setAttribute('x2', topCenter[0].toFixed(1));
    return { f, u0, g, footprint, front, side, top, leader, label, lastState: '' };
  });

  /* panel label — D2: below 560px the end-anchored line overprinted the
     WHITE PINE caption at y=16; narrow widths stack it left-aligned below */
  const lbl = document.createElementNS(SVG_NS, 'g');
  const seqLine = `SEQUENCE PER FEIS [${cite('fab1-2028-fab2')}] &amp; MILESTONES [${cite('groundbreaking-2026')}]`;
  lbl.innerHTML =
    W < 560
      ? `<text x="10" y="${H - 20}" class="chart-label">DIAGRAMMATIC</text>
         <text x="10" y="${H - 6}" class="chart-label">${seqLine}</text>`
      : `<text x="${W - 10}" y="16" text-anchor="end" class="chart-label">DIAGRAMMATIC · ${seqLine}</text>`;
  svg.appendChild(lbl);

  function faceD(u0, hNow) {
    const A = [u0, 0];
    const B = [u0 + FW, 0];
    const C = [u0 + FW, FD];
    const D = [u0, FD];
    return {
      top: `M${px(...A, hNow)} L${px(...B, hNow)} L${px(...C, hNow)} L${px(...D, hNow)} Z`,
      front: `M${px(...D, 0)} L${px(...C, 0)} L${px(...C, hNow)} L${px(...D, hNow)} Z`,
      side: `M${px(...C, 0)} L${px(...B, 0)} L${px(...B, hNow)} L${px(...C, hNow)} Z`,
    };
  }

  function update(year) {
    gPad.style.opacity = year >= SITEWORK ? '1' : '0';
    for (const fb of fabs) {
      const { f, u0 } = fb;
      if (year < f.start) {
        const state = year >= SITEWORK ? 'future' : 'pre';
        if (fb.lastState !== state) {
          fb.front.style.display = 'none';
          fb.side.style.display = 'none';
          fb.top.style.display = 'none';
          fb.leader.style.display = 'none';
          fb.label.style.display = 'none';
          fb.footprint.style.display = state === 'future' ? '' : 'none';
          fb.lastState = state;
        }
        continue;
      }
      const riseT = Math.min(1, Math.max(0.06, (year - f.start) / (f.topOut - f.start)));
      const h = FH * riseT;
      const { top, front, side } = faceD(u0, h);
      fb.front.setAttribute('d', front);
      fb.side.setAttribute('d', side);
      fb.top.setAttribute('d', top);

      const operational = year >= f.ops;
      const built = !operational && year >= CONSTR_END;
      const state = operational ? 'ops' : built ? 'built' : 'constr';
      if (fb.lastState !== state) {
        fb.footprint.style.display = 'none';
        fb.front.style.display = '';
        fb.side.style.display = '';
        fb.top.style.display = '';
        fb.leader.style.display = '';
        fb.label.style.display = '';
        const fills = {
          ops: ['var(--violet)', 'var(--violet)', 'var(--violet)', '0.65', '0.5', '0.85'],
          built: ['var(--paper)', 'var(--silicon)', 'var(--paper)', '1', '1', '1'],
          constr: ['url(#hatch-site)', 'var(--paper)', 'url(#hatch-site)', '1', '1', '1'],
        }[state];
        fb.front.setAttribute('fill', fills[0]);
        fb.side.setAttribute('fill', fills[1]);
        fb.top.setAttribute('fill', fills[2]);
        fb.front.setAttribute('opacity', fills[3]);
        fb.side.setAttribute('opacity', fills[4]);
        fb.top.setAttribute('opacity', fills[5]);
        fb.label.textContent = `FAB ${f.n} · ${
          operational ? `OPS ${f.ops}` : built ? 'BUILT' : `CONSTR ${f.start}–`
        }`;
        fb.lastState = state;
      }
      const tipY = pt(u0 + FW / 2, FD / 2, h)[1];
      fb.leader.setAttribute('y2', (tipY - 2).toFixed(1));
    }
  }

  return { update };
}
