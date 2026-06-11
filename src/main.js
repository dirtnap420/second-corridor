// main.js — orchestration: master scrubber state, hash sync, dials, ledger,
// citation marks, sources list. One year value drives every surface.
import './styles.css';
import {
  YEAR_MIN,
  YEAR_MAX,
  TODAY,
  NODES,
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
import { onTick } from './ticker.js';
import { initLive, relAge } from './live.js';
import { renderSite } from './site.js';
import { runIntro } from './intro.js';
// S46: the release rhythms (P34 config) ride into the bundle — they change
// with the pipeline, never at runtime
import releaseCalendar from '../scripts/release-calendar.json';

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
// S43: deep links carry the full instrument state — non-default view and
// particle layer ride alongside the year (boot sets the writer)
let hashExtras = () => '';
export function setHashExtras(fn) {
  hashExtras = fn;
}
function writeHash() {
  hashGuard = true;
  history.replaceState(null, '', `#y=${Math.floor(state.year + 1e-6)}${hashExtras()}`);
  hashGuard = false;
}
function setYear(y, { updateHash = true } = {}) {
  const clamped = Math.min(YEAR_MAX, Math.max(YEAR_MIN, y));
  state.year = clamped;
  const display = Math.floor(clamped + 1e-6);
  if (Number(slider.value) !== display) slider.value = display;
  if (readout.textContent !== String(display)) readout.textContent = String(display);
  if (updateHash && !state.playing) writeHash();
  notify();
}

/* ---------------- year glide ----------------
   Discrete jumps (track clicks, ledger clicks, deep links) ease across the
   intervening years so every surface scrubs through them coherently.
   Keyboard steps and drag increments stay 1:1. */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
let glideUnsub = null; // F37: glide rides the shared ticker
function cancelGlide() {
  if (glideUnsub) glideUnsub();
  glideUnsub = null;
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
  glideUnsub = onTick((now) => {
    const k = Math.min(1, (now - t0) / dur);
    setYear(from + (target - from) * easeOutCubic(k), { updateHash: k === 1 });
    if (k >= 1) cancelGlide();
  });
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
let playUnsub = null; // F37: play rides the shared ticker
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
  // D50: ~2 announcements/sec for 13s is noise — silence the live region
  // during play; the final year announces once on stop
  readout.setAttribute('aria-live', 'off');
  playBtn.setAttribute('aria-pressed', 'true');
  playBtn.textContent = 'Pause';
  if (motion.reduced) {
    discreteTimer = setTimeout(stepDiscrete, 700);
  } else {
    lastT = null;
    playUnsub = onTick(stepPlay);
  }
}
function stopPlay() {
  if (!state.playing) return;
  state.playing = false;
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.textContent = state.year >= YEAR_MAX ? 'Replay' : 'Play';
  if (playUnsub) playUnsub();
  if (discreteTimer) clearTimeout(discreteTimer);
  playUnsub = null;
  discreteTimer = null;
  setYear(state.year); // settle hash
  // D50: re-arm the live region, then re-set the text so the final year
  // is announced exactly once
  readout.setAttribute('aria-live', 'polite');
  requestAnimationFrame(() => {
    const t = readout.textContent;
    readout.textContent = '';
    readout.textContent = t;
  });
}
playBtn.addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));

/* ---------------- scrubber milestone ticks ---------------- */
const pctOf = (y) => ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

function buildTicks() {
  const wrap = document.getElementById('scrub-ticks');
  const byYear = new Map();
  for (const m of MILESTONES) {
    if (!m.src.some((s) => cite(s))) continue;
    byYear.set(m.year, [...(byYear.get(m.year) || []), m.label]);
  }
  let html = '';
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    if (byYear.has(y)) {
      // D20: the copper ticks explain themselves on hover
      const title = `${y} — ${byYear.get(y).join(' · ')}`;
      html += `<span class="tick tick--milestone" style="left:${pctOf(y)}%;pointer-events:auto" title="${title.replace(/"/g, '&quot;')}"></span>`;
    } else {
      html += `<span class="tick" style="left:${pctOf(y)}%"></span>`;
    }
  }
  // S16: the TODAY tick — everything left of it happened, everything right
  // of it is promise. Computed, never hard-coded.
  html += `<span class="tick tick--today" style="left:${pctOf(TODAY)}%"></span>
    <span class="tick-today-label" style="left:${pctOf(TODAY)}%">TODAY</span>`;
  wrap.innerHTML = html;
}

/* ---------------- S18: phase bands under the scrubber ----------------
   Labeled spans from the cited milestones — the timeline gets chapters. */
function buildPhases() {
  const track = document.querySelector('.scrubber-track');
  if (!track) return;
  const bands = [
    { from: YEAR_MIN, to: 2026, label: 'SITEWORK →2026', keys: ['groundbreaking-2026'], row: 1 },
    { from: 2026, to: 2041, label: 'CONSTRUCTION 2026–41', keys: ['fab1-construction-2026', 'constr-ends-2041'], row: 1 },
    { from: 2030, to: YEAR_MAX, label: 'OPERATIONS 2030–', keys: ['fab1-ops-2030'], row: 2 },
  ];
  const div = document.createElement('div');
  div.className = 'scrubber-phases';
  div.setAttribute('aria-hidden', 'true');
  div.innerHTML = bands
    .filter((b) => b.keys.some((k) => cite(k)))
    .map((b) => {
      const marks = [...new Set(b.keys.map((k) => cite(k)).filter(Boolean))]
        .map((n) => `[${n}]`)
        .join('');
      return `<span class="phase-band phase-band--r${b.row}" style="left:${pctOf(b.from)}%;width:${pctOf(b.to) - pctOf(b.from)}%">
        <span class="phase-label">${b.label} ${marks}</span></span>`;
    })
    .join('');
  track.appendChild(div);
}

/* ---------------- milestone ledger ---------------- */
function buildLedger() {
  const wrap = document.getElementById('ledger');
  const ol = document.createElement('ol');
  ol.setAttribute('aria-label', 'Milestone ledger');
  let todayDividerPlaced = false;
  for (const m of MILESTONES) {
    if (!m.src.some((s) => cite(s))) continue; // no citation → does not render
    // S20: one hairline between the record and the schedule
    if (!todayDividerPlaced && m.year > TODAY) {
      const div = document.createElement('li');
      div.className = 'ledger-today';
      div.setAttribute('aria-hidden', 'true');
      div.innerHTML = `<span class="yr"></span><span>— TODAY · ABOVE: THE RECORD · BELOW: THE SCHEDULE —</span>`;
      ol.appendChild(div);
      todayDividerPlaced = true;
    }
    const li = document.createElement('li');
    li.dataset.year = m.year;
    const marks = [...new Set(m.src.map((s) => cite(s)).filter(Boolean))]
      .map((n) => `<a class="cite" href="#src-${n}">[${n}]</a>`)
      .join('');
    // S22: future-dated promises become concrete distances — computed
    // against today, so the suffixes age themselves out
    const dy = m.year - Math.floor(TODAY);
    const rel = m.year > TODAY ? `<span class="ledger-rel"> — in ${dy} yr${dy === 1 ? '' : 's'}</span>` : '';
    li.innerHTML = `<span class="yr">${m.year}</span><span>${m.label}${marks}${rel}</span>`;
    li.addEventListener('click', () => {
      stopPlay();
      glideTo(m.year);
    });
    ol.appendChild(li);
  }
  wrap.appendChild(ol);
  // D21: the list scrolls inside 280px with no cue
  const more = document.createElement('div');
  more.className = 'ledger-more';
  more.setAttribute('aria-hidden', 'true');
  more.textContent = `▼ ${ol.children.length - 1} MILESTONES · LIST SCROLLS · CLICK A ROW TO GLIDE`;
  wrap.appendChild(more);
  // F35: play drives onYear every frame, but the ledger only changes when
  // the FLOOR year crosses a boundary — bail early on same-year frames and
  // touch rows in one pass (the wafer dial's "only what changed" pattern)
  const rows = [...ol.children].filter((li) => li.dataset.year);
  let lastLedgerY = null;
  onYear((year) => {
    const y = Math.floor(year + 1e-6);
    if (y === lastLedgerY) return;
    lastLedgerY = y;
    let current = null;
    for (const li of rows) {
      if (Number(li.dataset.year) <= y) current = li;
    }
    const curYear = current ? Number(current.dataset.year) : -1;
    for (const li of rows) {
      const ly = Number(li.dataset.year);
      const isCur = ly === curYear;
      li.classList.toggle('current', isCur);
      li.classList.toggle('past', ly < y && !isCur);
    }
    if (current && !state.playing) {
      // keep the highlighted row in view inside the ledger scroll area.
      // F36 — the 'auto' cases are load-bearing, don't simplify them away:
      // smooth scrolls queued behind a gliding year stack up and lag the
      // readout, and an element's smooth scroll can CANCEL an in-flight
      // smooth page scroll (Chromium; bit both R22 and the Wave 8 tour).
      // Reduced motion gets no animation per the global kill.
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

function makeDial({ label, srcKeys, max, format, id, deepLink = null }) {
  const div = document.createElement('div');
  div.className = 'dial';
  const marks = [...new Set(srcKeys.map((s) => cite(s)).filter(Boolean))]
    .map((n) => `<a class="cite" href="#src-${n}">[${n}]</a>`)
    .join('');
  // S37: the dial names link to the sections that explain them
  const labelHtml = deepLink ? `<a class="dial-link" href="${deepLink}">${label}</a>` : label;
  div.innerHTML = `
    <div class="dial-label">${labelHtml}${marks}</div>
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
    .map((n) => `<a class="cite" href="#src-${n}">[${n}]</a>`)
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
    <div class="dial-value" id="dial-perm" style="font-size:13px">—</div>
    <div class="dial-note">EACH DIE = ${DIE_VALUE} JOBS · EDGE DICE NEVER FILL — LIKE REAL WAFERS, THE EDGE DOESN'T YIELD</div>`;
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
      valueEl.textContent = `YIELD: ${fmtJobs(v)} / 9,000`; // the metaphor line below carries the key (S29)
    },
  };
}

/* ---------------- S21: milestone toast during play ----------------
   The map pings nodes when they activate, but the TEXT of a beat never
   surfaces during playback — flash the crossed milestone's label beside the
   year readout for ~1.2s. aria-hidden: D50 owns announcements (the live
   region is deliberately silenced during play). Reduced motion: no flashes. */
function buildToast() {
  const wrap = document.querySelector('.scrubber-year-wrap');
  if (!wrap) return;
  const byYear = new Map();
  for (const m of MILESTONES) {
    if (!m.src.some((s) => cite(s))) continue;
    if (!byYear.has(m.year)) byYear.set(m.year, m.label);
  }
  const el = document.createElement('span');
  el.className = 'milestone-toast';
  el.setAttribute('aria-hidden', 'true');
  wrap.appendChild(el);
  let lastY = null;
  let hideTimer = null;
  onYear((year) => {
    const y = Math.floor(year + 1e-6);
    if (y === lastY) return;
    const crossed =
      lastY !== null && state.playing && !motion.reduced && y > lastY && byYear.has(y);
    lastY = y;
    if (!crossed) return;
    let short = byYear.get(y).split(/[;—,]/)[0].trim();
    if (short.length > 34) short = short.slice(0, 33).trimEnd() + '…';
    el.textContent = short.toUpperCase();
    el.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.remove('show'), 1200);
  });
}

/* ---------------- D49: mini-TOC rail at ≥1400px ----------------
   Twelve sheets is a long scroll with no wayfinding; at wide viewports a
   fixed mono index costs nothing. Hidden below 1400px in CSS. */
function buildTocRail() {
  const items = [...Array(12)]
    .map((_, i) => [`s${String(i + 1).padStart(2, '0')}`, String(i + 1).padStart(2, '0')])
    .concat([['sources', 'SRC']]);
  const nav = document.createElement('nav');
  nav.className = 'toc-rail';
  nav.setAttribute('aria-label', 'Section index');
  // accessible names carry the section headings, not just '01'
  const nameOf = (id, label) =>
    id === 'sources'
      ? 'Sources'
      : `${label} — ${document.getElementById(`h${label}`)?.textContent.trim() || 'section'}`;
  nav.innerHTML = items
    .map(
      ([id, label]) =>
        `<a href="#${id}" data-sec="${id}" aria-label="${nameOf(id, label)}">${label}</a>`
    )
    .join('');
  document.body.appendChild(nav);
  const links = new Map([...nav.querySelectorAll('a')].map((a) => [a.dataset.sec, a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          links.forEach((a) => {
            a.classList.remove('current');
            a.removeAttribute('aria-current');
          });
          const cur = links.get(e.target.id);
          if (cur) {
            cur.classList.add('current');
            cur.setAttribute('aria-current', 'true');
          }
        }
      }
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  items.forEach(([id]) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
}

/* ---------------- S19: era readout under the year ----------------
   The operative milestone state — the number becomes a story state. */
function buildEra() {
  const el = document.getElementById('era-readout');
  if (!el) return;
  const cited = MILESTONES.filter((m) => m.src.some((s) => cite(s)));
  onYear((year) => {
    const y = Math.floor(year + 1e-6);
    let current = null;
    for (const m of cited) if (m.year <= y) current = m;
    if (!current) {
      el.textContent = '';
      return;
    }
    // short form: the label up to the first separator, capped so the
    // reserved two-line box never overflows
    let short = current.label.split(/[;—,]/)[0].trim();
    if (short.length > 26) short = short.slice(0, 25).trimEnd() + '…';
    const n = cite(current.src[0]);
    el.innerHTML = `${short.toUpperCase()}${n ? `<a class="cite" href="#src-${n}">[${n}]</a>` : ''}`;
  });
}

function buildDials() {
  const wrap = document.getElementById('dials');
  const dInvest = makeDial({
    label: 'Cumulative investment',
    srcKeys: ['micron-100b', 'micron-20b-first-phase'],
    max: 100,
    format: fmtB,
    id: 'dial-invest',
    deepLink: '#s02',
  });
  const dConstr = makeDial({
    label: 'Construction workforce',
    srcKeys: ['constr-3000-4000'],
    max: 4000,
    format: fmtJobs,
    id: 'dial-constr',
    deepLink: '#s02',
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
      a.href = `#src-${n}`; // D9: land on the exact source row, not the list top
    } else {
      a.remove(); // no located citation → mark does not render
    }
  });
  // collapse adjacent duplicate marks — two keys can resolve to one source
  // (generated marks already dedupe via Set)
  document.querySelectorAll('a.cite + a.cite').forEach((a) => {
    const prev = a.previousElementSibling;
    if (prev?.classList.contains('cite') && prev.textContent === a.textContent) a.remove();
  });
}

/* ---------------- sources list ---------------- */
function buildSources(archives) {
  const ol = document.getElementById('sources-list');
  const snaps = archives?.archives || {};
  for (const s of SOURCE_LIST) {
    const li = document.createElement('li');
    li.id = `src-${s.n}`;
    // R15≡P28: a citation that can't rot — each row carries its Wayback copy
    const snap = snaps[s.url];
    li.innerHTML = `<a href="${s.url}" rel="noopener">${s.title}</a> — ${s.publisher}${
      s.date ? `, ${s.date}` : ''
    }. <span class="retrieved">Retrieved ${s.retrieved}.</span>${
      snap ? ` <a class="src-archived" href="${snap.archiveUrl}" rel="noopener">archived ↗</a>` : ''
    }`;
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
    cell.innerHTML = `<div class="big">${item.value}<a class="cite" href="#src-${n}">[${n}]</a></div>
      <div class="label">${item.label}</div>`;
    grid.appendChild(cell);
  }
  // D28: an odd count leaves a hole in the 4-col grid — the last cell
  // becomes a typeset source line instead of dead space
  if (grid.children.length % 4 !== 0) {
    const note = document.createElement('div');
    note.className = 'spec-cell spec-cell--note';
    note.innerHTML = `<div class="label">All figures: state &amp; institutional record — sources in each cell</div>`;
    grid.appendChild(note);
  }

  /* S41: spec-cell numerals count up over ~300ms on first reveal — cheap
     salience for the context plate. tabular-nums (D41) prevents jitter;
     reduced motion renders the final values instantly (no setup at all).
     Only the leading number animates; prefixes/suffixes (~, +, MM) hold. */
  if (!motion.reduced && 'IntersectionObserver' in window) {
    const targets = [...grid.querySelectorAll('.spec-cell .big')]
      .map((el) => {
        const textNode = el.firstChild; // the value text; the cite mark follows
        const orig = textNode?.textContent || '';
        const m = orig.match(/^([^\d]*)([\d,]+)(.*)$/);
        if (!m || !Number(m[2].replace(/,/g, ''))) return null;
        const sep = m[2].includes(',');
        return {
          textNode,
          orig, // the cited figure, restored verbatim at the end
          pre: m[1],
          n: Number(m[2].replace(/,/g, '')),
          post: m[3],
          fmt: (v) => (sep ? v.toLocaleString('en-US') : String(v)),
        };
      })
      .filter(Boolean);
    if (targets.length) {
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          const t0 = performance.now();
          const unsub = onTick((now) => {
            const k = Math.min(1, (now - t0) / 300);
            for (const t of targets) {
              t.textNode.textContent =
                k >= 1 ? t.orig : `${t.pre}${t.fmt(Math.round(t.n * k))}${t.post}`;
            }
            if (k >= 1) unsub();
          });
        },
        { threshold: 0.4 }
      );
      io.observe(grid);
    }
  }
}

/* ---------------- node plate ---------------- */
// S39: the map becomes a hub, not a dead end — each node lists its figures
const NODE_FIGURES = {
  clay: [['02', '#s02'], ['08', '#s08'], ['11', '#s11']],
  rit: [['04', '#s04'], ['06', '#s06']],
  albany: [['03', '#s03'], ['08', '#s08']],
  stamp: [['05', '#s05']],
  marcy: [['06', '#s06']],
};
function showNodePlate(node) {
  const plate = document.getElementById('node-plate');
  const n = cite(node.src);
  const figs = (NODE_FIGURES[node.id] || [])
    .map(([t, h]) => `<a href="${h}">${t}</a>`)
    .join(' · ');
  plate.innerHTML = `
    <dl>
      <dt>Node</dt><dd>${node.name} — ${node.full}${
        n ? `<a class="cite" href="#src-${n}">[${n}]</a>` : ''
      }</dd>
      <dt>County</dt><dd>${node.countyName} (${node.county})</dd>
      <dt>Active from</dt><dd>${node.activeFrom}</dd>
    </dl>
    <div style="margin-top:6px">${node.plate}</div>
    ${figs ? `<div class="node-deeper">GO DEEPER → ${figs}</div>` : ''}`;
}

/* ---------------- R28: embed mode ----------------
   ?embed=figNN renders one plate: no masthead, an attribution footer with a
   backlink, postMessage height for the host iframe. Local newsrooms embed
   charts they can't build; every embed is a live backlink. The plate is
   MOVED (not cloned) so its observers and listeners keep working. */
const EMBED_PLATES = {
  fig01: 'instrument',
  fig02: 'buildout-plate',
  fig03: 'capital-plate',
  fig04: 'talent-plate',
  fig05: 'base-plate',
  fig06: 'qcew-plate',
  fig06a: 'qcew-plate',
  fig06b: 'oews-plate',
  fig06c: 'ipeds-plate',
  fig07: 'lodes-plate',
  fig08: 'spending-plate',
  fig09: 'comp-plate',
  fig10: 'bps-plate',
  fig10a: 'bps-plate',
  fig10b: 'acs-plate',
  fig11: 'phys-plate',
  fig12: 'synthesis-plate',
};
export const EMBED = (() => {
  const p = new URLSearchParams(location.search).get('embed');
  return p && EMBED_PLATES[p] ? p : null;
})();
function setupEmbed() {
  if (!EMBED) return false;
  const num = EMBED.replace('fig', '').slice(0, 2);
  const plate = document.getElementById(EMBED_PLATES[EMBED]);
  document.body.classList.add('embed-mode');
  const shell = document.createElement('div');
  shell.className = 'embed-shell';
  // a landmark + a heading: the iframe document must be navigable on its own
  shell.setAttribute('role', 'main');
  const h1 = document.createElement('h1');
  h1.className = 'visually-hidden';
  const figName =
    document.getElementById(`s${num}`)?.querySelector('h2')?.textContent.trim() || 'corridor figure';
  h1.textContent = `Fig. ${num} — ${figName} — The Second Corridor`;
  document.title = `Fig. ${num} — ${figName} — The Second Corridor`;
  shell.appendChild(h1);

  if (plate && !plate.hidden) {
    shell.appendChild(plate); // MOVED, not cloned — observers keep working
  } else {
    // a measured plate can be hidden (its data file failed to load) — a host
    // iframe must never get the whole site as a fallback; render an honest
    // unavailable card that still attributes and links back
    const card = document.createElement('p');
    card.className = 'embed-unavailable';
    card.textContent = `FIG. ${num} IS TEMPORARILY UNAVAILABLE — ITS DATA DID NOT LOAD.`;
    shell.appendChild(card);
  }

  const foot = document.createElement('footer');
  foot.className = 'embed-foot';
  foot.innerHTML = `FROM <a href="https://second-corridor.vercel.app/f/${num}" rel="noopener" target="_blank" aria-label="The Second Corridor — opens the full site in a new tab">THE SECOND CORRIDOR</a> · EVERY NUMBER CITED · ESTIMATES LABELED`;
  shell.appendChild(foot);
  document.body.insertBefore(shell, document.body.firstChild);

  // in-page anchors have no targets here — point them at the full site.
  // Some surfaces (era readout, node plate, responsive rebuilds) regenerate
  // relative anchors AFTER this runs, so a delegated handler is the real
  // mechanism; the one-shot rewrite below covers hover/status-bar affordance
  // for everything present now.
  const rewrite = (a) => {
    a.setAttribute('href', `https://second-corridor.vercel.app/${a.getAttribute('href')}`);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
    a.setAttribute('aria-label', `${a.textContent.trim()} — opens the full site in a new tab`);
  };
  shell.querySelectorAll('a[href^="#"]').forEach(rewrite);
  shell.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !shell.contains(a)) return;
    e.preventDefault(); // never push hash entries onto the HOST's history
    window.open(`https://second-corridor.vercel.app/${a.getAttribute('href')}`, '_blank', 'noopener');
  });

  // height handshake for host iframes
  if (window.parent !== window) {
    const post = () =>
      window.parent.postMessage(
        { type: 'second-corridor:height', height: document.documentElement.scrollHeight },
        '*'
      );
    new ResizeObserver(post).observe(shell);
    window.addEventListener('load', post);
    post();
  }
  return true;
}

/* ---------------- S50≡R24: copy-link per plate ----------------
   Every figure becomes independently citable: the copied URL is the /f/NN
   share shim (per-figure preview card) carrying the live instrument state. */
const PLATE_SECTIONS = {
  instrument: '01',
  'buildout-plate': '02',
  'capital-plate': '03',
  'talent-plate': '04',
  'base-plate': '05',
  'qcew-plate': '06',
  'oews-plate': '06',
  'ipeds-plate': '06',
  'lodes-plate': '07',
  'spending-plate': '08',
  'comp-plate': '09',
  'bps-plate': '10',
  'acs-plate': '10',
  'phys-plate': '11',
  'synthesis-plate': '12',
};
function addCopyLinks() {
  for (const [plateId, num] of Object.entries(PLATE_SECTIONS)) {
    const cap = document.getElementById(plateId)?.querySelector('.plate-caption--top');
    if (!cap) continue;
    const btn = document.createElement('button');
    btn.className = 'copy-link';
    btn.textContent = 'COPY LINK';
    btn.setAttribute('aria-label', `Copy a shareable link to figure ${num}`);
    btn.addEventListener('click', async () => {
      const url = `${location.origin}/f/${num}${location.hash}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        // clipboard API needs a secure context — fall back to execCommand
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        document.body.appendChild(ta);
        ta.select();
        try {
          copied = document.execCommand('copy');
        } catch {
          /* leave copied false */
        }
        ta.remove();
      }
      btn.textContent = copied ? 'COPIED ✓' : 'COPY FAILED';
      setTimeout(() => (btn.textContent = 'COPY LINK'), 1600);
    });
    cap.appendChild(btn);
  }
}

/* ---------------- R31+R10: plate caption links ----------------
   The numbers behind each measured plate, takeable (tidy CSV), and the
   dictionary that defines its terms. */
const PLATE_CSV = {
  'qcew-plate': 'qcew',
  'comp-plate': 'qcew',
  'oews-plate': 'oews',
  'ipeds-plate': 'ipeds',
  'lodes-plate': 'lodes',
  'spending-plate': 'spending',
  'bps-plate': 'permits',
  'acs-plate': 'acs',
  'phys-plate': 'nyiso',
};
function addPlateLinks() {
  document.querySelectorAll('.plate').forEach((plate) => {
    const bottom = plate.querySelector('.plate-caption--bottom');
    if (!bottom) return;
    const csv = PLATE_CSV[plate.id];
    const span = document.createElement('span');
    span.className = 'plate-links';
    span.innerHTML = `${
      csv ? `<a href="/data/csv/${csv}.csv" download>DOWNLOAD CSV</a> · ` : ''
    }<a href="/methods#dictionary">TERMS</a>`;
    bottom.appendChild(span);
  });
}

/* ---------------- S46: the next-release calendar ----------------
   Appointment viewing for data — when returning will show something new.
   Derived from the pipeline's release-calendar config + today's date;
   labeled approximate because the config is (release dates drift). */
function buildReleaseCalendar() {
  const el = document.getElementById('colophon-next');
  if (!el) return;
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const LABELS = { qcew: 'QCEW', oews: 'OEWS', ipeds: 'IPEDS', acs: 'ACS', lodes: 'LODES', permits: 'BPS' };
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const parts = [];
  for (const [key, cfg] of Object.entries(releaseCalendar.sources)) {
    if (!(key in LABELS)) continue; // monthly/continuous tempos read below
    let when = null;
    if (cfg.cadence === 'quarterly' && cfg.monthsAfterPeriodEnd) {
      // releases land ~lag months after each quarter end (Mar/Jun/Sep/Dec)
      for (let q = 0; q < 9 && !when; q++) {
        const rel = Date.UTC(y - 1, 2 + q * 3 + cfg.monthsAfterPeriodEnd, 1);
        if (rel > now.getTime()) when = new Date(rel);
      }
    } else if (cfg.expectedMonth) {
      const em = cfg.expectedMonth - 1;
      when = new Date(Date.UTC(em >= m ? y : y + 1, em, 1));
    }
    if (when) parts.push({ key, when });
  }
  parts.sort((a, b) => a.when - b.when);
  const line = parts
    .map((p) => `${LABELS[p.key]} ${MON[p.when.getUTCMonth()]} ${p.when.getUTCFullYear()}`)
    .join(' · ');
  el.textContent = `EXPECTED NEXT RELEASES (APPROX.): ${line} · USASPENDING CHECKED DAILY`;
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
  buildPhases();
  buildLedger();
  buildDials();
  buildEra();
  buildToast(); // S21
  buildTocRail(); // D49

  const site = responsiveMount(document.getElementById('site-panel'), (w) =>
    renderSite(document.getElementById('site-panel'), w)
  );
  onYear((y) => site.update(y));

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
  buildSources(live.archives);
  addCopyLinks(); // S50≡R24
  addPlateLinks(); // R31+R10
  buildReleaseCalendar(); // S46

  // Fig 02 mounts after data so the measured QCEW overlay (S23) draws with
  // the derived series — promise and meter in one frame
  const chart = responsiveMount(document.getElementById('buildout-chart'), (w) =>
    renderChart(document.getElementById('buildout-chart'), w, live.qcew, glideTo)
  );
  onYear((y) => chart.update(y));
  buildChartNumbers(document.getElementById('buildout-numbers'));

  // D13: selected before the map mounts so the ring renders with it
  const uiState = { particles: 'ambient', view: 'map', selected: 'clay' };
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

  // D13: the empty SELECT A NODE state was most visitors' first impression —
  // open on the hero subject instead (the empty state remains the fallback)
  const clayNode = NODES.find((n) => n.id === 'clay');
  if (clayNode) showNodePlate(clayNode);

  function updateFlowsLegend() {
    if (uiState.particles === 'flows' && uiState.view === 'map' && flowInfo) {
      // S34: human noun, honest method — LODES JT00 counts jobs (multiple
      // jobholders count twice), so these are COMMUTES, not commuters
      // (README Decision 16 stands)
      flowsLegend.textContent = `EACH STREAK ≈ ${flowInfo.jobsPerParticle.toLocaleString('en-US')} COMMUTES · LODES ${flowInfo.vintage.match(/\d{4}/)[0]} · ALL-INDUSTRY`;
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
    writeHash(); // S43
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
    writeHash(); // S43
  }
  tabMap.addEventListener('click', () => setView('map'));
  tabSection.addEventListener('click', () => setView('section'));

  // S43: the hash carries the full instrument state — deep links land on
  // exactly the configuration the sharer was looking at.
  // Capture the deep-linked year FIRST: applying view/p below writes the
  // hash, and the year slot would be clobbered with the boot default.
  const initial = readHash();
  setHashExtras(() => {
    let extra = '';
    if (uiState.view !== 'map') extra += `&view=${uiState.view}`;
    if (uiState.particles !== 'ambient') extra += `&p=${uiState.particles}`;
    return extra;
  });
  {
    const h = Object.fromEntries(
      location.hash
        .slice(1)
        .split('&')
        .filter(Boolean)
        .map((kv) => kv.split('='))
    );
    if (h.view === 'section') setView('section');
    if (h.p === 'flows' && live.lodes) setParticles('flows');
    // R22: arrivals from a /f/NN share shim land on exactly the figure that
    // earned the link (the shim rewrites #sNN into &f=NN to spare the y slot).
    // Deferred past the window load event: the browser's own load-time
    // fragment/scroll-restoration pass resets an earlier scroll to top.
    // Instant, not smooth: the ledger's follow-scroll on the first setYear
    // cancels an in-flight smooth page scroll.
    // R22: arrivals from a /f/NN share shim land on exactly the figure that
    // earned the link (the shim rewrites #sNN into &f=NN to spare the y slot).
    // Synchronous + load-deferred on purpose: rAF never fires in a hidden
    // tab, and the browser's load-time scroll restoration resets anything
    // earlier. Instant, not smooth: the ledger's follow-scroll on the first
    // setYear cancels an in-flight smooth page scroll.
    if (/^\d{2}$/.test(h.f || '')) {
      const target = document.getElementById(`s${h.f}`);
      const scrollToFigure = () =>
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
      if (target) {
        if (document.readyState === 'complete') scrollToFigure();
        else window.addEventListener('load', scrollToFigure, { once: true });
      }
    }
  }

  // S37: Fig 07's caption links back up into the flows view
  document.getElementById('flows-link')?.addEventListener('click', () => {
    setView('map');
    setParticles('flows');
  });

  // colophon vintage: latest retrievedAt across all provenance objects,
  // with its relative age (S45) and the build rev (R21) — any screenshot of
  // the page is traceable to an exact build and data state
  const vintageEl = document.getElementById('colophon-vintage');
  const provs = [geo, live.qcew, live.oews, live.ipeds, live.lodes, live.spending, live.permits, live.acs, live.nyiso].filter(
    (d) => d && d.provenance
  );
  const dates = provs.map((d) => d.provenance.retrievedAt).sort();
  if (dates.length) {
    const latest = dates[dates.length - 1];
    vintageEl.textContent = `${latest} · ${relAge(latest)}`;
  }
  const revEl = document.getElementById('colophon-rev');
  if (revEl) revEl.textContent = `rev ${__BUILD_REV__}`;

  // S7: expectations line — readers commit when they can size the
  // commitment. Plates counted live; freshness from provenance, never markup.
  const mastheadVintage = document.getElementById('masthead-vintage');
  if (mastheadVintage && dates.length) {
    const plateCount = document.querySelectorAll('.plate').length;
    mastheadVintage.textContent = `${plateCount} plates · ~9 min · refreshed ${dates[dates.length - 1]}`;
  }

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

  // R28: embed hosts get one plate and an attribution footer — and none of
  // the page chrome below (intro, nudge, tour, deep-link scroll)
  const embedded = setupEmbed();

  // S3: initial year — deep link wins (captured before the S43 view/p parse
  // could rewrite the hash); otherwise land the reader in the present
  // (decision #7). S4: when the intro will run, boot at 2022 and let its
  // final beat scrub to today.
  const todayYear = Math.floor(TODAY + 1e-6);
  const introWillRun =
    !motion.reduced && !embedded && !new URLSearchParams(location.search).has('nointro');
  if (initial !== null) {
    setYear(initial, { updateHash: false });
    writeHash(); // settle the displayed hash to the full applied state
  } else if (introWillRun) setYear(YEAR_MIN, { updateHash: false });
  else setYear(todayYear, { updateHash: false });

  // poster export — dynamically imported on use, never in the main bundle.
  // F14: warm the chunk on intent so the click itself is instant.
  const posterBtn = document.getElementById('export-poster');
  let posterWarm = null;
  const warmPoster = () => (posterWarm ||= import('./poster.js'));
  posterBtn.addEventListener('mouseenter', warmPoster, { once: true });
  posterBtn.addEventListener('focus', warmPoster, { once: true });
  posterBtn.addEventListener('click', async () => {
    const { exportPoster } = await warmPoster();
    exportPoster({ year: state.year });
  });

  // the plotter opening — draw-over of the rendered DOM; skipped by
  // ?nointro, reduced motion, or any input. S4: on natural completion the
  // final beat glides 2022 → today (deep links and interrupts skip it).
  markStage('boot:intro-start');
  // S42: name the disclosure and its size — open rates follow
  document.querySelectorAll('details.numbers').forEach((d) => {
    const rows = d.querySelectorAll('tbody tr').length;
    const summary = d.querySelector('summary');
    if (rows && summary) summary.textContent = `Open the data table · ${rows} rows`;
  });

  // S15: the guided tour — author-driven first pass, lazy like the poster.
  // The button disables while a tour runs (belt) and runTour itself is a
  // singleton (braces) — no stacked dialogs from a double-click.
  const tourBtn = document.getElementById('tour');
  tourBtn?.addEventListener('click', async () => {
    if (tourBtn.disabled) return;
    tourBtn.disabled = true;
    const { runTour } = await import('./tour.js');
    runTour({
      glideTo,
      setYear: (y) => setYear(y),
      stopPlay,
      cancelGlide,
      motion,
      todayYear,
      invoker: tourBtn,
      onEnd: () => (tourBtn.disabled = false),
    });
  });

  // S6: one-shot scrubber invitation after the opening settles — the most
  // important interaction on the page finally gets an invitation
  if (!localStorage.getItem('sc:nudged') && !motion.reduced && !embedded) {
    setTimeout(() => {
      const track = document.querySelector('.scrubber-track');
      if (!track || state.playing) return;
      const tag = document.createElement('span');
      tag.className = 'drag-nudge';
      tag.textContent = 'DRAG';
      track.appendChild(tag);
      slider.classList.add('nudge');
      setTimeout(() => {
        tag.remove();
        slider.classList.remove('nudge');
      }, 2200);
      localStorage.setItem('sc:nudged', '1');
    }, introWillRun ? 4200 : 1400);
  }

  if (embedded) return; // R28: an embed host needs no opening animation

  runIntro({
    mapInstance: map.instance,
    motion,
    // natural end: glide to today. Interrupt (usually just scrolling): snap
    // to today unless the reader already took the timeline somewhere.
    finale:
      initial === null && introWillRun
        ? (mode) => {
            if (mode === 'natural') glideTo(todayYear);
            else if (Math.floor(state.year) === YEAR_MIN && !state.playing)
              setYear(todayYear, { updateHash: false });
          }
        : null,
  });
}

boot();
