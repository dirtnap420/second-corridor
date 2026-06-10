// qa/screenshot.mjs — visual-QA harness (dev only, shots gitignored).
// Screenshots the site at years {2022, 2026, 2030, 2045} × widths {375, 768, 1280}.
// Spawns a Vite dev server (or reuses one already on the port), captures, exits.
// Run: npm run qa
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const YEARS = [2022, 2026, 2030, 2045];
const WIDTHS = [375, 768, 1280];
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;

mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });

async function portUp() {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

let server = null;
if (!(await portUp())) {
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: 'ignore',
  });
  let up = false;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await portUp()) {
      up = true;
      break;
    }
  }
  if (!up) {
    server.kill();
    throw new Error('vite dev server did not start on port ' + PORT);
  }
}

const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 1400 } });
    for (const year of YEARS) {
      await page.goto(`${BASE}/?nointro#y=${year}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: fileURLToPath(new URL(`./shots/y${year}-w${width}.png`, import.meta.url)),
        fullPage: true,
      });
      console.log(`shot y${year} w${width}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
  process.exit(0);
}
