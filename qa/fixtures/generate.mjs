// qa/fixtures/generate.mjs — M7: writes the synthetic datasets used by the
// contract test's fixture passes. Deterministic; outputs are committed.
// Run (only when changing fixture shape): node qa/fixtures/generate.mjs
import { writeFileSync } from 'node:fs';

const out = (name, obj) =>
  writeFileSync(new URL(`./${name}`, import.meta.url), JSON.stringify(obj, null, 1) + '\n');

const provenance = (notes) => ({
  source: 'SYNTHETIC FIXTURE — qa/fixtures/generate.mjs',
  url: 'about:fixture',
  retrievedAt: '2026-01-01',
  vintage: 'QCEW annual 2020-2025; quarterly 2020Q1-2025Q4 (FIXTURE)',
  notes,
});

const CORRIDOR = [
  ['36037', 'Genesee'],
  ['36055', 'Monroe'],
  ['36067', 'Onondaga'],
  ['36065', 'Oneida'],
  ['36001', 'Albany'],
];
const COMPARATOR_FIPS = ['36067', '04013', '39089', '16001', '48491'];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

const months = (emp) => {
  const list = [];
  for (let y = 2020; y <= 2025; y++)
    for (let m = 1; m <= 12; m++)
      list.push({ ym: `${y}-${String(m).padStart(2, '0')}`, emp: emp(y, m) });
  return list;
};

/* every cell suppressed — the renderer must hatch, never zero, never NaN */
out('qcew-all-suppressed.json', {
  provenance: provenance('All semi cells suppressed; totals normal.'),
  corridor: CORRIDOR.map(([fips, name]) => ({
    fips,
    name,
    series: YEARS.map((year) => ({ year, semi: { suppressed: true }, total: 100000 })),
  })),
  comparators: COMPARATOR_FIPS.map((fips) => ({
    fips,
    months: months(() => ({ suppressed: true })),
  })),
});

/* absurdly large values — axes, bars, and percentages must stay finite */
out('qcew-extreme.json', {
  provenance: provenance('Extreme values: semi far above total, huge monthly series.'),
  corridor: CORRIDOR.map(([fips, name], i) => ({
    fips,
    name,
    series: YEARS.map((year, j) => ({
      year,
      semi: i === 0 && j === 0 ? 0 : 5000000 + i * 999999 + j,
      total: 100000,
    })),
  })),
  comparators: COMPARATOR_FIPS.map((fips) => ({
    fips,
    months: months((y, m) => (m % 7 === 0 ? { suppressed: true } : 9999999 - y * 13 - m)),
  })),
});

console.log('fixtures written: qcew-all-suppressed.json, qcew-extreme.json');
