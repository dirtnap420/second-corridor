// run-meta.mjs — shared per-run constants for the fetch scripts.
// P45: the orchestrator stamps one REFRESH_TIMESTAMP per run so a multi-
// minute refresh doesn't straddle midnight into two retrievedAt dates.
// P11: every emitted dataset carries schemaVersion; bump it deliberately
// when a dataset's shape changes (the site tolerates current and current−1).
export const RETRIEVED_AT =
  process.env.REFRESH_TIMESTAMP || new Date().toISOString().slice(0, 10);

export const SCHEMA_VERSION = 1;

// R34 — every emitted provenance block carries its terms, so the files keep
// their license when copied around. Upstream terms verified in
// docs/terms-ledger.md (P49); the derived aggregation is CC BY 4.0
// (LICENSE-CONTENT.md). Spread `...TERMS.<source>` after `notes`.
const DERIVED = 'derived series & aggregation: CC BY 4.0 (The Second Corridor)';
export const TERMS = {
  qcew: {
    license: `Upstream: public domain (U.S. government work); ${DERIVED}`,
    attribution: 'U.S. Bureau of Labor Statistics, Quarterly Census of Employment and Wages',
  },
  oews: {
    license: `Upstream: public domain (U.S. government work); ${DERIVED}`,
    attribution: 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics',
  },
  bps: {
    license: `Upstream: public domain (U.S. government work); ${DERIVED}`,
    attribution: 'U.S. Census Bureau, Building Permits Survey',
  },
  acsBase: {
    license: `Upstream: public domain (U.S. government work; Census Data API terms apply); ${DERIVED}`,
  },
  acsApiNotice:
    'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.',
  lodes: {
    license: `Upstream: U.S. government work (public domain by default; LODES publishes no explicit license statement); ${DERIVED}`,
    attribution: 'U.S. Census Bureau, LEHD Origin-Destination Employment Statistics (LODES)',
  },
  usaspending: {
    license: `Upstream: open data per USAspending.gov licensing (commercial and non-commercial reuse permitted); ${DERIVED}`,
    attribution: 'USAspending.gov, U.S. Department of the Treasury, Bureau of the Fiscal Service',
  },
  ipeds: {
    license: `Upstream: ODC-By v1.0 via the Urban Institute Education Data Portal (underlying IPEDS records: U.S. government work); ${DERIVED}`,
    attribution:
      'Education Data Portal, Urban Institute, https://educationdata.urban.org/, made available under the ODC Attribution License',
  },
  nyiso: {
    license: `Upstream: no express NYISO license — derived annual figures are facts computed from public operational data, see docs/terms-ledger.md; ${DERIVED}`,
    attribution: 'Computed from New York Independent System Operator public MIS load data',
  },
};
