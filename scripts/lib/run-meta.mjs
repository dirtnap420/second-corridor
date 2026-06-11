// run-meta.mjs — shared per-run constants for the fetch scripts.
// P45: the orchestrator stamps one REFRESH_TIMESTAMP per run so a multi-
// minute refresh doesn't straddle midnight into two retrievedAt dates.
// P11: every emitted dataset carries schemaVersion; bump it deliberately
// when a dataset's shape changes (the site tolerates current and current−1).
export const RETRIEVED_AT =
  process.env.REFRESH_TIMESTAMP || new Date().toISOString().slice(0, 10);

export const SCHEMA_VERSION = 1;
