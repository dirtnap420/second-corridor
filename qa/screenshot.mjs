// qa/screenshot.mjs — visual-QA harness (dev only, shots gitignored).
// Screenshots the site at years {2022, 2026, 2030, 2045} × widths {375, 768, 1280}.
// Spawns a Vite dev server, captures, exits. Run: npm run qa
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const YEARS = [2022, 2026, 2030, 2045];
const WIDTHS = [375, 768, 1280];
const PORT = 5199;

mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'pipe',
});
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite dev server did not start')), 30000);
  server.stdout.on('data', (d) => {
    if (String(d).includes('Local:')) {
      clearTimeout(t);
      resolve();
    }
  });
});

const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 1400 } });
    for (const year of YEARS) {
      await page.goto(`http://localhost:${PORT}/?nointro#y=${year}`, {
        waitUntil: 'networkidle',
      });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: new URL(`./shots/y${year}-w${width}.png`, import.meta.url).pathname.replace(
          /^\/([A-Za-z]:)/,
          '$1'
        ),
        fullPage: true,
      });
      console.log(`shot y${year} w${width}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  process.exit(0);
}
