// qa/offline.mjs — proves the built site is self-contained: serves dist/,
// loads it with all non-localhost requests blocked, and fails on any external
// request attempt or console error/warning. Run after `npm run build`.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5277;
const BASE = `http://localhost:${PORT}`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore',
});
async function up() {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}
for (let i = 0; i < 40; i++) {
  if (await up()) break;
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
const page = await browser.newPage();
const external = [];
const consoleIssues = [];

await page.route('**/*', (route) => {
  const url = route.request().url();
  if (url.startsWith(BASE) || url.startsWith('data:')) return route.continue();
  external.push(url);
  return route.abort();
});
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    consoleIssues.push(`${msg.type()}: ${msg.text()}`);
  }
});
page.on('pageerror', (err) => consoleIssues.push(`pageerror: ${err.message}`));

await page.goto(`${BASE}/?nointro#y=2030`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// exercise the interactive surfaces
await page.click('#tab-flows');
await page.waitForTimeout(400);
await page.click('#tab-section');
await page.waitForTimeout(900);
await page.click('#tab-map');
await page.waitForTimeout(400);

await browser.close();
server.kill();

if (external.length) {
  console.error('OFFLINE PROOF FAIL — external requests attempted:');
  external.forEach((u) => console.error('  ' + u));
  process.exit(1);
}
if (consoleIssues.length) {
  console.error('CONSOLE FAIL:');
  consoleIssues.forEach((c) => console.error('  ' + c));
  process.exit(1);
}
console.log('offline proof clean: zero external requests, zero console errors/warnings');
process.exit(0);
