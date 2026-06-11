// lint-size.mjs — F2: fails the build if dist/ exceeds perf-budget.json.
// Main JS = entry chunks (index-*.js); the poster chunk is lazy-loaded and
// budgeted separately when F13 lands. Run automatically by `npm run build`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const budget = JSON.parse(readFileSync(join(root, 'perf-budget.json'), 'utf8')).bundle;
const assets = join(root, 'dist', 'assets');
const fonts = join(root, 'dist', 'fonts');

const sum = (dir, match) =>
  readdirSync(dir)
    .filter((f) => match.test(f))
    .reduce((t, f) => t + statSync(join(dir, f)).size, 0);

const checks = [
  ['main JS', sum(assets, /^index-.*\.js$/), budget.mainJsBytes],
  ['CSS', sum(assets, /\.css$/), budget.cssBytes],
  ['fonts total', sum(fonts, /\.woff2$/), budget.fontTotalBytes],
];

// F13: the poster chunk must stay lazy — a refactor that hoists it into the
// initial graph would show up here as a modulepreload of poster-*.js
const indexHtml = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
if (/<link[^>]*rel="modulepreload"[^>]*poster-/.test(indexHtml) || /<script[^>]*src="[^"]*poster-/.test(indexHtml)) {
  console.error('SIZE GATE FAIL: poster chunk is referenced eagerly from index.html — it must stay dynamic-import only');
  process.exit(1);
}
console.log('poster chunk ok: dynamic-import only (not in the initial graph)');

let failed = false;
for (const [label, actual, max] of checks) {
  const pct = ((actual / max) * 100).toFixed(1);
  const line = `${label.padEnd(12)} ${String(actual).padStart(8)} B / ${max} B (${pct}%)`;
  if (actual > max) {
    console.error(`SIZE GATE FAIL: ${line}`);
    failed = true;
  } else {
    console.log(`size ok: ${line}`);
  }
  if (actual === 0) {
    console.error(`SIZE GATE FAIL: ${label} measured 0 bytes — did the build run?`);
    failed = true;
  }
}
if (failed) process.exit(1);
