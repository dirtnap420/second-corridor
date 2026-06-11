# The pipeline (P46)

How the data refreshes itself, end to end. The orchestrator is
`scripts/refresh.mjs`; the schedule is `.github/workflows/refresh.yml`
(weekly full refresh Mondays 06:17 UTC; daily USAspending check 05:47 UTC —
it is the FAIN watcher).

```
fetch (fail-soft, one dead API never blocks the rest)
  → validate per source (JSON Schema + cross-field invariants; INVALID
    restores the previous file)
  → diff prev vs new (retrievedAt-only churn = "checked, unchanged", no
    commit; new periods vs value revisions vs suppression flips are
    distinguished)
  → on real change: archive prior state to data-archive/YYYY-MM-DD/,
    write public/data/changes.json + CHANGELOG-DATA.md + public/status.json
  → open a refresh PR (gates run INSIDE the workflow — PRs from
    GITHUB_TOKEN can't trigger the ci workflow, anti-recursion — and the
    PR carries the gates-green label as proof)
  → new-period-only PRs auto-merge after 72h unreviewed (decision #5);
    anything revising a published value waits for review
  → merge auto-deploys via the Vercel Git integration; verify with
    node qa/health.mjs (vintage match, plates render, zero console
    errors, brotli on, real 404s)
```

Weekly extras: Wayback-archive every source URL + the site itself
(`scripts/archive-sources.mjs` → `public/data/archives.json`), upload `raw/`
as a 90-day artifact (P12), staleness SLO check (P40), and — each April —
the manual re-verify reminder for the Gold Book/FEIS citations (P38).

Local commands:

```sh
npm run data         # full refresh (writes on real change)
npm run data:check   # P47 — dry run: print the would-be diff, write nothing
node scripts/refresh.mjs --only=qcew,nyiso   # subset
node scripts/refresh.mjs --offline           # cache-only (tests; ipeds fails soft)
```

## Failure modes & labels

| Label | Meaning | Opened by |
|---|---|---|
| `refresh-failure` | a fetcher or validator failed (fail-soft: the rest refreshed; last-good restored) | refresh.yml |
| `fain-alert` | a Micron CHIPS award record appeared on USAspending — the site's biggest pending news event | refresh.yml |
| `stale-source` | a source exceeded its `staleAfterDays` grace with no data change — the silent failure mode | refresh.yml weekly |
| `manual-reverify` | the annual April reminder for non-API sources (Gold Book, FEIS) | refresh.yml weekly |
| `data-refresh` / `new-period-only` / `gates-green` | refresh PR classification; all three → 72h auto-merge | refresh.yml |

## Rollback (P6)

- **Site rollback:** `git revert <merge-commit> && git push` — the Vercel Git
  integration redeploys main automatically. (Or the Vercel dashboard's
  Instant Rollback for the deployment itself.)
- **Data rollback:** copy `data-archive/YYYY-MM-DD/*.json` back over
  `public/data/` and open a PR — the archive holds the pre-change state of
  every dataset a refresh touched.
- Never `--force` over main; the refresh PRs and the changelog are the audit
  trail.

## API conduct (P26)

Per-source etiquette, keys, and cache semantics — so a future maintainer
doesn't re-derive this from eight fetchers. Cadences live in
`scripts/release-calendar.json`; reuse terms in `docs/terms-ledger.md`.

| Source | Key | Conduct in code | Cache semantics |
|---|---|---|---|
| BLS QCEW | none | 150ms polite delay between CSV API calls (`fetch-qcew.mjs`) | latest period refetched fresh each run |
| BLS OEWS | none | bulk xlsx downloads, calendar-anchored probes | vintages immutable — cache-if-present |
| Urban/IPEDS | none | latest-year probe must hit the network (no offline mode) | latest survey year refetched fresh |
| LEHD LODES | none | bulk gz downloads | always probes; cache fallback on probe failure |
| USAspending | none | API v2, 150ms delay | **never reads cache** — it is the FAIN watcher (`OFFLINE=1` reads raw/ back) |
| Census BPS | none | annual flat files | vintages immutable — cache-if-present |
| Census ACS | `CENSUS_API_KEY` (optional — keyless falls back to the Summary File) | API path carries the required ToS notice in provenance | vintages immutable — cache-if-present |
| NYISO | none | monthly zip archives | vintages immutable — cache-if-present |
| Wayback SPN | none | 6s delay between save requests; availability-API fallback | archives.json is append-only |

Env contract (all eight fetchers honor these): `NO_CACHE=1` force-refetch ·
`OFFLINE=1` cache-only · `REFRESH_TIMESTAMP` one date per run (P45).
