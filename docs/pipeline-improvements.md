# Pipeline improvement plan — "Keep it alive" — 50 items

Drafted 2026-06-10. Companion to `design-improvements.md`, `data-storytelling-improvements.md`,
`performance-improvements.md`, and `reach-improvements.md`.

**The gap this plan closes:** the site's premise is *the measured reality, refreshed
with one command* — but the command (`npm run data`) runs by hand on one machine,
deploys are manual (`npx vercel deploy --prod --yes`), the repo has **no remote**
(`git remote -v` is empty), and nothing validates the data on its way in. The
storytelling plan's tracker items (refresh deltas #44, next-release calendar #46,
data-age chips #45) all depend on infrastructure in this plan.

Grounded findings this plan fixes along the way:
- `npm run data` chains eight fetchers with `&&` (`package.json:13`) — the first
  failure silently kills every later dataset.
- The raw-response cache never invalidates (`scripts/fetch-qcew.mjs:49-51` returns any
  existing file forever) — "latest quarter" files go permanently stale.
- Git identity is the placeholder `Aharr <aharr@localhost>`; the colophon's
  `[NAME]`/`[CONTACT/URL]` are unfilled.

Priority key: **P1** = the tracker isn't live without it · **P2** = integrity/trust ·
**P3** = hardening.

---

## A. Foundation — repo, CI, deploy (1–7)

1. **P1 — Create the remote.** Initialize a GitHub repository and push; set a real
   git identity (current commits are authored `aharr@localhost`). Everything below
   (Actions, releases, issues-as-alerts) hangs off this.

2. **P1 — Scheduled refresh workflow.** GitHub Actions: cron + `workflow_dispatch` →
   `npm ci` → refresh (item 42's orchestrator) → diff `public/data/` → commit if
   changed → `npm run build` → deploy. Store `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `VERCEL_PROJECT_ID`, and `CENSUS_API_KEY` (used by `scripts/fetch-acs.mjs:363`;
   keyless fallback exists) as repo secrets.

3. **P1 — CI gates on every push.** `npm run build` (already includes
   `lint:design`), `node qa/offline.mjs` (the self-containment proof), and the
   contract test (item 19). The repo has good gates; today nothing runs them
   automatically.

4. **P2 — Review mode for large diffs.** When a refresh changes more than N values
   or adds a period, open a PR with the diff summary + regenerated
   `qa/shots/sections/` screenshots as artifacts instead of committing directly —
   author reviews the story before it publishes.

5. **P2 — Post-deploy health check.** After deploy, fetch the production URL and
   assert: HTTP 200, colophon vintage matches the new `retrievedAt`, all expected
   plates present (re-use the contract test against prod).

6. **P3 — Documented rollback.** One README paragraph: `vercel rollback` + revert
   commit; the data archive (item 8) makes data rollback a file copy.

7. **P3 — Toolchain currency.** Enable Dependabot (or a monthly `npm audit` job) for
   playwright/sharp/vite — the pipeline's own dependencies are now production
   infrastructure.

## B. Snapshots, diffs, history (8–15)

8. **P1 — Archive every refresh.** Before overwriting, copy `public/data/*.json` to
   `data-archive/YYYY-MM-DD/` (committed). History of the public record is the
   tracker's appreciating asset — today each refresh destroys the previous one.

9. **P1 — Emit `public/data/changes.json`.** Per dataset: values changed, periods
   added, suppression flips, prior vintage. This single file powers storytelling
   #44 ("+82 since 2025Q3"), the changelog (item 10), and alerting (section E).

10. **P2 — Append `CHANGELOG-DATA.md`.** One human-readable block per refresh
    ("2026-09-05 — QCEW 2026Q1 arrived: Onondaga 670→741; Oneida still suppressed").
    Doubles as the reach plan's feed source.

11. **P2 — `schemaVersion` in every JSON.** Site tolerates current and current−1;
    fetchers bump it deliberately. Decouples pipeline deploys from site deploys.

12. **P3 — Archive raw responses per refresh.** Zip `raw/` as a workflow artifact
    (not committed — it's gitignored for size). Auditability: any published number
    can be traced to the exact bytes the agency served.

13. **P2 — No-change short-circuit.** If `changes.json` is empty, skip commit and
    deploy; log "checked, unchanged" — so the cron can run weekly without churn.

14. **P2 — New-period detection.** Flag "2026Q1 now available" distinctly from value
    revisions in `changes.json` — new periods are news; revisions are bookkeeping.

15. **P2 — Revision tracking.** QCEW/OEWS revise history. When an already-published
    value changes, record `{period, was, now}` in `changes.json` — the site can then
    say "BLS revised 2025Q3 upward," which is honest-tracker gold.

## C. Validation & integrity gates (16–26)

16. **P1 — JSON Schema per dataset.** `schemas/*.schema.json` validated after fetch,
    before write (ajv in the orchestrator). A malformed agency response must fail
    the refresh, not render garbage.

17. **P1 — Cross-field invariants.** Beyond shape: suppressed cells are
    `{suppressed:true}` and never 0 (the rule documented in `fetch-qcew.mjs:9-11`);
    corridor FIPS set exactly matches `data.js NODES`; years contiguous; county
    `total` ≥ `semi`.

18. **P2 — Provenance completeness check.** Every emitted file must carry
    `source/url/retrievedAt/vintage/notes` — the site renders these; a missing
    vintage currently fails silently (`live.js setVintage` no-ops).

19. **P1 — Frontend contract test.** Playwright against the built site with the new
    data: every non-hidden plate renders, zero console errors, no literal `NaN` /
    `undefined` / empty vintage in visible text. Extends `qa/offline.mjs`, which
    already proves self-containment.

20. **P2 — Unit tests for the derived layer.** `investAt(2030)===20`,
    `constrHighAt(2027)===4000`, `supplyAt(2045)===41000`, and the citation gate
    (uncited figure → does not render) — the spec's rules, frozen as tests
    (`src/data.js:115-160`).

21. **P2 — Numeric tripwires.** Alert when a latest value moves more than ±25% or a
    series shrinks — catches both API breakage and actual news, and you want to know
    about either within a day.

22. **P2 — Suppression-flip surfacing.** A county moving suppressed↔published is
    itself a story (Fig 06a is half hatch boxes today). Detect and put it at the top
    of the refresh summary.

23. **P2 — Citation-key integrity in CI.** Boot the site headless; assert every
    `src` key in `MILESTONES`/`INSTALLED_BASE`/`NODES` resolved to a footnote, and
    report orphaned keys (today an uncited key just silently un-renders content —
    correct behavior, but the author should be told).

24. **P3 — Rendered-text lint.** Greps the contract-test DOM for `NaN`,
    `undefined`, `[object`, `Invalid Date` — cheap, catches a whole class of
    regression.

25. **P1 — Fail-soft orchestration.** Replace the `&&` chain in `package.json` with
    `scripts/refresh.mjs`: run all eight fetchers, aggregate per-source pass/fail,
    exit non-zero only if any failed — but never let one dead API block the other
    seven datasets from refreshing.

26. **P3 — Per-API conduct file.** Document each source's rate limits, keys, terms
    (BLS polite-delay already implemented at `fetch-qcew.mjs:53`; Census key per
    `fetch-acs.mjs`; LODES bulk etiquette) so a future maintainer doesn't get the
    project blocked.

## D. Source preservation — link rot is the citation site's decay mode (27–33)

27. **P1 — Wayback-archive every source at refresh.** POST each `SOURCE_LIST` URL to
    the Internet Archive save API; store `archiveUrl` + archive date alongside the
    live URL in the source registry. ~37 citations underpin the site; press releases
    and agency pages move constantly.

28. **P2 — Render the archived link.** Each Sources row gets a muted `· archived ↗`
    link (site change, but the data comes from this pipeline; pairs with reach #15).

29. **P2 — Weekly link-health job.** HEAD-request all source URLs; report 404s,
    soft-404s, and redirect chains as a GitHub issue with the affected footnote
    numbers.

30. **P3 — Preserve cited documents.** Snapshot the load-bearing PDFs (FEIS, the
    8-K, NIST award pages) into the private raw archive — copyright-respecting
    insurance, not republication.

31. **P3 — Content-drift detection.** Hash the text of key cited pages; when a hash
    changes, flag the citation for re-verification — a cited page silently rewording
    its numbers is worse than it 404ing.

32. **P2 — Single source-registry export.** Source entries are registered at runtime
    (`registerSources`, populated from `sources.js`/`live.js`). Emit the consolidated
    registry as `public/data/sources.json` during build so the link-checker,
    archiver, and reach plan all consume one canonical list.

33. **P3 — Stable citation keys across renumbering.** Footnote numbers shift when
    sources are added; keep the key→n mapping per release in the archive so an old
    poster's "[14]" remains resolvable.

## E. Scheduling & alerting — appointment data (34–41)

34. **P1 — Release-calendar config.** `scripts/release-calendar.json`: QCEW
    (quarterly, ~5 months after quarter end), OEWS (annual, spring), IPEDS (fall),
    ACS 5-yr (December), LODES (annual), NYISO Gold Book (April), USAspending
    (continuous). Drives per-source cron schedules *and* the storytelling plan's
    "next release" surface (#46).

35. **P2 — Refresh outcome notifications.** Success-with-changes / no-change /
    failure → GitHub issue or commit-status; failures assign the author. No external
    services needed.

36. **P1 — The FAIN watcher.** `fetch-usaspending.mjs` already queries CFDA 11.037.
    The day a Micron award record appears is this site's single biggest pending news
    event (Fig 08's "absence is the datapoint" inverts). Make that condition a
    dedicated, loud alert — and pre-draft the plate's "it appeared" state.

37. **P2 — Daily cheap checks, weekly full refresh.** USAspending and link health
    are light enough to check daily; BLS/Census on their calendar; full refresh
    weekly. Matches each source's actual tempo instead of one blunt cron.

38. **P3 — Manual-source reminders.** NYISO Gold Book and FEIS-class documents
    aren't fetchable as APIs; the calendar opens an annual "re-verify [37]" issue
    instead of pretending automation.

39. **P2 — `public/status.json`.** Last refresh time, per-source ok/stale/fail, next
    expected release — written by the orchestrator; the colophon and the reach
    plan's status surface read it.

40. **P3 — Freshness SLO.** Define "stale": any source >35 days past its expected
    release without a refresh → alert. The tracker's promise, monitored.

41. **P3 — Refresh metrics.** Append per-run duration, bytes fetched, cache hit
    ratio to a log artifact — pipeline drift (an API slowing or bloating) becomes
    visible before it becomes a failure.

## F. Ergonomics, determinism, docs (42–50)

42. **P1 — One orchestrator with flags.** `scripts/refresh.mjs --only=qcew --dry-run
    --offline` replacing the npm `&&` chain (item 25): per-source results table,
    `--dry-run` prints would-be diff without writing, `--offline` uses cache only.

43. **P1 — Fix the stale-cache bug.** `fetchCsv` returns any cached file forever
    (`fetch-qcew.mjs:50-51`). Cache completed periods permanently, but always
    re-fetch the latest year/quarter (or honor a `--no-cache` flag in CI). Same
    audit for the other seven fetchers.

44. **P2 — Deterministic output.** Sort object keys and arrays before writing JSON
    so a no-change refresh is byte-identical and diffs are pure signal.

45. **P3 — Single run timestamp.** Stamp one `retrievedAt` per orchestrator run (not
    per script) so a multi-minute refresh doesn't straddle midnight into two dates.

46. **P2 — `docs/pipeline.md`.** The architecture: fetch → validate → diff → archive
    → build → deploy, with the calendar and failure modes. The README's "Refresh &
    deploy" section becomes a pointer.

47. **P3 — Pre-flight for humans.** `npm run data:check` = orchestrator `--dry-run`;
    the author sees what a refresh would change before committing to it.

48. **P3 — CI for the QA harnesses themselves.** `qa/screenshot.mjs`,
    `qa/sections.mjs`, `qa/instrument.mjs` run weekly against prod and upload shots —
    visual drift (font CDN changes, browser updates) gets caught by diffing.

49. **P3 — Terms-of-use ledger.** One table: each API's license/attribution
    requirements (BLS public domain, Census terms, NYISO Gold Book usage terms) —
    required before the reach plan republishes data as CSV.

50. **P1 — Fill the identity placeholders.** Real git author, colophon
    `[NAME]`/`[CONTACT/URL]` (also flagged in the reach plan #1) — automated commits
    and a public repo shouldn't ship under `aharr@localhost`.

---

## Suggested sequencing

- **Pass 1 — make it live (P1):** 1, 2, 3, 8, 9, 16, 17, 19, 25, 27, 34, 36, 42,
  43, 50. After this pass the tracker refreshes itself, validates itself, and yells
  when the FAIN lands.
- **Pass 2 — integrity & history (P2):** 4, 5, 10, 11, 13, 14, 15, 18, 20, 21, 22,
  23, 28, 29, 32, 35, 37, 39, 44, 46.
- **Pass 3 — hardening (P3):** the rest.

Dependencies: items 8–10 unlock storytelling #44–46; item 32 unlocks reach #15/#23;
item 49 gates reach #31–37 (data downloads).
