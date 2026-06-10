// qa/perf.mjs — F4+F5: scripted runtime trace through the real scenario:
// intro plays → full 2022→2045 playback → map↔section morph → flows toggle.
// Asserts the perf-budget.json runtime numbers: frame time during playback,
// long tasks during interaction. Boot-stage measures (F6 marks) are reported.
//
//   node qa/perf.mjs              desktop profile (1280px)
//   node qa/perf.mjs --throttle   F5: 6× CPU throttle, 375px viewport, DPR 2
//
// Local battery tool — run on any wave that touched the instrument.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const THROTTLE = process.argv.includes('--throttle');
const budget = JSON.parse(readFileSync(new URL('../perf-budget.json', import.meta.url), 'utf8'));
const limits = THROTTLE ? budget.runtimeThrottled : budget.runtime;
const PORT = 5311;
const BASE = `http://localhost:${PORT}`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore',
});
async function up() {
  try { return (await fetch(BASE, { signal: AbortSignal.timeout(1500) })).ok; }
  catch { return false; }
}
for (let i = 0; i < 40 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
if (!(await up())) { server.kill(); throw new Error('vite preview did not start'); }

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: THROTTLE ? { width: 375, height: 812 } : { width: 1280, height: 1400 },
  deviceScaleFactor: THROTTLE ? 2 : 1,
});
const cdp = await page.context().newCDPSession(page);
if (THROTTLE) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

// instrument before any script runs: rAF deltas + long tasks, windowed by label
await page.addInitScript(() => {
  window.__perf = { frames: [], tasks: [], windows: {} };
  const loop = (t) => {
    window.__perf.frames.push(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__perf.tasks.push({ start: e.startTime, dur: e.duration });
  }).observe({ type: 'longtask', buffered: true });
  window.__mark = (name) => (window.__perf.windows[name] = performance.now());
});

console.log(`PERF TRACE — ${THROTTLE ? 'THROTTLED 6× CPU · 375px · DPR2' : 'desktop · 1280px'}`);

// 1. intro plays (no ?nointro), scrubbed surfaces settle
await page.goto(`${BASE}/#y=2022`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(3500); // intro ≤2.5s + settle

// 2. full playback 2022 → 2045
await page.evaluate(() => window.__mark('playStart'));
await page.click('#play');
await page.waitForFunction(
  () => document.getElementById('play').textContent === 'Replay',
  null,
  { timeout: 120000 }
);
await page.evaluate(() => window.__mark('playEnd'));

// 3. map ↔ section morph
await page.click('#tab-section');
await page.waitForTimeout(THROTTLE ? 1600 : 900);
await page.click('#tab-map');
await page.waitForTimeout(THROTTLE ? 1600 : 900);

// 4. flows toggle
const flowsDisabled = await page.$eval('#tab-flows', (b) => b.disabled);
if (!flowsDisabled) {
  await page.click('#tab-flows');
  await page.waitForTimeout(2000);
  await page.click('#tab-ambient');
}
await page.evaluate(() => window.__mark('interactEnd'));

const perf = await page.evaluate(() => ({
  frames: window.__perf.frames,
  tasks: window.__perf.tasks,
  windows: window.__perf.windows,
  boot: performance
    .getEntriesByType('measure')
    .filter((m) => m.name.startsWith('boot:'))
    .map((m) => `${m.name} ${m.duration.toFixed(1)}ms`),
}));
await browser.close();
server.kill();

/* ---------- analyze ---------- */
const { playStart, playEnd, interactEnd } = perf.windows;
const deltas = [];
for (let i = 1; i < perf.frames.length; i++) {
  const t = perf.frames[i];
  if (t > playStart && t <= playEnd) deltas.push(t - perf.frames[i - 1]);
}
deltas.sort((a, b) => a - b);
const p = (q) => deltas[Math.min(deltas.length - 1, Math.floor(q * deltas.length))] || 0;
const over = deltas.filter((d) => d > limits.maxFrameMsDuringPlay);

console.log(`boot stages: ${perf.boot.join(' · ') || '(none)'}`);
console.log(
  `playback: ${deltas.length} frames over ${((playEnd - playStart) / 1000).toFixed(1)}s · ` +
    `p50 ${p(0.5).toFixed(1)}ms · p95 ${p(0.95).toFixed(1)}ms · max ${p(1).toFixed(1)}ms`
);

let failed = false;

// frame budget: tolerate 2 isolated spikes (GC etc.); drift means many
if (over.length > 2) {
  console.error(
    `PERF FAIL: ${over.length} playback frames exceeded ${limits.maxFrameMsDuringPlay}ms ` +
      `(worst ${Math.max(...over).toFixed(1)}ms)`
  );
  failed = true;
} else {
  console.log(
    `frames ok: ${over.length} frame(s) over ${limits.maxFrameMsDuringPlay}ms (≤2 allowed)`
  );
}

// long tasks: scoped to the interaction window (play → flows), per budget
const interactTasks = perf.tasks.filter((t) => t.start >= playStart && t.start <= interactEnd);
const bootTasks = perf.tasks.filter((t) => t.start < playStart);
if (bootTasks.length)
  console.log(
    `boot long tasks (informational): ${bootTasks.map((t) => `${t.dur.toFixed(0)}ms@${t.start.toFixed(0)}`).join(', ')}`
  );
const overTasks = interactTasks.filter((t) => t.dur > limits.maxLongTaskMs);
if (overTasks.length) {
  console.error(
    `PERF FAIL: long task(s) > ${limits.maxLongTaskMs}ms during interaction: ` +
      overTasks.map((t) => `${t.dur.toFixed(0)}ms@${t.start.toFixed(0)}`).join(', ')
  );
  failed = true;
} else {
  console.log(`long tasks ok: none over ${limits.maxLongTaskMs}ms during interaction`);
}

if (failed) process.exit(1);
console.log('perf trace clean');
process.exit(0);
