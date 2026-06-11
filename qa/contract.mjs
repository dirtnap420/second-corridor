// qa/contract.mjs — P19+M4+M7: the frontend contract test. Run after `npm run build`.
//
// Pass 1 (real data): every plate un-hides and renders content, every vintage is
//   set, zero console errors/warnings, no NaN/undefined/Infinity/[object/Invalid
//   Date in visible text — plus the axe-core a11y gate (M4): no serious/critical
//   violations outside the documented allowlist.
// Passes 2–4 (fixtures, M7): qcew.json swapped for synthetic datasets via route
//   interception — all-suppressed, missing file (404), extreme values. The site
//   must fail soft: suppression hatches, hidden plates, finite text, no errors.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const PORT = 5288;
const BASE = `http://localhost:${PORT}`;

// M4 allowlist — pre-existing, tracked violations only. Each entry carries the
// item ID that will clear it; remove the entry when the item lands.
// (color-contrast was allowlisted until D42 landed the --copper-text token.)
const AXE_ALLOWLIST = {};

const LIVE_PLATES = [
  'qcew-plate', 'oews-plate', 'ipeds-plate', 'lodes-plate', 'spending-plate',
  'comp-plate', 'bps-plate', 'acs-plate', 'phys-plate',
];

let failures = 0;
const fail = (msg) => { failures++; console.error('  FAIL: ' + msg); };
const ok = (msg) => console.log('  ok: ' + msg);

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

const browser = await chromium.launch();

async function loadPage({ routes = null, allowConsole = [] } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const issues = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = `${msg.type()}: ${msg.text()}`;
      if (!allowConsole.some((re) => re.test(text))) issues.push(text);
    }
  });
  page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));
  if (routes) {
    for (const [url, handler] of Object.entries(routes)) {
      await page.route(url, handler);
    }
  }
  await page.goto(`${BASE}/?nointro#y=2030`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  return { page, issues };
}

async function textSweep(page, label) {
  const bad = await page.evaluate(() => {
    // textContent, not innerText: F33's content-visibility skips rendering of
    // below-fold sections, and innerText only reflects rendered text — the
    // sweep must see the whole document regardless of paint state
    const text = document.body.textContent;
    const hits = [];
    for (const re of [/\bNaN\b/, /\bundefined\b/, /\bInfinity\b/, /\[object /, /Invalid Date/]) {
      const m = text.match(re);
      if (m) hits.push(m[0]);
    }
    return hits;
  });
  if (bad.length) fail(`${label}: rendered-text lint hits: ${bad.join(', ')}`);
  else ok(`${label}: rendered text clean`);
}

function reportIssues(issues, label) {
  if (issues.length) {
    fail(`${label}: console/page errors:`);
    issues.forEach((c) => console.error('    ' + c));
  } else ok(`${label}: zero console errors/warnings`);
}

/* ================= pass 1 — real data ================= */
{
  console.log('PASS 1 — real data');
  const { page, issues } = await loadPage();

  const hiddenPlates = await page.evaluate(() =>
    [...document.querySelectorAll('.plate[hidden]')].map((p) => p.id || '(anon)')
  );
  if (hiddenPlates.length) fail(`plates still hidden: ${hiddenPlates.join(', ')}`);
  else ok('every plate is visible');

  const empties = await page.evaluate((ids) => {
    const out = [];
    for (const id of ids) {
      const body = document.getElementById(id)?.querySelector('.plate-body');
      if (!body || body.children.length === 0) out.push(id);
    }
    return out;
  }, LIVE_PLATES);
  if (empties.length) fail(`live plate bodies empty: ${empties.join(', ')}`);
  else ok('every live plate body has content');

  const counts = await page.evaluate(() => ({
    mapSvg: !!document.querySelector('#map-stage svg'),
    dials: document.querySelectorAll('#dials .dial').length,
    ledger: document.querySelectorAll('#ledger li').length,
    sources: document.querySelectorAll('#sources-list li').length,
    chart: !!document.querySelector('#buildout-chart svg'),
    capital: !!document.querySelector('#capital-sankey svg'),
    talent: !!document.querySelector('#talent-sankey svg'),
  }));
  if (!counts.mapSvg) fail('map SVG missing');
  if (counts.dials !== 3) fail(`expected 3 dials, got ${counts.dials}`);
  if (counts.ledger < 10) fail(`ledger has ${counts.ledger} rows`);
  if (counts.sources < 20) fail(`sources list has ${counts.sources} rows`);
  if (!counts.chart || !counts.capital || !counts.talent) fail('a chart/sankey SVG is missing');
  if (counts.mapSvg && counts.dials === 3 && counts.chart) ok(`instrument + charts mounted (${counts.ledger} ledger rows, ${counts.sources} sources)`);

  const vintages = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[id$="-vintage"]')) {
      const plate = el.closest('.plate');
      if (plate && plate.hidden) continue;
      if (!el.textContent.trim()) out.push(el.id);
    }
    const col = document.getElementById('colophon-vintage');
    if (!col || col.textContent.trim() === '—' || !col.textContent.trim()) out.push('colophon-vintage');
    return out;
  });
  if (vintages.length) fail(`empty vintages: ${vintages.join(', ')}`);
  else ok('every visible vintage is set');

  /* Wave 6 chrome: share affordances, archived links, freshness surfaces */
  const w6 = await page.evaluate(() => ({
    copyLinks: document.querySelectorAll('.copy-link').length,
    archived: document.querySelectorAll('.src-archived').length,
    ages: [...document.querySelectorAll('[id$="-vintage"]')].filter((el) =>
      /(day(s)? ago|today)/.test(el.textContent)
    ).length,
    rev: document.getElementById('colophon-rev')?.textContent.trim() || '',
    next: document.getElementById('colophon-next')?.textContent.trim() || '',
    plateCsvLinks: document.querySelectorAll('.plate-links a[download]').length,
  }));
  if (w6.copyLinks < 14) fail(`expected ≥14 copy-link buttons, got ${w6.copyLinks}`);
  if (w6.archived < 25) fail(`expected ≥25 archived source links, got ${w6.archived}`);
  if (w6.ages < 8) fail(`expected ≥8 vintage lines carrying a relative age, got ${w6.ages}`);
  if (!/^rev \S+/.test(w6.rev)) fail(`colophon rev not set: "${w6.rev}"`);
  if (!w6.next.includes('EXPECTED NEXT RELEASES')) fail('release-calendar line missing from colophon');
  if (w6.plateCsvLinks < 8) fail(`expected ≥8 plate CSV links, got ${w6.plateCsvLinks}`);
  if (w6.copyLinks >= 14 && w6.archived >= 25 && w6.ages >= 8 && w6.next && w6.plateCsvLinks >= 8)
    ok(`wave-6 chrome present (${w6.copyLinks} copy-links, ${w6.archived} archived, ${w6.plateCsvLinks} CSV links, ${w6.rev})`);

  /* Cite anchor jumps must land on the source row (D9/D11 scroll-margin
     guard; F33's test, kept after F33 was dropped). The page scrolls
     SMOOTHLY here (~10k px) — wait for arrival, not a fixed delay: a 400ms
     wait passed locally and raced the slower CI runner mid-scroll. */
  await page.click('.masthead a.cite');
  await page
    .waitForFunction(
      () => {
        const el = document.getElementById(location.hash.slice(1));
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.top >= 0 && r.top < window.innerHeight;
      },
      { timeout: 8000 }
    )
    .catch(() => {});
  const anchor = await page.evaluate(() => {
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return { ok: false, why: `no element for ${location.hash}` };
    const r = el.getBoundingClientRect();
    return {
      ok: r.height > 0 && r.top >= 0 && r.top < window.innerHeight,
      why: `${id} at top=${Math.round(r.top)} h=${Math.round(r.height)}`,
    };
  });
  if (!anchor.ok) fail(`cite anchor jump did not land on the source row: ${anchor.why}`);
  else ok(`cite anchor jump lands on the rendered source row (${anchor.why})`);

  await textSweep(page, 'real data');
  reportIssues(issues, 'real data');

  /* ---- M4: axe-core gate ----
     On a bypassCSP page: F44's CSP (script-src 'self') rightly blocks the
     harness's own inline axe injection. Every OTHER page in this test keeps
     CSP enforced — its violations would land in the console-error checks. */
  const axePage = await browser.newPage({ viewport: { width: 1280, height: 1400 }, bypassCSP: true });
  await axePage.goto(`${BASE}/?nointro#y=2030`, { waitUntil: 'networkidle' });
  await axePage.evaluate(() => document.fonts.ready);
  await axePage.waitForTimeout(600);
  await axePage.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const axe = await axePage.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target?.join(' '),
    }));
  });
  await axePage.close();
  const seriousPlus = axe.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const blocked = seriousPlus.filter((v) => !(v.id in AXE_ALLOWLIST));
  const allowed = seriousPlus.filter((v) => v.id in AXE_ALLOWLIST);
  for (const v of allowed) console.log(`  axe allowlisted: ${v.id} (${v.nodes} nodes) — ${AXE_ALLOWLIST[v.id]}`);
  if (blocked.length) {
    for (const v of blocked) fail(`axe ${v.impact}: ${v.id} — ${v.help} (${v.nodes} nodes, e.g. ${v.sample})`);
  } else ok(`axe: no unallowlisted serious/critical violations (${axe.length} total findings incl. moderate/minor)`);

  await page.close();
}

/* ================= pass 2 — fixture: all-suppressed QCEW ================= */
{
  console.log('PASS 2 — fixture: all-suppressed QCEW');
  const { page, issues } = await loadPage({
    routes: {
      '**/data/qcew.json': (route) =>
        route.fulfill({ path: fixture('qcew-all-suppressed.json'), contentType: 'application/json' }),
    },
  });
  const state = await page.evaluate(() => ({
    qcewVisible: !document.getElementById('qcew-plate').hidden,
    suppressedLabels: document.body.textContent.match(/suppressed \(BLS confidentiality\)/g)?.length || 0,
    compSuppressed: document.body.textContent.includes('ALL MONTHS SUPPRESSED'),
    zeros: [...document.querySelectorAll('#qcew-panel rect[fill="var(--copper)"]')].length,
  }));
  if (!state.qcewVisible) fail('qcew plate hidden under all-suppressed fixture');
  if (state.suppressedLabels < 5) fail(`expected suppression labels on every county, saw ${state.suppressedLabels}`);
  if (!state.compSuppressed) fail('comparator strips did not render the all-suppressed state');
  if (state.zeros !== 0) fail(`suppressed cells drew ${state.zeros} value bars — suppression must never render as a value`);
  if (state.qcewVisible && state.suppressedLabels >= 5 && state.compSuppressed && state.zeros === 0)
    ok('suppression renders as suppression everywhere, never zero');
  await textSweep(page, 'all-suppressed');
  reportIssues(issues, 'all-suppressed');
  await page.close();
}

/* ================= pass 3 — fixture: missing file ================= */
{
  console.log('PASS 3 — fixture: missing oews.json (404)');
  const { page, issues } = await loadPage({
    routes: {
      '**/data/oews.json': (route) =>
        route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }),
    },
    // the browser logs the 404 itself; that resource line is the *expected* signal
    allowConsole: [/Failed to load resource.*404/],
  });
  const state = await page.evaluate(() => ({
    oewsHidden: document.getElementById('oews-plate').hidden,
    qcewVisible: !document.getElementById('qcew-plate').hidden,
    physVisible: !document.getElementById('phys-plate').hidden,
  }));
  if (!state.oewsHidden) fail('oews plate rendered despite missing data file');
  if (!state.qcewVisible || !state.physVisible) fail('an unrelated plate went missing with oews 404');
  if (state.oewsHidden && state.qcewVisible) ok('missing file fails soft: plate hidden, page intact');
  await textSweep(page, 'missing-file');
  reportIssues(issues, 'missing-file');
  await page.close();
}

/* ================= pass 4 — fixture: extreme values ================= */
{
  console.log('PASS 4 — fixture: extreme-value QCEW');
  const { page, issues } = await loadPage({
    routes: {
      '**/data/qcew.json': (route) =>
        route.fulfill({ path: fixture('qcew-extreme.json'), contentType: 'application/json' }),
    },
  });
  const state = await page.evaluate(() => ({
    qcewVisible: !document.getElementById('qcew-plate').hidden,
    compVisible: !document.getElementById('comp-plate').hidden,
  }));
  if (!state.qcewVisible || !state.compVisible) fail('extreme fixture: qcew/comparator plates missing');
  else ok('extreme values render');
  await textSweep(page, 'extreme');
  reportIssues(issues, 'extreme');
  await page.close();
}

/* ================= pass 5 — fixture: changes.json (S44) ================= */
{
  console.log('PASS 5 — fixture: since-last-refresh deltas');
  const { page, issues } = await loadPage({
    routes: {
      '**/data/changes.json': (route) =>
        route.fulfill({ path: fixture('changes-sample.json'), contentType: 'application/json' }),
    },
  });
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('.refresh-delta')].map((e) => ({
      plate: e.closest('.plate')?.id,
      text: e.textContent,
    }))
  );
  const plates = new Set(chips.map((c) => c.plate));
  if (!plates.has('qcew-plate') || !plates.has('comp-plate') || !plates.has('bps-plate'))
    fail(`delta chips missing — got: ${[...plates].join(', ') || '(none)'}`);
  else if (!chips.every((c) => c.text.startsWith('SINCE LAST REFRESH (2026-06-15)')))
    fail('delta chip text malformed');
  else ok(`delta chips render on affected plates (${chips.length} chips)`);
  await textSweep(page, 'changes');
  reportIssues(issues, 'changes');
  await page.close();
}

/* ================= pass 6 — the subpages (R7/R8/R12) ================= */
{
  console.log('PASS 6 — subpages: methods, decisions, changelog');
  for (const sub of ['methods', 'decisions', 'changelog']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
    const issues = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') issues.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));
    await page.goto(`${BASE}/${sub}.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const state = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent.trim() || '',
      filled: [...document.querySelectorAll('[data-fill]')].every((el) => el.textContent.trim() !== '—'),
    }));
    if (!state.h1) fail(`${sub}: no h1 rendered`);
    if (!state.filled) fail(`${sub}: data-fill spans not populated (rev/refreshed)`);
    await textSweep(page, sub);
    reportIssues(issues, sub);

    if (sub === 'methods') {
      // the richest subpage carries the a11y gate for all three — on a
      // bypassCSP page (the harness's axe injection is inline script)
      const axePage = await browser.newPage({ viewport: { width: 1280, height: 1400 }, bypassCSP: true });
      await axePage.goto(`${BASE}/${sub}.html`, { waitUntil: 'networkidle' });
      await axePage.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const axe = await axePage.evaluate(async () => {
        const r = await window.axe.run(document, { resultTypes: ['violations'] });
        return r.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id} (${v.nodes.length})`);
      });
      if (axe.length) fail(`methods axe: ${axe.join(', ')}`);
      else ok('methods: axe clean');
      await axePage.close();
    }
    await page.close();
  }
}

await browser.close();
server.kill();

if (failures) {
  console.error(`CONTRACT FAIL — ${failures} failing check(s)`);
  process.exit(1);
}
console.log('contract clean: all passes green');
process.exit(0);
