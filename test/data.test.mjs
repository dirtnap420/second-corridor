// data.test.mjs — P20: the spec's derived-series rules and the citation gate,
// frozen as tests. Run: npm test (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  YEAR_MIN,
  YEAR_MAX,
  MILESTONES,
  NODES,
  INSTALLED_BASE,
  CAPITAL_SANKEY,
  TALENT_SANKEY,
  PHYS_ANCHORS,
  COMPARATORS,
  SERIES_SOURCES,
  SOURCES,
  SOURCE_LIST,
  cite,
  registerSources,
  investAt,
  constrLowAt,
  constrHighAt,
  permAt,
  supplyAt,
} from '../src/data.js';

test('derived series — invest: (2022,0) → (2030,$20B) → (2045,$100B)', () => {
  assert.equal(investAt(2022), 0);
  assert.equal(investAt(2030), 20);
  assert.equal(investAt(2045), 100);
  assert.equal(investAt(2026), 10); // linear midpoint of the first leg
  // clamps outside the cited range — no extrapolation
  assert.equal(investAt(2020), 0);
  assert.equal(investAt(2050), 100);
});

test('derived series — constr band: ramp to the only cited figure, held flat, illustrative ramp-down', () => {
  assert.equal(constrLowAt(2025), 0);
  assert.equal(constrHighAt(2025), 0);
  assert.equal(constrLowAt(2027), 3000);
  assert.equal(constrHighAt(2027), 4000);
  // held flat at the cited figure through the cited continuous-construction window
  assert.equal(constrHighAt(2035), 4000);
  assert.equal(constrHighAt(2041), 4000);
  assert.equal(constrLowAt(2041), 3000);
  // illustrative ramp-down lands at zero
  assert.equal(constrHighAt(2042), 0);
  assert.equal(constrLowAt(2042), 0);
});

test('derived series — perm: (2029,0) → (2045,9000)', () => {
  assert.equal(permAt(2029), 0);
  assert.equal(permAt(2045), 9000);
  assert.equal(permAt(2037), 4500);
  assert.equal(permAt(YEAR_MIN), 0);
});

test('derived series — supply = cited ~50,000 total minus cited 9,000 direct', () => {
  assert.equal(supplyAt(2029), 0);
  assert.equal(supplyAt(2045), 41000);
  // the stack top at 2045 is the cited ~50,000 total
  assert.equal(permAt(2045) + supplyAt(2045), 50000);
});

test('year domain is the spec window', () => {
  assert.equal(YEAR_MIN, 2022);
  assert.equal(YEAR_MAX, 2045);
});

test('citation gate — unknown key yields null, so the figure does not render', async () => {
  assert.equal(cite('no-such-key'), null);
  // the render-gate predicate used by buildLedger and friends
  const fakeMilestone = { year: 2031, label: 'uncited', src: ['no-such-key'] };
  assert.equal(fakeMilestone.src.some((s) => cite(s)), false);
});

test('citation registry — registerSources numbers sequentially and maps every key', async () => {
  await import('../src/sources.js'); // populate the registry
  assert.ok(SOURCE_LIST.length > 0, 'registry is populated');
  SOURCE_LIST.forEach((e, i) => assert.equal(e.n, i + 1, 'footnote numbers are 1..n in order'));
  for (const e of SOURCE_LIST) {
    for (const k of e.keys) {
      assert.equal(SOURCES[k], e, `key ${k} maps to its entry`);
      assert.equal(cite(k), e.n, `cite(${k}) returns the footnote number`);
    }
  }
});

test('citation integrity — every src key referenced by authored data resolves', async () => {
  await import('../src/sources.js');
  const referenced = new Set();
  for (const m of MILESTONES) m.src.forEach((k) => referenced.add(k));
  for (const n of NODES) referenced.add(n.src);
  for (const i of INSTALLED_BASE) referenced.add(i.src);
  for (const keys of Object.values(SERIES_SOURCES)) keys.forEach((k) => referenced.add(k));
  for (const n of CAPITAL_SANKEY.nodes) if (n.src) referenced.add(n.src);
  for (const l of CAPITAL_SANKEY.links) if (l.src) referenced.add(l.src);
  for (const n of TALENT_SANKEY.nodes) if (n.src) referenced.add(n.src);
  for (const p of PHYS_ANCHORS.power) referenced.add(p.src);
  referenced.add(PHYS_ANCHORS.water.src);
  referenced.add(PHYS_ANCHORS.water.permitted.src);
  for (const c of COMPARATORS) referenced.add(c.src);

  const orphans = [...referenced].filter((k) => !cite(k));
  assert.deepEqual(orphans, [], `orphaned src keys (would silently un-render): ${orphans.join(', ')}`);
});
