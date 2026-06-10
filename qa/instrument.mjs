// qa/instrument.mjs — close-ups of the s01 instrument + mobile views (dev only).
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const out = (n) => fileURLToPath(new URL(`./shots/sections/${n}.png`, import.meta.url));
mkdirSync(new URL('./shots/sections/', import.meta.url), { recursive: true });

const browser = await chromium.launch();

// Desktop close-ups
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
await page.goto(`${BASE}/?nointro#y=2030`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

// map stage + toggles
await page.locator('#instrument').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.locator('.instrument-toggles').screenshot({ path: out('i-toggles') });
await page.locator('#map-stage').screenshot({ path: out('i-map') });
// click a node to populate the node plate
await page.locator('.node-marker').nth(2).click();
await page.waitForTimeout(400);
await page.locator('#site-panel').screenshot({ path: out('i-sitepanel') }).catch(() => {});
await page.locator('#node-plate').screenshot({ path: out('i-nodeplate') });
await page.locator('#dials').screenshot({ path: out('i-dials') });
await page.locator('#scrubber-row').screenshot({ path: out('i-scrubber') });
await page.locator('#ledger').screenshot({ path: out('i-ledger') });
// section view
await page.locator('#tab-section').click();
await page.waitForTimeout(1100);
await page.locator('#map-stage').screenshot({ path: out('i-section-view') });
// flows mode
await page.locator('#tab-map').click();
await page.waitForTimeout(1100);
await page.locator('#tab-flows').click();
await page.waitForTimeout(800);
await page.locator('#map-stage').screenshot({ path: out('i-flows') });
await page.close();

// Mobile views
const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
await m.goto(`${BASE}/?nointro#y=2030`, { waitUntil: 'networkidle' });
await m.evaluate(() => document.fonts.ready);
await m.waitForTimeout(600);
await m.locator('header.masthead').screenshot({ path: out('m-masthead') });
await m.locator('#instrument').scrollIntoViewIfNeeded();
await m.waitForTimeout(300);
await m.locator('#instrument').screenshot({ path: out('m-instrument') });
await m.locator('#s02 .plate').scrollIntoViewIfNeeded();
await m.waitForTimeout(300);
await m.locator('#s02 .plate').screenshot({ path: out('m-s02') });
await m.locator('#s04 .plate').scrollIntoViewIfNeeded();
await m.waitForTimeout(300);
await m.locator('#s04 .plate').screenshot({ path: out('m-s04') });
await m.locator('#s06 .plate').first().scrollIntoViewIfNeeded();
await m.waitForTimeout(300);
await m.locator('#qcew-plate').screenshot({ path: out('m-qcew') });
await m.close();

console.log('done');
await browser.close();
