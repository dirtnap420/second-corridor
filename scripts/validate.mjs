// validate.mjs — P16+P17+P18: schema validation, cross-field invariants, and
// provenance completeness for every fetched dataset. A malformed agency
// response must fail the refresh, never render garbage.
//
//   node scripts/validate.mjs               validate all eight datasets
//   node scripts/validate.mjs qcew permits  validate a subset
//   node scripts/validate.mjs --file=path --as=qcew   validate one file
//
// Exit non-zero on any failure; used by refresh.mjs per-source and by CI.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { NODES } from '../src/data.js';

const root = new URL('..', import.meta.url);
const DATASETS = ['qcew', 'ipeds', 'oews', 'lodes', 'spending', 'permits', 'acs', 'nyiso'];

/* ---------- ajv with all schemas registered ---------- */
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const schemaDir = new URL('../schemas/', import.meta.url);
for (const f of readdirSync(fileURLToPath(schemaDir))) {
  if (f.endsWith('.schema.json')) {
    ajv.addSchema(JSON.parse(readFileSync(new URL(f, schemaDir), 'utf8')));
  }
}

/* ---------- P17: cross-field invariants per dataset ---------- */
const contiguous = (years, ctx, errs) => {
  for (let i = 1; i < years.length; i++) {
    if (years[i] !== years[i - 1] + 1) errs.push(`${ctx}: years not contiguous (${years[i - 1]} → ${years[i]})`);
  }
};

const INVARIANTS = {
  qcew(d, errs) {
    const fips = new Set(d.corridor.map((c) => c.fips));
    for (const n of NODES) {
      if (!fips.has(n.county)) errs.push(`corridor missing NODES county ${n.county} (${n.countyName})`);
    }
    for (const c of d.corridor) {
      contiguous(c.series.map((s) => s.year), `corridor ${c.name}`, errs);
      for (const s of c.series) {
        if (typeof s.semi === 'number' && s.semi > s.total)
          errs.push(`corridor ${c.name} ${s.year}: semi ${s.semi} > total ${s.total}`);
        if (typeof s.semi === 'object' && !s.semi.suppressed)
          errs.push(`corridor ${c.name} ${s.year}: object cell without suppressed:true`);
      }
    }
    for (const c of d.comparators) {
      const yms = c.months.map((m) => m.ym);
      if (new Set(yms).size !== yms.length) errs.push(`comparator ${c.fips}: duplicate months`);
    }
  },
  permits(d, errs) {
    for (const c of d.counties) contiguous(c.series.map((s) => s.year), `permits ${c.name}`, errs);
  },
  acs(d, errs) {
    for (const c of d.counties) {
      const sum = c.lessHS + c.hs + c.someCollege + c.baPlus;
      if (sum !== c.pop25) errs.push(`acs ${c.name}: groups sum ${sum} ≠ pop25 ${c.pop25}`);
    }
  },
  nyiso(d, errs) {
    contiguous(d.annual.map((a) => a.year), 'nyiso annual', errs);
    d.annual.forEach((a, i) => {
      if (a.partial && i !== d.annual.length - 1) errs.push(`nyiso: partial year ${a.year} is not the last entry`);
      if (a.peakMW < a.avgMW) errs.push(`nyiso ${a.year}: peak ${a.peakMW} < avg ${a.avgMW}`);
    });
  },
  lodes(d, errs) {
    const sum = d.origins.reduce((a, o) => a + o.jobs, 0) + d.otherJobs;
    if (sum !== d.totalJobs) errs.push(`lodes: origins+other ${sum} ≠ totalJobs ${d.totalJobs}`);
    for (let i = 1; i < d.origins.length; i++) {
      if (d.origins[i].jobs > d.origins[i - 1].jobs) errs.push(`lodes: origins not sorted desc at index ${i}`);
    }
  },
  ipeds(d, errs) {
    const years = [...new Set(d.series.map((s) => s.year))].sort((a, b) => a - b);
    contiguous(years, 'ipeds series', errs);
    const insts = new Set(d.institutions.map((i) => i.short));
    for (const s of d.series) {
      if (!insts.has(s.inst)) errs.push(`ipeds: series inst ${s.inst} not in institutions`);
    }
    for (const y of years) {
      const got = d.series.filter((s) => s.year === y).length;
      if (got !== d.institutions.length)
        errs.push(`ipeds ${y}: ${got} inst rows, expected ${d.institutions.length}`);
    }
  },
  oews(d, errs) {
    for (const o of d.occupations) {
      for (const area of ['national', 'syracuse', 'rochester']) {
        const c = o[area];
        const flags = ['suppressed', 'topcoded', 'absent'].filter((f) => c[f]);
        if (flags.length > 1) errs.push(`oews ${o.soc} ${area}: conflicting flags ${flags.join('+')}`);
        if (flags.length === 0 && typeof c.median !== 'number')
          errs.push(`oews ${o.soc} ${area}: neither median nor a state flag`);
      }
    }
  },
  spending(d, errs) {
    // the FAIN-watcher invariant: either the absence block exists, or Micron
    // CHIPS awards are present in the ledger — never neither
    const micron = d.awards.filter((a) => /micron/i.test(a.recipient));
    if (!d.chipsNotPublished && micron.length === 0)
      errs.push('spending: no chipsNotPublished block and no Micron award — one must hold');
  },
};

/* ---------- run ---------- */
const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='))?.slice(7);
const asArg = args.find((a) => a.startsWith('--as='))?.slice(5);
const names = fileArg ? [asArg] : args.filter((a) => !a.startsWith('--'));
const targets = names.length ? names : DATASETS;

let failed = 0;
for (const name of targets) {
  if (!DATASETS.includes(name)) {
    console.error(`unknown dataset: ${name}`);
    failed++;
    continue;
  }
  const path = fileArg || fileURLToPath(new URL(`public/data/${name}.json`, root));
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`VALIDATE FAIL ${name}: unreadable JSON — ${e.message}`);
    failed++;
    continue;
  }
  const validate = ajv.getSchema(name);
  const errs = [];
  if (!validate(data)) {
    for (const e of validate.errors) errs.push(`schema ${e.instancePath || '/'} ${e.message}`);
  } else {
    INVARIANTS[name]?.(data, errs);
  }
  if (errs.length) {
    console.error(`VALIDATE FAIL ${name}:`);
    errs.slice(0, 12).forEach((e) => console.error(`  ${e}`));
    if (errs.length > 12) console.error(`  …and ${errs.length - 12} more`);
    failed++;
  } else {
    console.log(`valid: ${name}`);
  }
}
if (failed) {
  console.error(`VALIDATION FAILED for ${failed} dataset(s)`);
  process.exit(1);
}
console.log('all datasets valid');
