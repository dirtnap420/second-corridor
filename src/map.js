// map.js — the corridor map: NY geography, five nodes, corridor trace, and the
// canvas particle layer. Two particle modes: AMBIENT (atmosphere, density scales
// gently with scrub year) and FLOWS (driven by the LODES commuting aggregate —
// each origin county's centroid emits particles along an arc toward Clay at a
// rate proportional to measured flow). Rendered at container width.
import { geoConicConformal, geoPath, line as d3line, curveCatmullRom } from 'd3';
import { feature, mesh, merge } from 'topojson-client';
import { NODES, YEAR_MIN, YEAR_MAX } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderMap(container, topo, opts, width) {
  const { onNodeSelect, motion, onMotionChange, lodes, uiState, onFlowInfo } = opts;
  const W = Math.max(320, width);
  const H = Math.round(Math.min(560, Math.max(220, W * 0.55)));

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
  svg.innerHTML = `<title>The corridor map</title>
    <desc>New York State counties with five corridor nodes: STAMP, RIT, Clay, Marcy, and Albany NanoTech, connected by a corridor trace along I-90.</desc>`;
  container.appendChild(svg);

  const stateShape = merge(topo, topo.objects.counties.geometries);
  const interior = mesh(topo, topo.objects.counties, (a, b) => a !== b);

  const gGeo = document.createElementNS(SVG_NS, 'g');
  gGeo.innerHTML = `
    <path class="county" d="${path(stateShape)}"></path>
    <path d="${path(interior)}" fill="none" stroke="var(--hairline)" stroke-width="0.6"></path>
    <path class="state-outline" d="${path(stateShape)}"></path>`;
  svg.appendChild(gGeo);

  /* ---------- corridor trace ---------- */
  const pts = NODES.map((n) => projection(n.lonlat));
  const traceGen = d3line()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(curveCatmullRom.alpha(0.7));
  const traceD = traceGen(pts);

  const gTrace = document.createElementNS(SVG_NS, 'g');
  gTrace.innerHTML = `
    <path class="trace-base" d="${traceD}"></path>
    <path class="trace-fill" d="${traceD}"></path>`;
  svg.appendChild(gTrace);
  const traceFill = gTrace.querySelector('.trace-fill');
  const traceLen = traceFill.getTotalLength();
  traceFill.style.strokeDasharray = `${traceLen}`;
  traceFill.style.strokeDashoffset = `${traceLen}`;

  /* ---------- nodes ---------- */
  const gNodes = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(gNodes);
  const nodeEls = NODES.map((n, i) => {
    const [x, y] = pts[i];
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `node-marker${n.hero ? ' hero' : ''}`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${n.name} — ${n.full}`);
    const above = i % 2 === 0;
    const size = n.hero ? 13 : 10;
    g.innerHTML = `
      <rect x="${x - 22}" y="${y - 22}" width="44" height="44" fill="transparent" stroke="none"></rect>
      <rect class="mark" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}"></rect>
      <text x="${x}" y="${above ? y - 12 : y + 22}" text-anchor="middle">${n.name}</text>`;
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

  /* ---------- particle layer ---------- */
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  // trace samples for ambient mode
  const SAMPLES = 240;
  const tracePts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = traceFill.getPointAtLength((i / SAMPLES) * traceLen);
    tracePts.push([p.x, p.y]);
  }
  const pointAt = (t) => tracePts[Math.max(0, Math.min(SAMPLES, Math.round(t * SAMPLES)))];

  /* ----- FLOWS geometry: arcs from origin-county centroids to Clay ----- */
  const clayPt = pts[NODES.findIndex((n) => n.id === 'clay')];
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
      // bow perpendicular to the chord, northward bias
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

  /* ----- engine state ----- */
  let mode = (uiState && uiState.particles) || 'ambient';
  let particles = [];
  let targetCount = 0;
  let running = false;
  let visible = document.visibilityState === 'visible';
  let onscreen = true;
  let lastFrame = null;
  let currentYear = YEAR_MIN;
  let destroyed = false;

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
    // reduced motion: static arcs, stroke width proportional to flow
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

    if (mode === 'ambient') {
      while (particles.length < targetCount) spawnAmbient();
      if (particles.length > targetCount) particles.length = targetCount;
      const progress = traceProgress(currentYear);
      for (const p of particles) {
        p.t += p.speed * dt;
        if (p.t > progress) p.t = 0;
        const [px, py] = pointAt(p.t);
        ctx.globalAlpha = p.alpha;
        const s = p.size * dpr;
        ctx.fillRect(px * dpr - s / 2, (py + p.jitter) * dpr - s / 2, s, s);
      }
    } else {
      for (const p of particles) {
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
      if (mode === 'flows' && visible && onscreen) drawStaticFlows();
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
  onMotionChange(() => evalEngine());

  function setParticleMode(m) {
    mode = m;
    if (mode === 'flows') buildFlowPool();
    else particles = [];
    evalEngine();
  }
  if (mode === 'flows') buildFlowPool();
  if (onFlowInfo && lodes) {
    onFlowInfo({ jobsPerParticle, vintage: lodes.provenance.vintage });
  }

  /* ---------- year-driven update ---------- */
  function traceProgress(year) {
    return Math.max(0.03, (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN));
  }

  function update(year) {
    currentYear = year;
    NODES.forEach((n, i) => {
      nodeEls[i].classList.toggle('active', year >= n.activeFrom);
    });
    traceFill.style.strokeDashoffset = `${traceLen * (1 - traceProgress(year))}`;
    const mobile = W < 700;
    const base = mobile ? 4 : 8;
    const span = mobile ? 18 : 38;
    targetCount = Math.round(base + (span * (year - YEAR_MIN)) / (YEAR_MAX - YEAR_MIN));
    evalEngine();
  }

  function destroy() {
    destroyed = true;
    stopEngine();
    document.removeEventListener('visibilitychange', onVis);
    io.disconnect();
  }

  return { update, destroy, setParticleMode, projection, svg, nodePoints: pts };
}
