// qa/health.mjs — P5: post-deploy health check against production.
// Asserts: HTTP 200, every plate visible, zero console errors, and the
// colophon vintage matches the repo's newest retrievedAt (i.e. the deploy
// the merge was supposed to produce is actually being served). Polls while
// Vercel builds — exits nonzero only after the timeout.
//   node qa/health.mjs [--url=https://...] [--timeout-min=8]
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] || d;
const URL_ = arg('url', 'https://second-corridor.vercel.app');
const TIMEOUT_MIN = Number(arg('timeout-min', '8'));

// expected vintage = newest retrievedAt across the repo's committed datasets
const dataDir = fileURLToPath(new URL('../public/data/', import.meta.url));
const expected = readdirSync(dataDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    try { return JSON.parse(readFileSync(dataDir + f, 'utf8')).provenance?.retrievedAt; }
    catch { return null; }
  })
  .filter(Boolean)
  .sort()
  .pop();

console.log(`health check: ${URL_} · expecting colophon vintage ${expected}`);
const browser = await chromium.launch();
const deadline = Date.now() + TIMEOUT_MIN * 60_000;
let lastIssue = 'not attempted';

while (Date.now() < deadline) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  try {
    const resp = await page.goto(`${URL_}/?nointro`, { waitUntil: 'networkidle', timeout: 60000 });
    if (!resp || resp.status() !== 200) throw new Error(`HTTP ${resp?.status()}`);
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => ({
      vintage: document.getElementById('colophon-vintage')?.textContent.trim(),
      hidden: [...document.querySelectorAll('.plate[hidden]')].map((p) => p.id),
      sources: document.querySelectorAll('#sources-list li').length,
    }));
    if (errors.length) throw new Error(`console errors: ${errors[0]}`);
    if (state.hidden.length) throw new Error(`plates hidden: ${state.hidden.join(', ')}`);
    if (state.sources < 20) throw new Error(`only ${state.sources} sources rendered`);
    // S45 (Wave 6) appended the relative age to the vintage — match the date prefix
    if (!state.vintage || !state.vintage.startsWith(expected)) throw new Error(`colophon vintage ${state.vintage} ≠ expected ${expected} (deploy not live yet?)`);

    // F41: compression must not silently regress to gzip-only or raw
    const enc = await fetch(`${URL_}/`, { headers: { 'Accept-Encoding': 'br' } }).then(
      (r) => r.headers.get('content-encoding') || 'none'
    );
    if (enc !== 'br') throw new Error(`expected brotli on /, got content-encoding: ${enc}`);

    // F43: a missing data file must be a real 404 — SPA-fallback HTML with a
    // 200 would defeat every r.ok fail-soft check in live.js (the Wave 6
    // changes.json incident, made permanent as a gate)
    const miss = await fetch(`${URL_}/data/no-such-file-${Date.now()}.json`);
    if (miss.status !== 404) throw new Error(`missing data file returned ${miss.status}, expected 404`);

    console.log(
      `healthy: vintage ${state.vintage}, ${state.sources} sources, all plates visible, brotli on, data 404s real`
    );
    await browser.close();
    process.exit(0);
  } catch (e) {
    lastIssue = e.message;
    console.log(`  not healthy yet (${e.message}) — retrying in 30s`);
    await page.close();
    await new Promise((r) => setTimeout(r, 30000));
  }
}
await browser.close();
console.error(`HEALTH CHECK FAIL after ${TIMEOUT_MIN}min: ${lastIssue}`);
process.exit(1);
