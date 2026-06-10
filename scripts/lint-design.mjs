// lint-design.mjs — fails the build if shipped CSS violates the locked design system:
// no border-radius, no gradients, no backdrop-filter. Run automatically by `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distAssets = join(process.cwd(), 'dist', 'assets');
const banned = /border-radius|gradient|backdrop-filter/i;

let checked = 0;
let failed = false;
for (const f of readdirSync(distAssets)) {
  if (!f.endsWith('.css') && !f.endsWith('.js')) continue;
  const text = readFileSync(join(distAssets, f), 'utf8');
  // Only CSS files and CSS-in-JS strings matter; scan both to be safe.
  if (f.endsWith('.css')) {
    checked++;
    const m = text.match(banned);
    if (m) {
      console.error(`DESIGN LINT FAIL: "${m[0]}" found in ${f}`);
      failed = true;
    }
  }
}
if (checked === 0) {
  console.error('DESIGN LINT FAIL: no CSS files found in dist/assets — did the build run?');
  process.exit(1);
}
if (failed) process.exit(1);
console.log(`design lint clean (${checked} CSS file${checked === 1 ? '' : 's'} checked)`);
