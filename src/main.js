// main.js — orchestration: master scrubber state, hash sync, dials, ledger,
// citation marks, sources list. One year value drives every surface.
import './styles.css';
import {
  YEAR_MIN,
  YEAR_MAX,
  MILESTONES,
  INSTALLED_BASE,
  SOURCE_LIST,
  SOURCES,
  cite,
  investAt,
  constrLowAt,
  constrHighAt,
  permAt,
} from './data.js';
import './sources.js';
import { renderMap } from './map.js';
import { renderChart, buildChartNumbers } from './chart.js';
import {
  renderCapitalSankey,
  renderTalentSankey,
  buildCapitalNumbers,
  buildTalentNumbers,
} from './sankey.js';
import { responsiveMount } from './responsive.js';
import { initLive } from './live.js';
import { renderSite } from './site.js';
import { runIntro } from './intro.js';

/* ---------------- motion preference (live) ---------------- */
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const motion = { reduced: motionQuery.matches };
const motionListeners = [];
motionQuery.addEventListener('change', (e) => {
  motion.reduced = e.matches;
  motionListeners.forEach((fn) => fn(e.matches));
});
export function onMotionChange(fn) {
  motionListeners.push(fn);
}

/* ---------------- master year state ---------------- */
const state = { year: YEAR_MIN, playing: false, gliding: false };
const surfaces = []; // fn(year) — called on every change
export function onYear(fn) {
  surfaces.push(fn);
}
function notify() {
  for (const fn of surfaces) fn(state.year);
}

const slider = document.getElementById('year-slider');
const readout = document.getElementById('year-readout');
const playBtn = document.getElementById('play');

let hashGuard = false;
function setYear(y, { updateHash = true } = {}) {
  const clamped = Math.min(YEAR_MAX, Math.max(YEAR_MIN, y));
  state.year = clamped;
  const display = Math.floor(clamped + 1e-6);
  if (Number(slider.value) !== display) slider.value = display;
  if (readout.textContent !== String(display)) readout.textContent = String(display);
  if (updateHash && !state.playing) {
    hashGuard = true;
    history.replaceState(null, '', `#y=${display}`);
    hashGuard = false;
  }
  notify();
}

/* ---------------- year glide ----------------
   Discrete jumps (track clicks, ledger clicks, deep links) ease across the
   intervening years so every surface scrubs through them coherently.
   Keyboard steps and drag increments stay 1:1. */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
let glideRaf = null;
function cancelGlide() {
  if (glideRaf) cancelAnimationFrame(glideRaf);
  glideRaf = null;
  state.gliding = false;
}
function glideTo(target) {
  cancelGlide();
  if (motion.reduced || Math.abs(target - state.year) <= 1.01) {
    setYear(target);
    return;
  }
  const from = state.year;
  const dur = Math.min(950, 320 + Math.abs(target - from) * 26);
  const t0 = performance.now();
  state.gliding = true;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    setYear(from + (target - from) * easeOutCubic(k), { updateHash: k === 1 });
    if (k < 1) {
      glideRaf = requestAnimationFrame(step);
    } else {
      glideRaf = null;
      state.gliding = false;
    }
  };
  glideRaf = requestAnimationFrame(step);
}

slider.addEventListener('input', () => {
  stopPlay();
  const v = Number(slider.value);
  // a drag/arrow step moves by 1 → instant; a track click jumps → glide
  if (Math.abs(v - state.year) > 1.01) glideTo(v);
  else {
    cancelGlide();
    setYear(v);
  }
});

/* hash sync: #y=2030 deep links */
function readHash() {
  const m = location.hash.match(/y=(\d{4})/);
  if (m) {
    const y = Number(m[1]);
    if (y >= YEAR_MIN && y <= YEAR_MAX) return y;
  }
  return null;
}
window.addEventListener('hashchange', () => {
  if (hashGuard) return;
  const y = readHash();
  if (y !== null && y !== Math.floor(state.year)) {
    stopPlay();
    glideTo(y);
  }
});

/* ---------------- play ---------------- */
const PLAY_YEARS_PER_SEC = 1.8;
let rafId = null;
let lastT = null;

function stepPlay(t) {
  if (!state.playing) return;
  if (lastT === null) lastT = t;
  // F27: clamp the frame delta (matches the particle engine's clamp) — rAF
  // pauses in background tabs, and an unclamped delta teleports the year
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;
  const next = state.year + dt * PLAY_YEARS_PER_SEC;
  if (next >= YEAR_MAX) {
    setYear(YEAR_MAX);
    stopPlay();
    return;
  }
  setYear(next, { updateHash: false });
  rafId = requestAnimationFrame(stepPlay);
}

// reduced motion: discrete one-year steps instead of continuous tween
let discreteTimer = null;
function stepDiscrete() {
  if (!state.playing) return;
  const next = Math.floor(state.year) + 1;
  if (next >= YEAR_MAX) {
    setYear(YEAR_MAX);
    stopPlay();
    return;
  }
  setYear(next, { updateHash: false });
  discreteTimer = setTimeout(stepDiscrete, 700);
}

function startPlay() {
  cancelGlide();
  if (state.year >= YEAR_MAX) setYear(YEAR_MIN, { updateHash: false });
  state.playing = true;
  playBtn.setAttribute('aria-pressed', 'true');
  playBtn.textContent = 'Pause';
  if (motion.reduced) {
    discreteTimer = setTimeout(stepDiscrete, 700);
  } else {
    lastT = null;
    rafId = requestAnimationFrame(stepPlay);
  }
}
function stopPlay() {
  if (!state.playing) return;
  state.playing = false;
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.textContent = state.year >= YEAR_MAX ? 'Replay' : 'Play';
  if (rafId) cancelAnimationFrame(rafId);
  if (discreteTimer) clearTimeout(discreteTimer);
  rafId = null;
  discreteTimer = null;
  setYear(state.year); // settle hash
}
playBtn.addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));

/* ---------------- scrubber milestone ticks ---------------- */
function buildTicks() {
  const wrap = document.getElementById('scrub-ticks');
  const ms = new Set(MILESTONES.map((m) => m.year));
  let html = '';
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    const pct = ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
    const cls = ms.has(y) ? 'tick tick--milestone' : 'tick';
    html += `<span class="${cls}" style="left:${pct}%"></span>`;
  }
  wrap.innerHTML = html;
}

/* ---------------- milestone ledger ---------------- */
function buildLedger() {
  const wrap = document.getElementById('ledger');
  const ol = document.createElement('ol');
  ol.setAttribute('aria-label', 'Milestone ledger');
  for (const m of MILESTONES) {
    if (!m.src.some((s) => cite(s))) continue; // no citation → does not render
    const li = document.createElement('li');
    li.dataset.year = m.year;
    const marks = [...new Set(m.src.map((s) => cite(s)).filter(Boolean))]
      .map((n) => `<a class="cite" href="#sources">[${n}]</a>`)
      .join('');
    li.innerHTML = `<span class="yr">${m.year}</span><span>${m.label}${marks}</span>`;
    li.addEventListener('click', () => {
      stopPlay();
      glideTo(m.year);
    });
    ol.appendChild(li);
  }
  wrap.appendChild(ol);
  onYear((year) => {
    const y = Math.floor(year + 1e-6);
    let current = null;
    for (const li of ol.children) {
      const ly = Number(li.dataset.year);
      li.classList.toggle('past', ly < y);
      li.classList.toggle('current', false);
      if (ly <= y) current = li;
    }
    // highlight the latest milestone at/before the scrub year
    for (const li of ol.children) {
      if (Number(li.dataset.year) === (current ? Number(current.dataset.year) : -1)) {
        li.classList.add('current');
        li.classList.remove('past');
      }
    }
    if (current && !state.playing) {
      // keep the highlighted row in view inside the ledger scroll area
      const top = current.offsetTop - ol.clientHeight / 2;
      ol.scrollTo({
        top,
        behavior: motion.reduced || state.gliding ? 'auto' : 'smooth',
      });
    }
  });
}

/* ---------------- dials ---------------- */
const fmtB = (v) => `$${v.toFixed(1)}B`;
const fmtJobs = (v) => Math.round(v).toLocaleString('en-US');

function makeDial({ label, srcKeys, max, format, id }) {
  const div = document.createElement('div');
  div.className = 'dial';
  const marks = [...new Set(srcKeys.map((s) => cite(s)).filter(Boolean))]
    .map((n) => `<a class="cite" href="#sources">[${n}]</a>`)
    .join('');
  div.innerHTML = `
    <div class="dial-label">${label}${marks}</div>
    <svg width="110" height="62" viewBox="0 0 110 62" role="img" aria-hidden="true">
      <g class="dial-ticks"></g>
      <line class="dial-needle" x1="55" y1="56" x2="55" y2="14" stroke="var(--copper)" stroke-width="2"></line>
      <circle cx="55" cy="56" r="2.5" fill="var(--ink)"></circle>
    </svg>
    <div class="dial-value" id="${id}">—</div>`;
  // tick arc: 180° sweep
  const ticks = div.querySelector('.dial-ticks');
  let t = '';
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + (i / 20) * Math.PI;
    const r1 = 44;
    const r2 = i % 5 === 0 ? 36 : 40;
    const x1 = 55 + r1 * Math.cos(a);
    const y1 = 56 + r1 * Math.sin(a);
    const x2 = 55 + r2 * Math.cos(a);
    const y2 = 56 + r2 * Math.sin(a);
    t += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 5 === 0 ? 'var(--ink)' : 'var(--hairline)'}" stroke-width="1"></line>`;
  }
  ticks.innerHTML = t;
  const needle = div.querySelector('.dial-needle');
  const valueEl = div.querySelector('.dial-value');
  return {
    el: div,
    set(v, text) {
      const frac = Math.min(1, Math.max(0, v / max));
      const deg = -90 + frac * 180;
      needle.setAttribute('transform', `rotate(${deg.toFixed(2)} 55 56)`);
      valueEl.textContent = text !== undefined ? text : format(v);
    },
  };
}

/* the permanent-jobs dial is a wafer die-map: one die = 50 jobs, the full
   2045 wafer holds 180 dice; edge-clipped dice draw hairline-only and never
   fill — like real edge dice, they don't yield. */
const DIE_VALUE = 50;

function makeWaferDial({ label, srcKeys }) {
  const div = document.createElement('div');
  div.className = 'dial';
  const marks = [...new Set(srcKeys.map((s) => cite(s)).filter(Boolean))]
    .map((n) => `<a class="cite" href="#sources">[${n}]</a>`)
    .join('');
  const R = 47;
  const CX = 55;
  const CY = 52;
  // pick a pitch that yields at least 180 fully-interior dice
  let pitch = 7.2;
  let interior = [];
  let edge = [];
  while (pitch > 4) {
    interior = [];
    edge = [];
    const n = Math.ceil((2 * R) / pitch);
    const x0 = CX - (n * pitch) / 2;
    const y0 = CY - (n * pitch) / 2;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = x0 + c * pitch;
        const y = y0 + r * pitch;
        const corners = [
          [x, y],
          [x + pitch, y],
          [x, y + pitch],
          [x + pitch, y + pitch],
        ];
        const inside = corners.filter(
          ([px, py]) => Math.hypot(px - CX, py - CY) <= R
        ).length;
        if (inside === 4) interior.push([x, y]);
        else if (inside > 0) edge.push([x, y]);
      }
    }
    if (interior.length >= 180) break;
    pitch -= 0.2;
  }
  interior = interior.slice(0, Math.max(180, Math.min(interior.length, 200)));
  const die = pitch - 1.1;

  let dice = '';
  for (const [x, y] of edge) {
    dice += `<rect x="${(x + 0.55).toFixed(1)}" y="${(y + 0.55).toFixed(1)}" width="${die.toFixed(1)}" height="${die.toFixed(1)}" fill="none" stroke="var(--hairline)" stroke-width="0.5"></rect>`;
  }
  for (const [x, y] of interior) {
    dice += `<rect class="wdie" x="${(x + 0.55).toFixed(1)}" y="${(y + 0.55).toFixed(1)}" width="${die.toFixed(1)}" height="${die.toFixed(1)}" fill="none" stroke="var(--hairline)" stroke-width="0.5"></rect>`;
  }

  div.innerHTML = `
    <div class="dial-label">${label}${marks}</div>
    <svg width="110" height="104" viewBox="0 0 110 104" role="img" aria-hidden="true">
      <clipPath id="wafer-clip"><circle cx="${CX}" cy="${CY}" r="${R}"></circle></clipPath>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="var(--paper)" stroke="var(--ink)" stroke-width="1"></circle>
      <g clip-path="url(#wafer-clip)">${dice}</g>
    </svg>
    <div class="dial-value" id="dial-perm" style="font-size:13px">—</div>`;
  const dieEls = div.querySelectorAll('.wdie');
  const valueEl = div.querySelector('.dial-value');
  let lastFilled = -1;
  return {
    el: div,
    set(v) {
      const filled = Math.min(dieEls.length, Math.floor(v / DIE_VALUE));
      if (filled !== lastFilled) {
        // touch only the dice whose state changed — cheap at 60fps
        const lo = lastFilled === -1 ? 0 : Math.min(filled, lastFilled);
        const hi = lastFilled === -1 ? dieEls.length : Math.max(filled, lastFilled);
        for (let i = lo; i < hi; i++) {
          const d = dieEls[i];
          if (i < filled) {
            d.setAttribute('fill', 'var(--copper)');
            d.setAttribute('stroke', 'var(--ink)');
            d.setAttribute('stroke-width', '0.4');
          } else {
            d.setAttribute('fill', 'none');
            d.setAttribute('stroke', 'var(--hairline)');
            d.setAttribute('stroke-width', '0.5');
          }
        }
        lastFilled = filled;
      }
      valueEl.textContent = `YIELD: ${fmtJobs(v)} / 9,000 · 1 DIE = ${DIE_VALUE} JOBS`;
    },
  };
}

function buildDials() {
  const wrap = document.getElementById('dials');
  const dInvest = makeDial({
    label: 'Cumulative investment',
    srcKeys: ['micron-100b', 'micron-20b-first-phase'],
    max: 100,
    format: fmtB,
    id: 'dial-invest',
  });
  const dConstr = makeDial({
    label: 'Construction workforce',
    srcKeys: ['constr-3000-4000'],
    max: 4000,
    format: fmtJobs,
    id: 'dial-constr',
  });
  const dPerm = makeWaferDial({
    label: 'Permanent jobs',
    srcKeys: ['micron-9000-direct'],
  });
  wrap.append(dInvest.el, dConstr.el, dPerm.el);
  onYear((y) => {
    dInvest.set(investAt(y));
    const lo = constrLowAt(y);
    const hi = constrHighAt(y);
    dConstr.set(
      (lo + hi) / 2,
      lo === hi ? fmtJobs(lo) : `${fmtJobs(lo)}–${fmtJobs(hi)}`
    );
    dPerm.set(permAt(y));
  });
}

/* ---------------- citation marks in static copy ---------------- */
function bindCiteMarks() {
  document.querySelectorAll('a.cite[data-cite]').forEach((a) => {
    const n = cite(a.dataset.cite);
    if (n) {
      a.textContent = `[${n}]`;
    } else {
      a.remove(); // no located citation → mark does not render
    }
  });
}

/* ---------------- sources list ---------------- */
function buildSources() {
  const ol = document.getElementById('sources-list');
  for (const s of SOURCE_LIST) {
    const li = document.createElement('li');
    li.id = `src-${s.n}`;
    li.innerHTML = `<a href="${s.url}" rel="noopener">${s.title}</a> — ${s.publisher}${
      s.date ? `, ${s.date}` : ''
    }. <span class="retrieved">Retrieved ${s.retrieved}.</span>`;
    ol.appendChild(li);
  }
}

/* ---------------- installed base plate (05) ---------------- */
function buildInstalledBase() {
  const grid = document.getElementById('installed-base');
  for (const item of INSTALLED_BASE) {
    const n = cite(item.src);
    if (!n) continue; // uncited figures do not render
    const cell = document.createElement('div');
    cell.className = 'spec-cell';
    cell.innerHTML = `<div class="big">${item.value}<a class="cite" href="#sources">[${n}]</a></div>
      <div class="label">${item.label}</div>`;
    grid.appendChild(cell);
  }
}

/* ---------------- node plate ---------------- */
function showNodePlate(node) {
  const plate = document.getElementById('node-plate');
  const n = cite(node.src);
  plate.innerHTML = `
    <dl>
      <dt>Node</dt><dd>${node.name} — ${node.full}${
        n ? `<a class="cite" href="#sources">[${n}]</a>` : ''
      }</dd>
      <dt>County</dt><dd>${node.countyName} (${node.county})</dd>
      <dt>Active from</dt><dd>${node.activeFrom}</dd>
    </dl>
    <div style="margin-top:6px">${node.plate}</div>`;
}

/* ---------------- boot ---------------- */
// boot-stage instrumentation: each stage gets a mark and a measure from the
// previous stage, so "it feels slower" always has numbers in the Performance
// panel (and in qa/perf.mjs traces).
let lastMark = null;
function markStage(name) {
  performance.mark(name);
  if (lastMark) performance.measure(`${lastMark} → ${name}`, lastMark, name);
  lastMark = name;
}

async function boot() {
  markStage('boot:start');
  // F20: reserve the map stage's final height synchronously (pre-paint,
  // before any await) with the exact formula renderMap uses, so the SVG
  // mounting later never shifts the page. CSS can't express this without
  // aspect-ratio feeding back into the block's width. Cleared after mount.
  const stageEl = document.getElementById('map-stage');
  stageEl.style.height = `${Math.round(
    Math.min(560, Math.max(260, stageEl.clientWidth * 0.55))
  )}px`;
  // F19: kick both fetches immediately and build every static surface while
  // they're in flight. The ordering constraint is citation numbering only:
  // live sections register their sources into the numbered list, so
  // bindCiteMarks/buildSources must wait for initLive — nothing else does.
  // (The static surfaces below cite only keys registered synchronously by
  // sources.js at import.)
  const livePromise = initLive();
  const geoPromise = fetch('/data/ny-geo.json').then((r) => r.json());

  buildInstalledBase();
  buildTicks();
  buildLedger();
  buildDials();

  const site = responsiveMount(document.getElementById('site-panel'), (w) =>
    renderSite(document.getElementById('site-panel'), w)
  );
  onYear((y) => site.update(y));

  const chart = responsiveMount(document.getElementById('buildout-chart'), (w) =>
    renderChart(document.getElementById('buildout-chart'), w)
  );
  onYear((y) => chart.update(y));
  buildChartNumbers(document.getElementById('buildout-numbers'));

  responsiveMount(document.getElementById('capital-sankey'), (w) =>
    renderCapitalSankey(document.getElementById('capital-sankey'), w)
  );
  buildCapitalNumbers(document.getElementById('capital-numbers'));

  responsiveMount(document.getElementById('talent-sankey'), (w) =>
    renderTalentSankey(document.getElementById('talent-sankey'), w)
  );
  buildTalentNumbers(document.getElementById('talent-numbers'));
  markStage('boot:static-mounted');

  const [live, geo] = await Promise.all([livePromise, geoPromise]);
  markStage('boot:data-loaded');

  // citation steps — only now is the source registry complete
  bindCiteMarks();
  buildSources();

  const uiState = { particles: 'ambient', view: 'map' };
  let flowInfo = null;
  const flowsLegend = document.getElementById('flows-legend');
  const mapOpts = {
    onNodeSelect: showNodePlate,
    motion,
    onMotionChange,
    lodes: live.lodes,
    qcew: live.qcew,
    ipeds: live.ipeds,
    uiState,
    onFlowInfo: (info) => {
      flowInfo = info;
      if (uiState.particles === 'flows') updateFlowsLegend();
    },
  };
  const map = responsiveMount(document.getElementById('map-stage'), (w) =>
    renderMap(document.getElementById('map-stage'), geo, mapOpts, w)
  );
  onYear((y) => map.update(y));
  stageEl.style.height = ''; // F20 reservation done — the SVG owns the height now
  markStage('boot:map-mounted');

  function updateFlowsLegend() {
    if (uiState.particles === 'flows' && uiState.view === 'map' && flowInfo) {
      flowsLegend.textContent = `1 PARTICLE = ${flowInfo.jobsPerParticle.toLocaleString('en-US')} JOBS · LODES ${flowInfo.vintage.match(/\d{4}/)[0]} · ALL-INDUSTRY COMMUTING`;
      flowsLegend.hidden = false;
    } else {
      flowsLegend.hidden = true;
    }
  }

  const tabAmbient = document.getElementById('tab-ambient');
  const tabFlows = document.getElementById('tab-flows');
  function setParticles(mode) {
    uiState.particles = mode;
    tabAmbient.setAttribute('aria-pressed', String(mode === 'ambient'));
    tabFlows.setAttribute('aria-pressed', String(mode === 'flows'));
    if (map.instance && map.instance.setParticleMode) map.instance.setParticleMode(mode);
    updateFlowsLegend();
  }
  tabAmbient.addEventListener('click', () => setParticles('ambient'));
  tabFlows.addEventListener('click', () => setParticles('flows'));
  if (!live.lodes) {
    tabFlows.disabled = true;
    tabFlows.dataset.keepDisabled = 'true';
  }

  const tabMap = document.getElementById('tab-map');
  const tabSection = document.getElementById('tab-section');
  function setView(v) {
    uiState.view = v;
    tabMap.setAttribute('aria-pressed', String(v === 'map'));
    tabSection.setAttribute('aria-pressed', String(v === 'section'));
    if (map.instance && map.instance.setView) map.instance.setView(v);
    // flows are geography-bound: unavailable in the section view
    tabFlows.disabled = v === 'section' || !live.lodes;
    updateFlowsLegend();
  }
  tabMap.addEventListener('click', () => setView('map'));
  tabSection.addEventListener('click', () => setView('section'));

  // colophon vintage: latest retrievedAt across all provenance objects
  const vintageEl = document.getElementById('colophon-vintage');
  const provs = [geo, live.qcew, live.oews, live.ipeds, live.lodes, live.spending, live.permits, live.acs, live.nyiso].filter(
    (d) => d && d.provenance
  );
  const dates = provs.map((d) => d.provenance.retrievedAt).sort();
  if (dates.length) vintageEl.textContent = dates[dates.length - 1];

  // print brief header: frozen scrub year + all data vintages
  const printHeader = document.getElementById('print-header');
  const vintages = provs
    .map((d) => d.provenance.vintage)
    .map((v) => v.split(';')[0].split('(')[0].trim());
  onYear((y) => {
    printHeader.textContent = `THE SECOND CORRIDOR · PRINTED AT YEAR ${Math.floor(
      y + 1e-6
    )} · DATA: ${[...new Set(vintages)].join(' · ')}`;
  });

  // initial year: deep link or 2022
  const initial = readHash();
  setYear(initial !== null ? initial : YEAR_MIN, { updateHash: false });

  // poster export — dynamically imported on use, never in the main bundle
  document.getElementById('export-poster').addEventListener('click', async () => {
    const { exportPoster } = await import('./poster.js');
    exportPoster({ year: state.year });
  });

  // the plotter opening — draw-over of the rendered DOM; skipped by
  // ?nointro, reduced motion, or any input
  markStage('boot:intro-start');
  runIntro({ mapInstance: map.instance, motion });
}

boot();
