// qa/lighthouse.mjs — F3: repeatable Lighthouse gate, locally and in CI.
// Runs the Lighthouse Node API against the built site (vite preview), attached
// to a Playwright-launched Chromium over CDP — no chrome-launcher, whose temp-
// profile cleanup crashes on Windows. Mobile emulation; budget asserted from
// perf-budget.json. Report → .cache/lighthouse-report.html.
// Run after `npm run build`:  npm run lighthouse
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';

const budget = JSON.parse(readFileSync(new URL('../perf-budget.json', import.meta.url), 'utf8'));
const PORT = 5322;
const CDP_PORT = 9223;
const BASE = `http://localhost:${PORT}`;
const MIN_SCORE = 0.95;

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

const browser = await chromium.launch({ args: [`--remote-debugging-port=${CDP_PORT}`] });

const result = await lighthouse(`${BASE}/`, {
  port: CDP_PORT,
  output: 'html',
  logLevel: 'error',
  formFactor: 'mobile',
  screenEmulation: { mobile: true, width: 375, height: 812, deviceScaleFactor: 2, disabled: false },
  onlyCategories: ['performance', 'accessibility', 'best-practices'],
});

await browser.close();
server.kill();

const lhr = result.lhr;
mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
writeFileSync(new URL('../.cache/lighthouse-report.html', import.meta.url), result.report);

const lcp = lhr.audits['largest-contentful-paint'].numericValue;
const cls = lhr.audits['cumulative-layout-shift'].numericValue;
const scores = Object.fromEntries(
  Object.entries(lhr.categories).map(([k, v]) => [k, v.score])
);

console.log(
  `lighthouse (mobile emulation): perf ${scores.performance} · a11y ${scores.accessibility} · ` +
    `best-practices ${scores['best-practices']} · LCP ${(lcp / 1000).toFixed(2)}s · CLS ${cls.toFixed(3)}`
);

let failed = false;
const check = (label, value, pass) => {
  if (!pass) {
    console.error(`LIGHTHOUSE FAIL: ${label} = ${value}`);
    failed = true;
  }
};
check('performance score', scores.performance, scores.performance >= MIN_SCORE);
check('accessibility score', scores.accessibility, scores.accessibility >= MIN_SCORE);
check('best-practices score', scores['best-practices'], scores['best-practices'] >= MIN_SCORE);
check(`LCP ${lcp.toFixed(0)}ms vs budget ${budget.lab.lcpMs}ms`, lcp, lcp <= budget.lab.lcpMs);
check(`CLS vs budget ${budget.lab.cls}`, cls, cls <= budget.lab.cls);

if (failed) process.exit(1);
console.log('lighthouse clean: scores and lab metrics within budget');
process.exit(0);
