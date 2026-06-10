// map.js — the corridor instrument's main stage. Two views:
//   MAP     — NY geography, five nodes, corridor trace
//   SECTION — a stationing diagram: nodes projected onto a datum line, x by
//             great-circle distance from STAMP, with data risers per node
// Two particle modes: AMBIENT (atmosphere) and FLOWS (LODES-driven arcs; map
// view only — flows are geography-bound). All surfaces driven by update(year).
import { geoConicConformal, geoPath, geoDistance, line as d3line, curveCatmullRom } from 'd3';
import { feature, mesh, merge } from 'topojson-client';
import { NODES, YEAR_MIN, YEAR_MAX, investAt } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const EARTH_MI = 3958.8;

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
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Corridor map of New York State with five semiconductor nodes');
  svg.innerHTML = `<title>The corridor instrument</title>
    <desc>New York State counties with five corridor nodes — STAMP, RIT, Clay, Marcy, and Albany NanoTech — connected by a corridor trace; switchable to a stationing diagram with data risers.</desc>`;
  container.appendChild(svg);

  const stateShape = merge(topo, topo.objects.counties.geometries);
  const interior = mesh(topo, topo.objects.counties, (a, b) => a !== b);

  const gGeo = document.createElementNS(SVG_NS, 'g');
  gGeo.style.transition = motion.reduced ? 'none' : 'opacity 600ms linear';
  gGeo.innerHTML = `
    <path class="county" d="${path(stateShape)}"></path>
    <path d="${path(interior)}" fill="none" stroke="var(--hairline)" stroke-width="0.6"></path>
    <path class="state-outline" d="${path(stateShape)}"></path>`;
  svg.appendChild(gGeo);

  /* ---------- node geometry: map + section positions ---------- */
  const mapPts = NODES.map((n) => projection(n.lonlat));
  const distMi = NODES.map((n) => geoDistance(NODES[0].lonlat, n.lonlat) * EARTH_MI);
  const totalMi = distMi[distMi.length - 1];
  const SM = { l: 56, r: 30 };
  const datumY = Math.round(H * 0.62);
  const sectionPts = distMi.map((d) => [
    SM.l + (d / totalMi) * (W - SM.l - SM.r),
    datumY,
  ]);

  /* ---------- corridor trace (morphable) ---------- */
  const K = 64; // morph samples
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
    <path class="trace-fill" d="${mapTraceD}"></path>`;
  svg.appendChild(gTrace);
  const traceBase = gTrace.querySelector('.trace-base');
  const traceFill = gTrace.querySelector('.trace-fill');
  let traceLen = traceFill.getTotalLength();
  traceFill.style.strokeDasharray = `${traceLen}`;
  traceFill.style.strokeDashoffset = `${traceLen}`;

  /* ---------- section chrome (datum, mileage ticks, risers) ---------- */
  const gSection = document.createElementNS(SVG_NS, 'g');
  gSection.style.transition = motion.reduced ? 'none' : 'opacity 600ms linear';
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
    html += `<text x="${W - SM.r}" y="${datumY - 8}" text-anchor="end" class="chart-label" style="fill:var(--copper)">GREAT-CIRCLE ${Math.round(totalMi)} MI</text>`;
    html += `<g class="risers"></g>`;
    html += `<text x="${SM.l}" y="${H - 8}" class="chart-label">RISERS — COPPER: CUMULATIVE CAPITAL $B · INK: COUNTY NAICS-3344 EMP (QCEW) · VIOLET: COMPLETIONS (IPEDS)</text>`;
    gSection.innerHTML = html;
  }
  svg.appendChild(gSection);
  const gRisers = gSection.querySelector('.risers');

  /* ---------- riser data ---------- */
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
    const total = rows.reduce((a, r) => a + (r.cert || 0) + (r.assoc || 0) + (r.bach || 0) + (r.grad || 0), 0);
    return { year: last, value: total };
  }
  const RISER_MAX_H = Math.min(120, datumY - 60);

  function buildRisers(year) {
    const empMax = 800;
    const capMax = 100;
    const compMax = 400;
    let html = '';
    NODES.forEach((n, i) => {
      const x = sectionPts[i][0];
      const defs = [];
      if (n.id === 'clay') {
        defs.push({ v: investAt(year), max: capMax, color: 'var(--copper)', label: `$${investAt(year).toFixed(1)}B` });
      }
      if (n.id === 'albany' && year >= 2024) {
        defs.push({ v: 0.825, max: capMax, color: 'var(--copper)', label: '$0.8B' });
      }
      const semi = latestSemi(n.county);
      if (semi) {
        if (semi.value && typeof semi.value === 'object') {
          defs.push({ suppressed: true });
        } else {
          defs.push({ v: semi.value, max: empMax, color: 'var(--ink)', label: String(semi.value) });
        }
      }
      if (n.id === 'rit') {
        const c = ritCompletions();
        if (c) defs.push({ v: c.value, max: compMax, color: 'var(--violet)', label: String(c.value) });
      }
      const bw = 8;
      const gap = 4;
      const totalW = defs.length * bw + (defs.length - 1) * gap;
      let bx = x - totalW / 2;
      for (const d of defs) {
        if (d.suppressed) {
          html += `<text transform="rotate(-90 ${bx + 4} ${datumY - 8})" x="${bx + 4}" y="${datumY - 8}" class="chart-label">QCEW SUPPR.</text>`;
        } else {
          const h = Math.max(1.5, (d.v / d.max) * RISER_MAX_H);
          html += `<rect x="${bx}" y="${datumY - h}" width="${bw}" height="${h}" fill="${d.color}"></rect>
            <text transform="rotate(-90 ${bx + 7} ${datumY - h - 6})" x="${bx + 7}" y="${datumY - h - 6}" class="chart-label">${d.label}</text>`;
        }
        bx += bw + gap;
      }
    });
    gRisers.innerHTML = html;
  }

  /* ---------- nodes (transform-positioned so the view can morph) ---------- */
  const gNodes = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(gNodes);
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
      <rect class="mark" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"></rect>
      <text x="0" y="${above ? -12 : 22}" text-anchor="middle">${n.name}</text>`;
    g.setAttribute('transform', `translate(${mapPts[i][0]},${mapPts[i][1]})`);
    const select = () => onNodeSelect(n);
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
  // in SECTION view labels sit below the datum to clear the risers
  const sectionLabelY = 34;

  /* ---------- particle layer ---------- */
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

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
  let destroyed = false;
  let morphing = false;

  const effectiveMode = () => (view === 'section' ? 'ambient' : mode);

  function buildFlowPool() {
    particles = [];
    for (const a of flowArcs) {
      for (let i = 0; i < a.n; i++) {
        particles.push({
          arc: a,
          t: Math.random(),
          speed: 0.08 + Math.random() * 0.1,
          size: 1.5 + Math.random() * 1.2,
          alpha: 0.3 + Math.random() * 0.35,
        });
      }
    }
  }
  function spawnAmbient() {
    particles.push({
      t: Math.random(),
      speed: 0.012 + Math.random() * 0.02,
      jitter: (Math.random() - 0.5) * 8,
      size: 1.4 + Math.random() * 1.4,
      alpha: 0.35 + Math.random() * 0.4,
    });
  }

  function drawStaticFlows() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#b5562a';
    ctx.globalAlpha = 0.38;
    for (const a of flowArcs) {
      ctx.lineWidth = a.w * dpr;
      ctx.beginPath();
      ctx.moveTo(a.p0[0] * dpr, a.p0[1] * dpr);
      ctx.quadraticCurveTo(a.cp[0] * dpr, a.cp[1] * dpr, a.p1[0] * dpr, a.p1[1] * dpr);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function frame(t) {
    if (!running || destroyed) return;
    if (lastFrame === null) lastFrame = t;
    const dt = Math.min(0.05, (t - lastFrame) / 1000);
    lastFrame = t;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#b5562a';
    const m = effectiveMode();

    if (m === 'ambient') {
      if (!morphing) {
        while (particles.length < targetCount && particles.length < 60) spawnAmbient();
        if (particles.length > targetCount) particles.length = targetCount;
        const progress = traceProgress(currentYear);
        for (const p of particles) {
          if (p.arc) continue; // leftover flow particles after a mode switch
          p.t += p.speed * dt;
          if (p.t > progress) p.t = 0;
          const [px, py] = pointAt(p.t);
          ctx.globalAlpha = p.alpha;
          const s = p.size * dpr;
          ctx.fillRect(px * dpr - s / 2, (py + (p.jitter || 0)) * dpr - s / 2, s, s);
        }
      }
    } else {
      for (const p of particles) {
        if (!p.arc) continue;
        p.t += p.speed * dt;
        if (p.t > 1) p.t = 0;
        const [px, py] = arcPoint(p.arc, p.t);
        ctx.globalAlpha = p.alpha;
        const s = p.size * dpr;
        ctx.fillRect(px * dpr - s / 2, py * dpr - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  function startEngine() {
    if (running || motion.reduced || !visible || !onscreen || destroyed) return;
    running = true;
    lastFrame = null;
    requestAnimationFrame(frame);
  }
  function stopEngine() {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    gGeo.style.transition = motion.reduced ? 'none' : 'opacity 600ms linear';
    gSection.style.transition = motion.reduced ? 'none' : 'opacity 600ms linear';
    evalEngine();
  });

  function setParticleMode(m) {
    mode = m;
    if (effectiveMode() === 'flows') buildFlowPool();
    else particles = [];
    evalEngine();
  }
  if (effectiveMode() === 'flows') buildFlowPool();
  if (onFlowInfo && lodes) onFlowInfo({ jobsPerParticle, vintage: lodes.provenance.vintage });

  /* ---------- view morph ---------- */
  let morphRaf = null;
  function applyView(v, animate) {
    view = v;
    const toSection = v === 'section';
    const dur = animate && !motion.reduced ? 600 : 0;

    // node transforms via CSS transition
    nodeEls.forEach((g, i) => {
      g.style.transition = dur ? `transform ${dur}ms linear` : 'none';
      const p = toSection ? sectionPts[i] : mapPts[i];
      g.setAttribute('transform', `translate(${p[0]},${p[1]})`);
      const text = g.querySelector('text');
      if (toSection) {
        text.setAttribute('y', sectionLabelY);
      } else {
        text.setAttribute('y', i % 2 === 0 ? -12 : 22);
      }
    });

    gGeo.style.opacity = toSection ? '0.13' : '1';
    gSection.style.opacity = toSection ? '1' : '0';

    // trace morph
    if (morphRaf) cancelAnimationFrame(morphRaf);
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
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const pts2 = from.map((p, i) => [
          p[0] + (to[i][0] - p[0]) * k,
          p[1] + (to[i][1] - p[1]) * k,
        ]);
        const d = toD(pts2);
        traceBase.setAttribute('d', d);
        traceFill.setAttribute('d', d);
        traceLen = traceFill.getTotalLength();
        traceFill.style.strokeDasharray = `${traceLen}`;
        traceFill.style.strokeDashoffset = `${traceLen * (1 - traceProgress(currentYear))}`;
        if (k < 1) morphRaf = requestAnimationFrame(step);
        else finishMorph();
      };
      morphRaf = requestAnimationFrame(step);
    }

    function finishMorph() {
      morphing = false;
      traceLen = traceFill.getTotalLength();
      traceFill.style.strokeDasharray = `${traceLen}`;
      traceFill.style.strokeDashoffset = `${traceLen * (1 - traceProgress(currentYear))}`;
      sampleTrace();
      if (toSection) buildRisers(currentYear);
      // flows are geography-bound; section view falls back to ambient
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
    currentYear = year;
    NODES.forEach((n, i) => {
      nodeEls[i].classList.toggle('active', year >= n.activeFrom);
    });
    if (!morphing) {
      traceFill.style.strokeDashoffset = `${traceLen * (1 - traceProgress(year))}`;
    }
    if (view === 'section') buildRisers(year);
    const mobile = W < 700;
    const base = mobile ? 4 : 8;
    const span = mobile ? 18 : 38;
    targetCount = Math.round(base + (span * (year - YEAR_MIN)) / (YEAR_MAX - YEAR_MIN));
    evalEngine();
  }

  function destroy() {
    destroyed = true;
    stopEngine();
    if (morphRaf) cancelAnimationFrame(morphRaf);
    document.removeEventListener('visibilitychange', onVis);
    io.disconnect();
  }

  return { update, destroy, setParticleMode, setView, projection, svg, nodePoints: mapPts };
}
