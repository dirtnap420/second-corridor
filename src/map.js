// map.js — the corridor instrument's main stage. Two views:
//   MAP     — NY geography, five nodes, corridor trace
//   SECTION — a stationing diagram: nodes projected onto a datum line, x by
//             great-circle distance from STAMP, with data risers per node
// Two particle modes: AMBIENT (atmosphere) and FLOWS (LODES-driven arcs; map
// view only — flows are geography-bound). Particles render as plotter streaks
// with age-based fade-in/out so density changes never pop. All surfaces are
// driven by update(year); a copper carriage square rides the trace tip.
// F9: scoped imports — no meta-package guesswork for the bundler
import { geoConicConformal, geoPath, geoDistance } from 'd3-geo';
import { line as d3line, curveCatmullRom } from 'd3-shape';
import { feature, mesh, merge } from 'topojson-client';
import { NODES, YEAR_MIN, YEAR_MAX, investAt } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
import { onTick } from './ticker.js';

const EARTH_MI = 3958.8;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function renderMap(container, topo, opts, width) {
  const { onNodeSelect, motion, onMotionChange, lodes, qcew, ipeds, uiState, onFlowInfo } = opts;
  const W = Math.max(320, width);
  const H = Math.round(Math.min(560, Math.max(260, W * 0.55)));

  /* ---------- projection (noted in README) ---------- */
  const counties = feature(topo, topo.objects.counties);
  const pad = Math.max(10, W * 0.02);
  const projection = geoConicConformal()
    .parallels([40.5, 44.5])
    .rotate([76.5, 0])
    .fitExtent(
      [
        [pad, pad],
        [W - pad, H - pad * 2],
      ],
      counties
    );
  const path = geoPath(projection);

  /* ---------- svg ---------- */
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  // role=group, not img: the node markers inside are real buttons, and
  // role=img would hide them from assistive tech (axe: nested-interactive)
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Corridor map of New York State with five semiconductor nodes');
  svg.innerHTML = `<title>The corridor instrument</title>
    <desc>New York State counties with five corridor nodes — STAMP, RIT, Clay, Marcy, and Albany NanoTech — connected by a corridor trace; switchable to a stationing diagram with data risers.</desc>`;
  container.appendChild(svg);

  const stateShape = merge(topo, topo.objects.counties.geometries);
  const interior = mesh(topo, topo.objects.counties, (a, b) => a !== b);

  const gGeo = document.createElementNS(SVG_NS, 'g');
  gGeo.style.transition = motion.reduced ? 'none' : 'opacity 650ms cubic-bezier(0.65, 0, 0.35, 1)';
  gGeo.innerHTML = `
    <path class="county" d="${path(stateShape)}"></path>
    <path class="county-mesh" d="${path(interior)}" fill="none" stroke="var(--hairline)" stroke-width="0.6"></path>
    <path class="state-outline" d="${path(stateShape)}"></path>`;
  // D17: map furniture in the dead lower-left corner — a mono scale bar and
  // north arrow, on-register for a field instrument. Lives in gGeo so it
  // dims with the geography in section view.
  {
    const latMid = 42.2;
    const dLon = 50 / (Math.cos((latMid * Math.PI) / 180) * 69.172); // 50 mi in degrees lon
    const p1 = projection([-78.6, latMid]);
    const p2 = projection([-78.6 + dLon, latMid]);
    const barPx = Math.abs(p2[0] - p1[0]);
    const bx = 14;
    const by = H - 16;
    gGeo.innerHTML += `
      <g class="map-furniture" aria-hidden="true">
        <line x1="${bx}" y1="${by}" x2="${bx + barPx}" y2="${by}" stroke="var(--ink)" stroke-width="1"></line>
        <line x1="${bx}" y1="${by - 4}" x2="${bx}" y2="${by + 4}" stroke="var(--ink)" stroke-width="1"></line>
        <line x1="${bx + barPx / 2}" y1="${by - 3}" x2="${bx + barPx / 2}" y2="${by + 3}" stroke="var(--ink)" stroke-width="1"></line>
        <line x1="${bx + barPx}" y1="${by - 4}" x2="${bx + barPx}" y2="${by + 4}" stroke="var(--ink)" stroke-width="1"></line>
        <text x="${bx}" y="${by - 8}" class="chart-label">0</text>
        <text x="${bx + barPx}" y="${by - 8}" text-anchor="end" class="chart-label">50 MI</text>
        <path d="M${bx + 6},${by - 34} l4,10 l-4,-3 l-4,3 Z" fill="var(--ink)"></path>
        <text x="${bx + 14}" y="${by - 26}" class="chart-label">N</text>
      </g>`;
  }
  svg.appendChild(gGeo);

  /* ---------- node geometry: map + section positions ---------- */
  const mapPts = NODES.map((n) => projection(n.lonlat));
  const distMi = NODES.map((n) => geoDistance(NODES[0].lonlat, n.lonlat) * EARTH_MI);
  const totalMi = distMi[distMi.length - 1];
  const SM = { l: 56, r: 56 }; // D6: r=30 clipped the Albany riser's labels
  const datumY = Math.round(H * 0.62);
  const sectionPts = distMi.map((d) => [SM.l + (d / totalMi) * (W - SM.l - SM.r), datumY]);

  /* ---------- corridor trace (morphable) ---------- */
  const K = 64;
  function samplePath(d) {
    const tmp = document.createElementNS(SVG_NS, 'path');
    tmp.setAttribute('d', d);
    svg.appendChild(tmp);
    const len = tmp.getTotalLength();
    const out = [];
    for (let i = 0; i <= K; i++) {
      const p = tmp.getPointAtLength((i / K) * len);
      out.push([p.x, p.y]);
    }
    svg.removeChild(tmp);
    return out;
  }
  const curve = d3line()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(curveCatmullRom.alpha(0.7));
  const mapTraceD = curve(mapPts);
  const sectionTraceD = `M${sectionPts.map((p) => p.join(',')).join(' L')}`;
  const mapSamples = samplePath(mapTraceD);
  const sectionSamples = samplePath(sectionTraceD);
  const toD = (pts2) => 'M' + pts2.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');

  const gTrace = document.createElementNS(SVG_NS, 'g');
  gTrace.innerHTML = `
    <path class="trace-base" d="${mapTraceD}"></path>
    <path class="trace-fill" d="${mapTraceD}"></path>
    <rect class="trace-tip" x="-3" y="-3" width="6" height="6"></rect>`;
  svg.appendChild(gTrace);
  const traceBase = gTrace.querySelector('.trace-base');
  const traceFill = gTrace.querySelector('.trace-fill');
  const traceTip = gTrace.querySelector('.trace-tip');
  let traceLen = traceFill.getTotalLength();
  // F31: both endpoint lengths measured once (a synchronous d swap before
  // first paint) — the morph lerps between them instead of forcing
  // getTotalLength() geometry every frame
  const mapTraceLen = traceLen;
  traceFill.setAttribute('d', sectionTraceD);
  const sectionTraceLen = traceFill.getTotalLength();
  traceFill.setAttribute('d', mapTraceD);
  traceFill.style.strokeDasharray = `${traceLen}`;
  traceFill.style.strokeDashoffset = `${traceLen}`;

  function placeTip(progress) {
    const p = traceFill.getPointAtLength(progress * traceLen);
    traceTip.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
  }

  /* ---------- section chrome (datum, mileage ticks, risers) ---------- */
  const gSection = document.createElementNS(SVG_NS, 'g');
  gSection.style.transition = motion.reduced ? 'none' : 'opacity 650ms cubic-bezier(0.65, 0, 0.35, 1)';
  gSection.style.opacity = '0';
  gSection.style.pointerEvents = 'none';
  {
    let html = `<line x1="${SM.l}" y1="${datumY}" x2="${W - SM.r}" y2="${datumY}" stroke="var(--ink)" stroke-width="1"></line>`;
    const step = W < 600 ? 100 : 50;
    for (let mi = 0; mi <= Math.floor(totalMi / step) * step; mi += step) {
      const x = SM.l + (mi / totalMi) * (W - SM.l - SM.r);
      html += `<line x1="${x}" y1="${datumY}" x2="${x}" y2="${datumY + 6}" stroke="var(--muted)" stroke-width="1"></line>
        <text x="${x}" y="${datumY + 18}" text-anchor="middle" class="chart-label">STA ${mi} MI</text>`;
    }
    // title sits at the panel's top-left — at datum height it ran through
    // the RIT risers (D5 overlap sweep)
    html += `<text x="${SM.l}" y="20" text-anchor="start" class="chart-label" style="fill:var(--copper)">STAMP → ALBANY · GREAT-CIRCLE ${Math.round(totalMi)} MI</text>`;
    html += `<g class="risers"></g>`;
    // legend + the D5 dagger footnote; one line wide, stacked when narrow
    const legendParts = [
      'RISERS — COPPER: CUMULATIVE CAPITAL $B',
      'INK: COUNTY NAICS-3344 EMP (QCEW)',
      'VIOLET: COMPLETIONS (IPEDS)',
    ];
    const dagLine = '† QCEW SUPPRESSED (BLS CONFIDENTIALITY)';
    if (W < 600) {
      legendParts.forEach((p, i) => {
        html += `<text x="${SM.l}" y="${H - 8 - (legendParts.length - i) * 12}" class="chart-label">${p}</text>`;
      });
      html += `<text x="${SM.l}" y="${H - 8}" class="chart-label">${dagLine}</text>`;
    } else {
      html += `<text x="${SM.l}" y="${H - 20}" class="chart-label">${legendParts.join(' · ')}</text>`;
      html += `<text x="${SM.l}" y="${H - 8}" class="chart-label">${dagLine}</text>`;
    }
    gSection.innerHTML = html;
  }
  svg.appendChild(gSection);
  const gRisers = gSection.querySelector('.risers');

  /* ---------- risers: persistent elements, attribute updates only ---------- */
  function latestSemi(fips) {
    if (!qcew) return null;
    const c = qcew.corridor.find((x) => x.fips === fips);
    if (!c) return null;
    const s = c.series[c.series.length - 1];
    return { year: s.year, value: s.semi };
  }
  function ritCompletions() {
    if (!ipeds) return null;
    const years = [...new Set(ipeds.series.map((s) => s.year))].sort();
    const last = years[years.length - 1];
    const rows = ipeds.series.filter((s) => s.year === last && s.inst === 'RIT');
    const total = rows.reduce(
      (a, r) => a + (r.cert || 0) + (r.assoc || 0) + (r.bach || 0) + (r.grad || 0),
      0
    );
    return { year: last, value: total };
  }
  const RISER_MAX_H = Math.min(120, datumY - 60);
  const dynamicRisers = [];
  const riserBars = [];
  {
    const empMax = 800;
    const capMax = 100;
    const compMax = 400;
    NODES.forEach((n, i) => {
      const x = sectionPts[i][0];
      const defs = [];
      if (n.id === 'clay')
        defs.push({ dynamic: true, value: (yr) => investAt(yr), max: capMax, color: 'var(--copper)', fmt: (v) => `$${v.toFixed(1)}B` });
      if (n.id === 'albany')
        defs.push({ dynamic: true, value: (yr) => (yr >= 2024 ? 0.825 : 0), max: capMax, color: 'var(--copper)', fmt: () => '$0.8B' });
      const semi = latestSemi(n.county);
      if (semi) {
        if (semi.value && typeof semi.value === 'object') defs.push({ suppressed: true });
        else defs.push({ static: true, v: semi.value, max: empMax, color: 'var(--ink)', text: String(semi.value) });
      }
      if (n.id === 'rit') {
        const c = ritCompletions();
        if (c) defs.push({ static: true, v: c.value, max: compMax, color: 'var(--violet)', text: String(c.value) });
      }
      const bw = 8;
      const gap = 4;
      let bx = x - (defs.length * bw + (defs.length - 1) * gap) / 2;
      // D5: values render horizontally, centered on the bar group and stacked
      // above its tallest bar (rotated labels collided with the node squares
      // and each other at Clay/RIT). Labels carry their bar's color.
      const nodeBars = [];
      const relayout = () => {
        const visible = nodeBars.filter((b) => !b.hidden);
        const top = Math.max(0, ...visible.map((b) => b.h));
        visible.forEach((b, j) => {
          b.label.setAttribute('x', x);
          b.label.setAttribute('y', datumY - top - 6 - j * 12);
        });
      };
      for (const d of defs) {
        if (d.suppressed) {
          // D5: dagger instead of a rotated string; footnote in the legend
          const t = document.createElementNS(SVG_NS, 'text');
          t.setAttribute('class', 'chart-label');
          t.setAttribute('x', bx + bw / 2);
          t.setAttribute('y', datumY - 5);
          t.setAttribute('text-anchor', 'middle');
          t.textContent = '†';
          gRisers.appendChild(t);
        } else {
          const rect = document.createElementNS(SVG_NS, 'rect');
          rect.setAttribute('x', bx);
          rect.setAttribute('width', bw);
          rect.setAttribute('fill', d.color);
          rect.style.transformBox = 'fill-box';
          rect.style.transformOrigin = 'bottom';
          const label = document.createElementNS(SVG_NS, 'text');
          label.setAttribute('class', 'chart-label');
          label.setAttribute('text-anchor', 'middle');
          label.style.fill = d.color;
          gRisers.appendChild(rect);
          gRisers.appendChild(label);
          riserBars.push(rect);
          const bar = { label, h: 0, hidden: true };
          nodeBars.push(bar);
          const place = (v, text) => {
            const h = Math.max(1.5, (v / d.max) * RISER_MAX_H);
            const hidden = v <= 0;
            bar.h = h;
            bar.hidden = hidden;
            rect.style.display = hidden ? 'none' : '';
            label.style.display = hidden ? 'none' : '';
            rect.setAttribute('y', datumY - h);
            rect.setAttribute('height', h);
            label.textContent = text;
            relayout();
          };
          if (d.dynamic) dynamicRisers.push({ place, value: d.value, fmt: d.fmt });
          else place(d.v, d.text);
        }
        bx += bw + gap;
      }
    });
  }
  function updateRisers(year) {
    for (const r of dynamicRisers) {
      const v = r.value(year);
      r.place(v, r.fmt(v));
    }
  }
  function growRisers() {
    if (motion.reduced) return;
    riserBars.forEach((rect, i) => {
      rect.style.transition = 'none';
      rect.style.transform = 'scaleY(0)';
    });
    // force a style flush so the grow transition runs from zero
    void gRisers.getBoundingClientRect();
    riserBars.forEach((rect, i) => {
      rect.style.transition = `transform 420ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 45}ms`;
      rect.style.transform = 'scaleY(1)';
    });
  }

  /* ---------- nodes (transform-positioned so the view can morph) ---------- */
  const gNodes = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(gNodes);
  // D15: a persistent selection ring, distinct from the year-driven active
  // fill; survives re-renders because the choice lives in uiState.
  function applySelection(id) {
    nodeEls.forEach((el, i) => el.classList.toggle('selected', NODES[i].id === id));
  }
  const nodeEls = NODES.map((n, i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `node-marker${n.hero ? ' hero' : ''}`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${n.name} — ${n.full}`);
    const above = i % 2 === 0;
    const size = n.hero ? 13 : 10;
    g.innerHTML = `
      <rect x="-22" y="-22" width="44" height="44" fill="transparent" stroke="none"></rect>
      <rect class="sel-ring" x="${-size / 2 - 4}" y="${-size / 2 - 4}" width="${size + 8}" height="${size + 8}"></rect>
      <rect class="mark" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"></rect>
      <text x="0" y="${above ? -12 : 22}" text-anchor="middle">${n.name}</text>`;
    g.setAttribute('transform', `translate(${mapPts[i][0]},${mapPts[i][1]})`);
    const select = () => {
      if (uiState) uiState.selected = n.id;
      applySelection(n.id);
      onNodeSelect(n);
    };
    g.addEventListener('click', select);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
    gNodes.appendChild(g);
    return g;
  });
  if (uiState && uiState.selected) applySelection(uiState.selected);
  const sectionLabelY = 34;

  // one-shot stamp echo when a node activates
  function ping(i) {
    if (motion.reduced) return;
    const n = NODES[i];
    const size = n.hero ? 13 : 10;
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('class', 'node-ping');
    r.setAttribute('x', -size / 2);
    r.setAttribute('y', -size / 2);
    r.setAttribute('width', size);
    r.setAttribute('height', size);
    r.addEventListener('animationend', () => r.remove());
    nodeEls[i].appendChild(r);
  }

  /* ---------- particle layer ---------- */
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  // F30: particles are streaks, not text — on a low-RAM device cap the
  // backing store at 1.5× instead of 2×
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    navigator.deviceMemory && navigator.deviceMemory <= 4 ? 1.5 : 2
  );
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  // F32: scale once per surface instead of multiplying every coordinate in
  // every drawStreak — fewer multiplies per particle per frame
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const SAMPLES = 240;
  let tracePts = [];
  function sampleTrace() {
    tracePts = [];
    const len = traceFill.getTotalLength();
    for (let i = 0; i <= SAMPLES; i++) {
      const p = traceFill.getPointAtLength((i / SAMPLES) * len);
      tracePts.push([p.x, p.y]);
    }
  }
  sampleTrace();
  const pointAt = (t) => tracePts[Math.max(0, Math.min(SAMPLES, Math.round(t * SAMPLES)))];

  /* FLOWS geometry */
  const clayPt = mapPts[NODES.findIndex((n) => n.id === 'clay')];
  const centroidOf = {};
  for (const f of counties.features) centroidOf[String(f.id)] = path.centroid(f);
  let flowArcs = [];
  let jobsPerParticle = 0;
  if (lodes && lodes.origins) {
    const mobile = W < 700;
    const cap = mobile ? 150 : 400;
    const usable = lodes.origins.filter((o) => centroidOf[o.fips]);
    const sum = usable.reduce((a, o) => a + o.jobs, 0);
    jobsPerParticle = Math.ceil(sum / cap);
    const maxJobs = Math.max(...usable.map((o) => o.jobs));
    flowArcs = usable.map((o) => {
      const p0 = centroidOf[o.fips];
      const p1 = clayPt;
      const mx = (p0[0] + p1[0]) / 2;
      const my = (p0[1] + p1[1]) / 2;
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const dist = Math.hypot(dx, dy) || 1;
      const cp = [mx + (dy / dist) * dist * 0.22, my - (dx / dist) * dist * 0.22];
      return {
        p0,
        cp,
        p1,
        jobs: o.jobs,
        n: Math.max(o.jobs >= jobsPerParticle / 2 ? 1 : 0, Math.round(o.jobs / jobsPerParticle)),
        w: 1 + 4.5 * (o.jobs / maxJobs),
      };
    });
  }
  const arcPoint = (a, t) => {
    const u = 1 - t;
    return [
      u * u * a.p0[0] + 2 * u * t * a.cp[0] + t * t * a.p1[0],
      u * u * a.p0[1] + 2 * u * t * a.cp[1] + t * t * a.p1[1],
    ];
  };

  /* engine state */
  let mode = (uiState && uiState.particles) || 'ambient';
  let view = (uiState && uiState.view) || 'map';
  let particles = [];
  let targetCount = 0;
  let running = false;
  let visible = document.visibilityState === 'visible';
  let onscreen = true;
  let lastFrame = null;
  let currentYear = YEAR_MIN;
  let prevYear = null;
  let destroyed = false;
  let morphing = false;

  const effectiveMode = () => (view === 'section' ? 'ambient' : mode);
  const FADE_IN = 0.45; // seconds
  const EDGE = 0.06; // path-fraction fade zone at the ends

  function spawnAmbient(initial) {
    const progress = traceProgress(currentYear);
    particles.push({
      t: Math.random() * progress,
      speed: 0.014 + Math.random() * 0.024,
      jitter: (Math.random() - 0.5) * 8,
      size: 1.3 + Math.random() * 1.5,
      base: 0.32 + Math.random() * 0.42,
      age: initial ? FADE_IN : 0,
      dying: 0,
    });
  }
  function buildFlowPool() {
    particles = [];
    for (const a of flowArcs) {
      for (let i = 0; i < a.n; i++) {
        particles.push({
          arc: a,
          t: Math.random(),
          speed: 0.07 + Math.random() * 0.11,
          size: 1.4 + Math.random() * 1.3,
          base: 0.28 + Math.random() * 0.36,
          age: FADE_IN,
          dying: 0,
        });
      }
    }
  }

  function drawStreak(x0, y0, x1, y1, size, alpha) {
    ctx.globalAlpha = alpha * 0.45;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    const s = size * 1.6;
    ctx.fillRect(x1 - s / 2, y1 - s / 2, s, s);
  }

  function drawStaticFlows() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#b5562a';
    ctx.globalAlpha = 0.38;
    for (const a of flowArcs) {
      ctx.lineWidth = a.w;
      ctx.beginPath();
      ctx.moveTo(a.p0[0], a.p0[1]);
      ctx.quadraticCurveTo(a.cp[0], a.cp[1], a.p1[0], a.p1[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* F29: adaptive pool — a low-end device keeps the atmosphere without the
     jank. Rolling frame-time average; sustained >25ms for 2s scales the pool
     down 30% (repeatable), sustained recovery scales it back up. */
  let emaMs = 16.7;
  let slowSince = null;
  let calmSince = null;
  let poolScale = 1;
  function adaptPool(frameMs, t) {
    emaMs = emaMs * 0.92 + frameMs * 0.08;
    if (emaMs > 25) {
      calmSince = null;
      if (slowSince === null) slowSince = t;
      else if (t - slowSince > 2000 && poolScale > 0.3) {
        poolScale = Math.max(0.3, poolScale * 0.7);
        slowSince = null;
      }
    } else {
      slowSince = null;
      if (poolScale < 1 && emaMs < 18) {
        if (calmSince === null) calmSince = t;
        else if (t - calmSince > 4000) {
          poolScale = Math.min(1, poolScale / 0.7);
          calmSince = null;
        }
      } else {
        calmSince = null;
      }
    }
  }

  function frame(t) {
    if (!running || destroyed) return;
    if (lastFrame === null) lastFrame = t;
    const frameMs = t - lastFrame;
    const dt = Math.min(0.05, frameMs / 1000);
    lastFrame = t;
    if (frameMs > 0) adaptPool(frameMs, t);

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#b5562a';
    ctx.fillStyle = '#b5562a';
    const m = effectiveMode();

    if (m === 'ambient') {
      // pool management: spawn with fade-in, retire with fade-out
      const scaledTarget = Math.round(targetCount * poolScale);
      if (particles.length < scaledTarget) {
        for (let i = particles.length; i < scaledTarget; i++) spawnAmbient(false);
      } else if (particles.length > scaledTarget) {
        let excess = particles.length - scaledTarget;
        for (const p of particles) {
          if (excess <= 0) break;
          if (!p.dying) {
            p.dying = 0.0001;
            excess--;
          }
        }
      }
      const progress = traceProgress(currentYear);
      if (!morphing) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          if (p.arc) {
            particles.splice(i, 1);
            continue;
          }
          p.age += dt;
          if (p.dying) {
            p.dying += dt * 2.2;
            if (p.dying >= 1) {
              particles.splice(i, 1);
              continue;
            }
          }
          p.t += p.speed * dt;
          if (p.t > progress) {
            p.t = 0;
            p.age = 0;
          }
          const edge = Math.min(1, p.t / EDGE, Math.max(0.001, (progress - p.t) / EDGE));
          const alpha =
            p.base * Math.min(1, p.age / FADE_IN) * Math.max(0, Math.min(1, edge)) * (1 - (p.dying || 0));
          if (alpha <= 0.01) continue;
          const tail = Math.min(p.t, p.speed * 0.55);
          const [x0, y0] = pointAt(p.t - tail);
          const [x1, y1] = pointAt(p.t);
          drawStreak(x0, y0 + p.jitter, x1, y1 + p.jitter, p.size, alpha);
        }
      }
    } else {
      for (const p of particles) {
        if (!p.arc) continue;
        p.age += dt;
        p.t += p.speed * dt;
        if (p.t > 1) {
          p.t = 0;
          p.age = 0;
        }
        const edge = Math.min(1, p.t / EDGE, (1 - p.t) / EDGE);
        const alpha = p.base * Math.min(1, p.age / FADE_IN) * Math.max(0, Math.min(1, edge));
        if (alpha <= 0.01) continue;
        const tail = Math.min(p.t, p.speed * 0.4);
        const [x0, y0] = arcPoint(p.arc, p.t - tail);
        const [x1, y1] = arcPoint(p.arc, p.t);
        drawStreak(x0, y0, x1, y1, p.size, alpha);
      }
    }
    ctx.globalAlpha = 1;
  }

  let unsubFrame = null; // F37: the engine rides the shared ticker
  function startEngine() {
    if (running || motion.reduced || !visible || !onscreen || destroyed) return;
    running = true;
    lastFrame = null;
    unsubFrame = onTick(frame);
  }
  function stopEngine() {
    running = false;
    if (unsubFrame) {
      unsubFrame();
      unsubFrame = null;
    }
    ctx.clearRect(0, 0, W, H);
  }
  function evalEngine() {
    if (motion.reduced) {
      stopEngine();
      if (effectiveMode() === 'flows' && visible && onscreen) drawStaticFlows();
      return;
    }
    if (!visible || !onscreen) stopEngine();
    else startEngine();
  }

  const onVis = () => {
    visible = document.visibilityState === 'visible';
    evalEngine();
  };
  document.addEventListener('visibilitychange', onVis);
  const io = new IntersectionObserver(
    (entries) => {
      onscreen = entries[0].isIntersecting;
      evalEngine();
    },
    { threshold: 0.05 }
  );
  io.observe(container);
  onMotionChange(() => {
    const ease = motion.reduced ? 'none' : 'opacity 650ms cubic-bezier(0.65, 0, 0.35, 1)';
    gGeo.style.transition = ease;
    gSection.style.transition = ease;
    evalEngine();
  });

  function setParticleMode(m) {
    mode = m;
    if (effectiveMode() === 'flows') buildFlowPool();
    else particles = particles.filter((p) => !p.arc);
    evalEngine();
  }
  if (effectiveMode() === 'flows') buildFlowPool();
  if (onFlowInfo && lodes) onFlowInfo({ jobsPerParticle, vintage: lodes.provenance.vintage });

  /* ---------- view morph ---------- */
  let morphRaf = null;
  function applyView(v, animate) {
    view = v;
    const toSection = v === 'section';
    const dur = animate && !motion.reduced ? 650 : 0;

    nodeEls.forEach((g, i) => {
      g.style.transition = dur ? `transform ${dur}ms cubic-bezier(0.65, 0, 0.35, 1)` : 'none';
      const p = toSection ? sectionPts[i] : mapPts[i];
      g.setAttribute('transform', `translate(${p[0]},${p[1]})`);
      const text = g.querySelector('text');
      text.setAttribute('y', toSection ? sectionLabelY : i % 2 === 0 ? -12 : 22);
    });

    gGeo.style.opacity = toSection ? '0.13' : '1';
    gSection.style.opacity = toSection ? '1' : '0';

    if (morphRaf) {
      morphRaf();
      morphRaf = null;
    }
    const from = samplePathCurrent();
    const to = toSection ? sectionSamples : mapSamples;
    if (!dur) {
      const d = toSection ? sectionTraceD : mapTraceD;
      traceBase.setAttribute('d', d);
      traceFill.setAttribute('d', d);
      finishMorph();
    } else {
      morphing = true;
      const t0 = performance.now();
      // F31: dasharray during a morph needs continuity, not geometric truth —
      // lerp between the two measured lengths instead of forcing
      // getTotalLength() per frame
      const fromLen = traceLen;
      const toLen = toSection ? sectionTraceLen : mapTraceLen;
      // F37: rides the shared ticker; morphRaf is now the unsubscribe fn
      morphRaf = onTick((now) => {
        const k = easeInOut(Math.min(1, (now - t0) / dur));
        const pts2 = from.map((p, i) => [p[0] + (to[i][0] - p[0]) * k, p[1] + (to[i][1] - p[1]) * k]);
        const d = toD(pts2);
        traceBase.setAttribute('d', d);
        traceFill.setAttribute('d', d);
        traceLen = fromLen + (toLen - fromLen) * k;
        traceFill.style.strokeDasharray = `${traceLen}`;
        traceFill.style.strokeDashoffset = `${traceLen * (1 - traceProgress(currentYear))}`;
        placeTip(traceProgress(currentYear));
        if ((now - t0) / dur >= 1) {
          morphRaf();
          morphRaf = null;
          finishMorph();
        }
      });
    }

    function finishMorph() {
      morphing = false;
      traceLen = traceFill.getTotalLength();
      traceFill.style.strokeDasharray = `${traceLen}`;
      traceFill.style.strokeDashoffset = `${traceLen * (1 - traceProgress(currentYear))}`;
      placeTip(traceProgress(currentYear));
      sampleTrace();
      if (toSection) {
        updateRisers(currentYear);
        growRisers();
      }
      particles = particles.filter((p) => (effectiveMode() === 'flows' ? p.arc : !p.arc));
      if (effectiveMode() === 'flows' && particles.length === 0) buildFlowPool();
      evalEngine();
    }
  }
  function samplePathCurrent() {
    const out = [];
    const len = traceFill.getTotalLength();
    for (let i = 0; i <= K; i++) {
      const p = traceFill.getPointAtLength((i / K) * len);
      out.push([p.x, p.y]);
    }
    return out;
  }
  function setView(v, animate = true) {
    applyView(v, animate);
  }
  if (view === 'section') applyView('section', false);

  /* ---------- year-driven update ---------- */
  function traceProgress(year) {
    return Math.max(0.03, (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN));
  }

  function update(year) {
    NODES.forEach((n, i) => {
      const active = year >= n.activeFrom;
      nodeEls[i].classList.toggle('active', active);
      if (prevYear !== null && prevYear < n.activeFrom && active) ping(i);
    });
    prevYear = year;
    currentYear = year;
    if (!morphing) {
      const progress = traceProgress(year);
      traceFill.style.strokeDashoffset = `${traceLen * (1 - progress)}`;
      placeTip(progress);
    }
    if (view === 'section') updateRisers(year);
    const mobile = W < 700;
    const base = mobile ? 4 : 8;
    const span = mobile ? 18 : 38;
    targetCount = Math.round(base + (span * (year - YEAR_MIN)) / (YEAR_MAX - YEAR_MIN));
    evalEngine();
  }

  function destroy() {
    destroyed = true;
    stopEngine();
    if (morphRaf) {
      morphRaf(); // unsubscribe from the ticker
      morphRaf = null;
    }
    document.removeEventListener('visibilitychange', onVis);
    io.disconnect();
  }

  return { update, destroy, setParticleMode, setView, projection, svg, nodePoints: mapPts };
}
