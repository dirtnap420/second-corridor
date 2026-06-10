// site.js — the axonometric site-assembly panel: four schematic fab volumes
// sequenced purely by the verified milestones (no citable site-plan geometry
// was located, so the spec's diagrammatic fallback applies — labeled as such).
// States: future (dashed footprint), under construction (copper hatch, volume
// rising), built (paper fill, construction ended 2041), operational (violet).
// Fab 1 rise 2026→2028 is cited; the same two-year rise is applied to Fabs
// 2–4 from their cited start years (README → Decisions).
import { cite } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// fab phasing per the cited milestones
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
  const s = W / 980; // scale relative to reference width

  // iso transform: unit grid u (along site axis), v (depth), z (height).
  // shallow pitch — reads as a wide, flat site
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
  const FW = 120 * s; // fab footprint length (u)
  const FD = 78 * s; // depth (v)
  const FH = 58 * s; // full height
  const GAP = 64 * s;

  const px = (u, v, z) => {
    const [x, y] = iso(u, v, z);
    return `${(X0 + x).toFixed(1)},${(Y0 + y).toFixed(1)}`;
  };

  // sitework pad
  const padPath = `M${px(-40 * s, -30 * s, 0)} L${px(4 * (FW + GAP) + 10 * s, -30 * s, 0)} L${px(4 * (FW + GAP) + 10 * s, FD + 40 * s, 0)} L${px(-40 * s, FD + 40 * s, 0)} Z`;
  const gPad = document.createElementNS(SVG_NS, 'g');
  gPad.innerHTML = `<path d="${padPath}" fill="var(--silicon)" stroke="var(--hairline)" stroke-width="1"></path>
    <text x="10" y="16" class="chart-label">WHITE PINE SITE — SITEWORK ${SITEWORK}</text>`;
  gPad.style.opacity = '0';
  svg.appendChild(gPad);

  // fab groups
  const fabGs = FABS.map((f, i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.dataset.fab = f.n;
    svg.appendChild(g);
    return g;
  });

  // panel label
  const lbl = document.createElementNS(SVG_NS, 'g');
  const feisN = cite('fab1-2028-fab2');
  const gbN = cite('groundbreaking-2026');
  lbl.innerHTML = `<text x="${W - 10}" y="16" text-anchor="end" class="chart-label">DIAGRAMMATIC · SEQUENCE PER FEIS [${feisN}] &amp; MILESTONES [${gbN}]</text>`;
  svg.appendChild(lbl);

  function boxFaces(u0, hNow) {
    // returns {top, left, right} face paths for a box of height hNow at u0
    const A = [u0, 0];
    const B = [u0 + FW, 0];
    const C = [u0 + FW, FD];
    const D = [u0, FD];
    const top = `M${px(...A, hNow)} L${px(...B, hNow)} L${px(...C, hNow)} L${px(...D, hNow)} Z`;
    const front = `M${px(...D, 0)} L${px(...C, 0)} L${px(...C, hNow)} L${px(...D, hNow)} Z`;
    const side = `M${px(...C, 0)} L${px(...B, 0)} L${px(...B, hNow)} L${px(...C, hNow)} Z`;
    const footprint = `M${px(...A, 0)} L${px(...B, 0)} L${px(...C, 0)} L${px(...D, 0)} Z`;
    return { top, front, side, footprint };
  }

  function update(year) {
    gPad.style.opacity = year >= SITEWORK ? '1' : '0';
    FABS.forEach((f, i) => {
      const u0 = i * (FW + GAP);
      const g = fabGs[i];
      let html = '';
      // callouts on two fixed rows with leader lines down to each volume
      const topCenter = px(u0 + FW / 2, FD / 2, FH).split(',').map(Number);
      const rowY = i % 2 === 0 ? 30 : 46;

      if (year < f.start) {
        // future: dashed footprint only (visible once sitework exists)
        if (year >= SITEWORK) {
          const { footprint } = boxFaces(u0, 0);
          html = `<path d="${footprint}" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"></path>`;
        }
      } else {
        const riseT = Math.min(1, Math.max(0.06, (year - f.start) / (f.topOut - f.start)));
        const h = FH * riseT;
        const { top, front, side } = boxFaces(u0, h);
        const operational = year >= f.ops;
        const built = !operational && year >= CONSTR_END;
        const fillTop = operational ? 'var(--violet)' : built ? 'var(--paper)' : 'url(#hatch-site)';
        const fillFront = operational ? 'var(--violet)' : built ? 'var(--paper)' : 'url(#hatch-site)';
        const opTop = operational ? 0.85 : 1;
        html = `
          <path d="${front}" fill="${fillFront}" opacity="${operational ? 0.65 : 1}" stroke="var(--ink)" stroke-width="1"></path>
          <path d="${side}" fill="${operational ? 'var(--violet)' : built ? 'var(--silicon)' : 'var(--paper)'}" opacity="${operational ? 0.5 : 1}" stroke="var(--ink)" stroke-width="1"></path>
          <path d="${top}" fill="${fillTop}" opacity="${opTop}" stroke="var(--ink)" stroke-width="1"></path>`;
        const state = operational ? `OPS ${f.ops}` : built ? 'BUILT' : `CONSTR ${f.start}–`;
        const topNow = px(u0 + FW / 2, FD / 2, h).split(',').map(Number);
        html += `<line x1="${topCenter[0]}" y1="${rowY + 4}" x2="${topNow[0]}" y2="${topNow[1] - 2}" stroke="var(--hairline)" stroke-width="1"></line>
          <text x="${topCenter[0]}" y="${rowY}" text-anchor="middle" class="chart-label" style="fill:var(--ink)">FAB ${f.n} · ${state}</text>`;
      }
      g.innerHTML = html;
    });
  }

  return { update };
}
