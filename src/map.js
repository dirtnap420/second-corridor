// map.js — the corridor map: NY geography, five nodes, corridor trace,
// canvas particle layer (ambient mode). All surfaces driven by update(year).
import { geoConicConformal, geoPath, line as d3line, curveCatmullRom } from 'd3';
import { feature, mesh, merge } from 'topojson-client';
import { NODES, YEAR_MIN, YEAR_MAX } from './data.js';

const VB_W = 980;
const VB_H = 540;
const SVG_NS = 'http://www.w3.org/2000/svg';

export function initMap(container, topo, { onNodeSelect, motion, onMotionChange }) {
  /* ---------- projection (noted in README) ---------- */
  const counties = feature(topo, topo.objects.counties);
  const projection = geoConicConformal()
    .parallels([40.5, 44.5])
    .rotate([76.5, 0])
    .fitExtent(
      [
        [16, 16],
        [VB_W - 16, VB_H - 44],
      ],
      counties
    );
  const path = geoPath(projection);

  /* ---------- svg ---------- */
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Corridor map of New York State with five semiconductor nodes');
  svg.innerHTML = `<title>The corridor map</title>
    <desc>New York State counties with five corridor nodes: STAMP, RIT, Clay, Marcy, and Albany NanoTech, connected by a corridor trace along I-90.</desc>`;
  container.appendChild(svg);

  // state silhouette (silicon fill) + interior county hairlines + ink outline
  const stateShape = merge(
    topo,
    topo.objects.counties.geometries
  );
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

  /* ---------- particle layer (ambient) ---------- */
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let dpr = 1;
  function sizeCanvas() {
    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  new ResizeObserver(sizeCanvas).observe(container);
  sizeCanvas();

  // sample the trace once in viewBox coords
  const SAMPLES = 240;
  const tracePts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = traceFill.getPointAtLength((i / SAMPLES) * traceLen);
    tracePts.push([p.x, p.y]);
  }
  const pointAt = (t) => tracePts[Math.max(0, Math.min(SAMPLES, Math.round(t * SAMPLES)))];

  const particles = [];
  function spawn() {
    particles.push({
      t: Math.random(),
      speed: 0.012 + Math.random() * 0.02, // path fractions per second
      jitter: (Math.random() - 0.5) * 10,
      size: 1.4 + Math.random() * 1.4,
      alpha: 0.35 + Math.random() * 0.4,
    });
  }

  let targetCount = 0;
  let running = false;
  let visible = true;
  let onscreen = true;
  let lastFrame = null;
  let currentYear = YEAR_MIN;

  function frame(t) {
    if (!running) return;
    if (lastFrame === null) lastFrame = t;
    const dt = Math.min(0.05, (t - lastFrame) / 1000);
    lastFrame = t;

    while (particles.length < targetCount) spawn();
    if (particles.length > targetCount) particles.length = targetCount;

    const rect = container.getBoundingClientRect();
    const sx = (canvas.width / dpr / VB_W) * dpr;
    const sy = (canvas.height / dpr / VB_H) * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const progress = traceProgress(currentYear);
    ctx.fillStyle = '#b5562a';
    for (const p of particles) {
      p.t += p.speed * dt;
      if (p.t > progress) p.t = 0;
      const [px, py] = pointAt(p.t);
      ctx.globalAlpha = p.alpha;
      const s = p.size * dpr;
      ctx.fillRect(px * sx - s / 2, py * sy + p.jitter * sy * 0.1 - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  function startEngine() {
    if (running || motion.reduced || !visible || !onscreen) return;
    running = true;
    lastFrame = null;
    requestAnimationFrame(frame);
  }
  function stopEngine() {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function evalEngine() {
    if (motion.reduced || !visible || !onscreen) stopEngine();
    else startEngine();
  }

  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible';
    evalEngine();
  });
  new IntersectionObserver(
    (entries) => {
      onscreen = entries[0].isIntersecting;
      evalEngine();
    },
    { threshold: 0.05 }
  ).observe(container);
  onMotionChange(() => evalEngine());

  /* ---------- year-driven update ---------- */
  function traceProgress(year) {
    return Math.max(0.03, (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN));
  }

  function update(year) {
    currentYear = year;
    // node states
    NODES.forEach((n, i) => {
      nodeEls[i].classList.toggle('active', year >= n.activeFrom);
    });
    // trace fill
    traceFill.style.strokeDashoffset = `${traceLen * (1 - traceProgress(year))}`;
    // particle density: sparse atmosphere scaling gently with year
    const mobile = window.innerWidth < 768;
    const base = mobile ? 4 : 8;
    const span = mobile ? 18 : 38;
    targetCount = Math.round(base + (span * (year - YEAR_MIN)) / (YEAR_MAX - YEAR_MIN));
    evalEngine();
  }

  return { update, projection, svg, nodePoints: pts };
}
