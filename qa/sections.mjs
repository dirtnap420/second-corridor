// qa/sections.mjs — one screenshot per section for design review (dev only).
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
mkdirSync(new URL('./shots/sections/', import.meta.url), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
await page.goto(`${BASE}/?nointro#y=2030`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

const ids = ['s01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11','sources'];
for (const id of ids) {
  const el = page.locator(`#${id}`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await el.screenshot({
    path: fileURLToPath(new URL(`./shots/sections/${id}.png`, import.meta.url)),
  });
  console.log('shot', id);
}
// masthead + footer
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(250);
await page.locator('header.masthead').screenshot({
  path: fileURLToPath(new URL('./shots/sections/masthead.png', import.meta.url)),
});
await page.locator('footer.colophon').scrollIntoViewIfNeeded();
await page.locator('footer.colophon').screenshot({
  path: fileURLToPath(new URL('./shots/sections/colophon.png', import.meta.url)),
});
console.log('shot masthead+colophon');
await browser.close();
