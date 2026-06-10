// qa/visual-diff.mjs — M3: visual regression gate. Run after `npm run build`.
//
// Captures deterministic full-page shots of the BUILT site (reduced-motion
// emulation: no particle engine, no transitions, no intro) at the battery's
// year×width grid, then pixelmatches them against qa/baselines/.
//
//   node qa/visual-diff.mjs            fail on unexpected deltas
//   node qa/visual-diff.mjs --update   regenerate baselines (waves that INTEND
//                                      visual change do this in their PR)
//
// Local gate only — font rasterization differs across OSes, so CI does not run
// this; CI's visual safety is the contract test. Diffs land in qa/shots/visual-diff/.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const UPDATE = process.argv.includes('--update');
const YEARS = [2022, 2026, 2030, 2045];
const WIDTHS = [375, 768, 1280];
const PORT = 5299;
const BASE = `http://localhost:${PORT}`;
const PIXEL_THRESHOLD = 0.1; // pixelmatch per-pixel sensitivity
const MAX_MISMATCH_FRACTION = 0.0005; // 0.05% of pixels

const dir = (p) => fileURLToPath(new URL(p, import.meta.url));
mkdirSync(dir('./shots/visual/'), { recursive: true });
mkdirSync(dir('./shots/visual-diff/'), { recursive: true });
mkdirSync(dir('./baselines/'), { recursive: true });

/* ---------- serve dist ---------- */
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

/* ---------- capture ---------- */
const browser = await chromium.launch();
const names = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({
    viewport: { width, height: 1400 },
    reducedMotion: 'reduce',
  });
  for (const year of YEARS) {
    await page.goto(`${BASE}/?nointro#y=${year}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const name = `y${year}-w${width}.png`;
    await page.screenshot({ path: dir(`./shots/visual/${name}`), fullPage: true });
    names.push(name);
  }
  await page.close();
}
await browser.close();
server.kill();

/* ---------- update mode ---------- */
if (UPDATE) {
  for (const name of names) copyFileSync(dir(`./shots/visual/${name}`), dir(`./baselines/${name}`));
  console.log(`baselines updated: ${names.length} shots → qa/baselines/`);
  process.exit(0);
}

/* ---------- compare ---------- */
let failed = false;
for (const name of names) {
  const basePath = dir(`./baselines/${name}`);
  if (!existsSync(basePath)) {
    console.error(`VISUAL FAIL: no baseline for ${name} — run \`node qa/visual-diff.mjs --update\``);
    failed = true;
    continue;
  }
  const a = PNG.sync.read(readFileSync(basePath));
  const b = PNG.sync.read(readFileSync(dir(`./shots/visual/${name}`)));
  if (a.width !== b.width || a.height !== b.height) {
    console.error(`VISUAL FAIL: ${name} dimensions changed ${a.width}×${a.height} → ${b.width}×${b.height}`);
    failed = true;
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const mismatch = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: PIXEL_THRESHOLD,
  });
  const fraction = mismatch / (a.width * a.height);
  if (fraction > MAX_MISMATCH_FRACTION) {
    writeFileSync(dir(`./shots/visual-diff/${name}`), PNG.sync.write(diff));
    console.error(
      `VISUAL FAIL: ${name} — ${mismatch} px (${(fraction * 100).toFixed(3)}%) differ; diff → qa/shots/visual-diff/${name}`
    );
    failed = true;
  } else {
    console.log(`visual ok: ${name}${mismatch ? ` (${mismatch} px within tolerance)` : ''}`);
  }
}

if (failed) {
  console.error('VISUAL DIFF FAIL — if the change is intended, regenerate: node qa/visual-diff.mjs --update');
  process.exit(1);
}
console.log('visual diff clean');
process.exit(0);
