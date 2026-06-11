# Execution plan — knocking out all five plans

Drafted 2026-06-10. This is the master roadmap and the **progress tracker** for:

| ID prefix | Plan | Items |
|---|---|---|
| **D** | `design-improvements.md` | 50 |
| **S** | `data-storytelling-improvements.md` | 50 |
| **P** | `pipeline-improvements.md` | 50 |
| **F** | `performance-improvements.md` | 50 |
| **R** | `reach-improvements.md` | 50 |

250 nominal items → **~244 unique** after the merges in the dedupe table below.
Item detail lives in the five plan docs; this doc only sequences and tracks. Check
items off here (`- [x]`) as they land.

**Why this ordering.** Three principles:
1. **Gates before changes** — the size/perf/CI gates go in first so every later wave
   is protected by them, not audited after the fact.
2. **Batch by file, not by plan** — `main.js`, `index.html`, `styles.css`, `chart.js`
   are each touched by 3–5 plans; items that edit the same file land in the same
   wave to avoid rework and merge thrash.
3. **Unblock dependents early** — pipeline's diff layer unlocks six storytelling/reach
   items; the rAF conductor (F37) must precede storytelling's motion items; the
   terms ledger (P49) gates data downloads (R31).

---

## Operating rules

- **One item = one commit** where practical; the item ID leads the message
  (`D5: riser value labels horizontal`). Multi-item commits list every ID.
- **Verify per wave, deploy per wave.** Exit criteria below; never start the next
  wave on a red build. Manual `npx vercel deploy --prod --yes` through Wave 3;
  CI deploys after.
- **Verification battery** (run at every wave exit):
  `npm run build` (design lint + size gate once it exists) · `node qa/offline.mjs` ·
  `npm run qa` + `node qa/sections.mjs` + `node qa/instrument.mjs` with visual
  review of the shots · perf trace (`qa/perf.mjs`, once it exists) on any wave that
  touched the instrument.
- **Copy discipline:** any new rendered sentence carries cite marks per the site's
  rule. Items flagged *[sign-off]* ship behind author approval of exact wording.
- **Deviation log:** when reality contradicts a plan item (it will), don't silently
  skip — note it under *Deviations* at the bottom with a one-line reason
  (done / changed / dropped).
- **A wave is done when every box is checked or explicitly moved to Deviations.**

---

## Phase 0 — author decisions (blocking input, ~15 minutes)

Nine decisions gate later work. Collect them all at kickoff so no wave stalls:

1. **Name + contact** for colophon/poster (P50≡R1) — blocks Wave 0.
2. **License** — code + content (R2) — blocks Wave 6.
3. **Custom domain** yes/no (R6) — should precede outreach (Wave 8).
4. **Publish the three citation decisions** as an editorial-decisions page (R8) —
   they're already flagged in the README; publishing is a separate yes.
5. **Refresh mode** — auto-commit or PR-review for data refreshes (P4).
6. **Analytics** — none (keep the zero-external-requests guarantee) or Vercel
   first-party (F8≡R47). Recommendation: none.
7. **Default year = today** (S3) — confirms a visible behavior change.
8. **Dark theme** in or out of scope (D43) — largest single design item.
9. **Wording sign-offs** — S11 headline rewrites; S23/S24/S27/S30/S33 takeaway
   lines (the items nearest the no-causal-claims line).

---

## Wave 0 — identity & baseline (~½ session)

Goal: real identity, a remote, and a recorded "before" state.

- [ ] P1 — GitHub repo created, pushed; real git identity configured
- [ ] P50≡R1 — colophon + poster placeholders filled
- [ ] F7 — baseline recorded: bundle bytes, Lighthouse run, qa shots archived
- [ ] R38 — audience map drafted *(author input)*
- [ ] Decisions 1–9 above collected and noted in this doc

**Exit:** repo public-ready (visibility can stay private until R3), baseline
committed, decision answers recorded under Deviations/Notes.

## Wave 1 — gates before changes (~1–2 sessions)

Goal: every subsequent wave lands on a protected build.

**Branch convention (active from this wave):** each wave is a branch
(`wave-1-gates`, `wave-2-defects`, …) landing as a PR to `main`. Vercel's Git
integration (connected 2026-06-10) attaches a preview deployment to every PR —
that preview link is the review artifact for Alex's checkpoints.

Prelude — execution machinery (added 2026-06-10, do first):
- [x] M1 — Vercel↔GitHub Git integration connected (Alex) — Wave 3's
      VERCEL_TOKEN walk-through is now moot; refresh PRs get preview deploys
- [x] M2 — repo `CLAUDE.md`: session ritual (read tracker → run battery →
      confirm green → change things), commit format, battery list, copy
      guardrail, sign-off list
- [x] M3 — visual regression diffing: commit current shots as baselines,
      pixelmatch step fails the battery on unexpected deltas; waves that intend
      visual change regenerate baselines in their PR
- [x] M4 — axe-core pass inside the contract test (a11y gate)
- [x] M5 — `docs/copy-deck.md`: pre-draft ALL sign-off copy (S23/S24/S27/S30/
      S33 takeaways, s06+s08 headlines, Part Two pivot paragraph, synthesis
      verdicts) with cites, for one async approval pass by Alex
- [x] M6 — spikes (feasibility notes only): (a) S23 scale problem — measured
      ~670 on a 0–52K axis hugs the floor; decide annotated floor-line vs
      magnified inset; (b) D3 mobile route-list prototype for Fig 04
- [x] M7 — `qa/fixtures/`: synthetic datasets (all-suppressed QCEW, missing
      file, extreme values) wired into the contract test
- [x] M8 — repo location: **stays in OneDrive** (Alex's call) — GitHub is the
      remote of record; recommended: pin folder "Always keep on this device"
      to reduce sync/lock races with `.git`
- [x] M9 — `git tag v0-baseline` + regenerate `og.png` (`npm run og`) and
      verify no `[NAME]` placeholder baked into the social card
- [x] M10 — **Alex:** send a test email to Alex@ozarkintelligence.com; confirm
      mailto: link choice (rec: plain mailto, accept the spam) *(confirmed
      working 2026-06-10, Wave 6 checkpoint)*

- [x] F2 — `lint-size.mjs` bundle gate in `npm run build`
- [x] F1 — `perf-budget.json` written
- [x] F3 — Lighthouse CI runnable locally + in CI
- [x] F4 — `qa/perf.mjs` runtime trace (intro → play → morph → flows)
- [x] F5 — throttled variant of F4
- [x] F6 — `performance.mark` boot stages
- [x] P3 — CI workflow: build + offline proof + (skeleton) contract test on push
- [x] P20 — unit tests for derived series + citation gate
- [x] P19 — frontend contract test, first version (plates render, no console errors)

**Exit:** CI green on a no-op commit; gates demonstrably fail on a seeded violation
(test once, revert).

## Wave 2 — defect sweep (~1–2 sessions)

Goal: clean base. Every visible defect from the design review plus the four runtime
findings and two pipeline bugs.

Design P1s:
- [x] D1 — Fig 02 legend clipping
- [x] D2 — mobile site-panel caption collision
- [x] D3 — mobile talent sankey legibility (largest item this wave)
- [x] D4 — Fig 02 mobile milestone flags
- [x] D5 — section-view riser label collisions
- [x] D6 — Albany riser right-edge clip
- [x] D7 — Fig 04 duplicated caption
- [x] D8 — node-plate `NODECLAY` spacing
- [x] D19 — Play button width lock
- [x] D35 — Fig 10a `GB.` label clipping

Runtime findings:
- [x] F27 — clamp play-loop delta
- [x] F10 — preload Archivo 900; audit 500 *(preload half landed Wave 1; the
      500 audit found it unused — face + woff2 deleted, fonts 86.9→72.4KB)*
- [x] F19 — parallelize `boot()`
- [x] F20 — reserve `.map-stage` space (CLS) *(landed early in Wave 1 — CI's
      slower runner exposed the unreserved stage as CLS 0.175; see deviations)*

Pipeline script bugs (independent of CI):
- [x] P25 — fail-soft orchestrator replaces `&&` chain (first cut of P42)
- [x] P43 — stale-cache fix across all eight fetchers

Token safety (do before later styling work builds on it):
- [x] D42 — `--copper-text` accessible token

**Exit:** full battery; fresh qa shots at 3 widths × 2 years show zero clipping or
overlap; `npm run data -- --dry-run` (or equivalent) survives one fetcher failing.

## Wave 3 — pipeline goes live (~1–2 sessions)

Goal: the tracker refreshes, validates, archives, and alerts itself.

- [x] P42 — orchestrator finished (`--only`, `--dry-run`, `--offline`)
- [x] P2 — scheduled refresh workflow (cron + dispatch + deploy)
- [x] P16 — JSON Schemas per dataset
- [x] P17 — cross-field invariants
- [x] P18 — provenance completeness check
- [x] P8 — `data-archive/` snapshots
- [x] P9 — `changes.json` diff emission
- [x] P10 — `CHANGELOG-DATA.md`
- [x] P11 — `schemaVersion`
- [x] P13 — no-change short-circuit
- [x] P14 — new-period detection
- [x] P44 — deterministic JSON output
- [x] P45 — single run timestamp
- [x] P27 — Wayback-archive all source URLs
- [x] P32 — `sources.json` consolidated registry
- [x] P34 — release-calendar config
- [x] P36 — FAIN watcher with loud alert
- [x] P35 — refresh outcome notifications
- [x] P37 — daily cheap checks / weekly full refresh split
- [x] P39 — `status.json`
- [x] P4 — review mode per decision #5
- [x] P5 — post-deploy health check

**Exit:** one full scheduled run executes on GitHub end-to-end (allowed to no-op);
a seeded schema violation fails the run; FAIN watcher confirmed querying.

## Wave 4 — the page becomes a story (~2–3 sessions)

Goal: storytelling spine + the design items that edit the same components.
This is the biggest single wave; land it in the file-cluster order below.

Masthead / opening (`index.html`, `styles.css`, `intro.js`):
- [x] S1 — dek poses the stake *[sign-off]*
- [x] S2 — five-numbers strip
- [x] S5 — act-structure TOC
- [x] S7 — expectations line (plates · minutes · refreshed)
- [x] S4 — intro ends by scrubbing to today
- [x] D37 — text-wrap balance/pretty
- [x] D48 — skip link

Time anchor (`main.js`, `chart.js`, `data.js`):
- [x] S3 — default year = today (per decision #7)
- [x] S16 — TODAY tick on scrubber
- [x] S17 — TODAY hairline on Fig 02
- [x] S18 — phase bands under scrubber
- [x] S19 — era readout beside year
- [x] S20 — ledger TODAY divider
- [x] D50 — calm aria-live during play

Instrument interaction (`map.js`, `main.js`, `index.html`):
- [x] D18 — scrubber moves up under the map
- [x] D13 — auto-select Clay
- [x] D14 — node hover state
- [x] D15 — node selected state
- [x] D16 — node label paper halo

Citation plumbing (`main.js`, `styles.css`):
- [x] D9 — cites land on `#src-N`
- [x] D10 — `:target` source highlight
- [x] D11 — scroll-margin
- [x] D12 — superscript line-height fix

Narrative frame (section copy + plate chrome):
- [x] S8 — PLAN / DERIVED / MEASURED stamps
- [x] S10 — Part Two pivot at s06
- [x] S11 — finding-headlines *[sign-off]*
- [x] S12 — takeaway line per plate (first batch: 06a, 07, 10a) *[sign-off]*
- [x] S13 — section 08 leads with the absence
- [x] S9 — forward links between sections
- [x] S14 — "what the record doesn't say" block

Ending:
- [x] S48 — synthesis plate
- [x] S49 — "what to watch next"

**Exit:** full battery + a top-to-bottom read-through against the storytelling doc;
all sign-off wordings approved; fresh deploy.

## Wave 5 — annotation & engagement (~2 sessions)

Prerequisite first:
- [x] F37 — shared rAF conductor (before any new motion below)

Figure annotation (`chart.js`, `sankey.js`, `live.js`, `map.js`):
- [x] S23 — plan-vs-measured overlay on Fig 02 *[sign-off]*
- [x] D23 — Fig 02 end-labels replace legend
- [x] D24≡S24 — hover-scrub on Fig 02 (one implementation) *[sign-off on annotation]*
- [x] S25 — Fig 03 8× takeaway
- [x] D25 — Fig 03 small-flow inset
- [x] D26 — Fig 03 fedrd identity
- [x] D27 — Fig 04 program spine emphasis
- [x] S26 — Fig 07 Monroe payoff
- [x] S27 — Fig 10a series-high stamp *[sign-off]*
- [x] S28 — Fig 11 stakes arithmetic
- [x] S30 — Fig 06c trend takeaway *[sign-off]*
- [x] S29 — wafer-dial legend
- [x] D17 — map scale bar + north arrow
- [x] D20 — milestone tick tooltips
- [x] D21 — ledger affordances
- [x] D22 — site panel ↔ Clay linkage
- [x] D28 — Fig 05 grid balance
- [x] D29 — spec-cell numerals
- [x] D30 — QCEW suppressed compression
- [x] D31 — QCEW zero-state
- [x] D32 — Fig 06c totals + width
- [x] D33 — Fig 07 self-commute bar
- [x] D34 — Fig 09 data-edge tick
- [x] D36 — Fig 11 legend row

Humanizing & links:
- [x] S31 — internal MW/MGD ratios
- [x] S32 — wage delta column
- [x] S33 — $100B internal anchor *[sign-off]*
- [x] S34 — particles = commuters legend
- [x] S35 — 50,000 decomposition chips
- [x] S37 — instrument ↔ section cross-links
- [x] S38 — sankey ribbon detail
- [x] S39 — node-plate go-deeper links
- [x] S42 — disclosure rename + row counts
- [x] S43 — full hash state (`view`/`particles`)
- [x] S6 — first-visit scrubber nudge

CSS polish batch:
- [x] D38 — eyebrow rules · D39 — ::selection · D40 — thin scrollbars ·
      D41 — tabular numerals · D44 — registration marks

**Exit:** full battery + perf trace (instrument touched heavily); deploy.

## Wave 6 — reach pass 1 + live-data storytelling (~1–2 sessions)

Pipeline-dependent frontend now unblocks:
- [x] S44 — "since last refresh" deltas (consumes P9) *(as delta chips — see deviations)*
- [x] S45 — relative data-age chips
- [x] S46 — next-release calendar surface (consumes P34)
- [x] S47 — one voice for empty states
- [x] R15≡P28 — archived links rendered in Sources

Citability floor:
- [x] R2 — license applied (per decision #2)
- [x] R3 — repo public *(flipped by Alex; discovered during exit verification — see deviations)*
- [x] ~~R4 — independence statement~~ *(dropped per Q2 — see deviations)*
- [x] R5 — contact + corrections channel
- [x] R7 — methods page
- [x] R8 — editorial-decisions page *(per decision #4)*
- [x] R9 — corrections policy + log
- [x] R10 — data dictionary
- [x] R11 — recommended-citation block
- [x] R12 — changelog page (consumes P10)
- [x] R13 — limitations page (reuses S14 content)
- [x] R14 — robots.txt + humans.txt
- [x] R16 — sitemap + JSON-LD Article/Dataset
- [x] R18 — og:updated_time
- [x] R20 — stable-anchor documentation
- [x] R21 — build rev in colophon

Shareable surfaces & data out:
- [x] R22 — `/f/NN` share URLs
- [x] R23 — per-section OG images (extends `build-og.mjs`)
- [x] S50≡R24 — copy-link per plate (one implementation)
- [x] R25 — poster footer URL check
- [x] F48≡R26 — print-PDF harness + linked brief (one implementation)
- [x] P49 — API terms ledger (gates next three) *(NYISO adjudication — see deviations)*
- [x] R31 — CSV per plate
- [x] R32 — data-contract doc
- [x] R33 — `all.zip`
- [x] R34 — license field in provenance

**Exit:** share cards validate in OG/Twitter validators; CSVs open clean in a
spreadsheet; methods/decisions pages live; deploy.

## Wave 7 — performance pass 2 + mobile (~1–2 sessions)

Bundle & startup:
- [ ] F9 — scoped d3 imports
- [ ] F11 — drop unused font weights
- [ ] F13 — poster-chunk CI assertion
- [ ] F14 — poster prefetch on intent
- [ ] F15 — explicit build target
- [ ] F21 — preload geo JSON
- [ ] F24 — intro failsafe re-enable
- [ ] F42 — preload list trim

Runtime:
- [ ] F28 — offscreen surface gating during play
- [ ] F29 — adaptive particle pool
- [ ] F30 — DPR scaling on low memory
- [ ] F31 — morph length lerp
- [ ] F32 — canvas pre-scale transform
- [ ] F33 — content-visibility (test vs D11 anchors + print)
- [ ] F34 — plate containment
- [ ] F35 — ledger batched writes

Delivery:
- [ ] F39 — stale-while-revalidate on /data
- [ ] F40 — explicit HTML cache policy
- [ ] F41 — Brotli assertion
- [ ] F43 — data 404 behavior
- [ ] F44 — security headers + CSP

Mobile (design):
- [ ] D45 — compact mobile dials
- [ ] D46 — mobile corridor crop
- [ ] D47 — QCEW mobile ordering

**Exit:** full battery + before/after metrics appended to `performance-improvements.md`
(F7 baseline vs now); throttled trace passes budget; deploy.

## Wave 8 — engagement texture + reach channels (~1–2 sessions)

Motion & depth (F37 prerequisite long since landed):
- [ ] S40 — Fig 02 draw-on-scroll
- [ ] S41 — Fig 05 count-ups
- [ ] S36 — find-your-county highlighter
- [ ] S15 — 60-second guided tour
- [ ] S21 — milestone toast during play
- [ ] S22 — relative time on future milestones
- [ ] D49 — mini-TOC rail
- [ ] D43 — dark theme *(per decision #8; includes canvas token read)*

Reach channels:
- [ ] R28 — embed mode
- [ ] R29 — oEmbed descriptor
- [ ] R30 — five-numbers share image
- [ ] R39 — refresh notes as posts
- [ ] R40 — RSS/Atom feed
- [ ] R41 — press kit
- [ ] R42 — mapped outreach (first sends; groundbreaking window)
- [ ] R46 — subscribe-without-infrastructure docs
- [ ] R47 — analytics decision implemented (per decision #6)
- [ ] R48 — permanence statement

**Exit:** embed renders in a test iframe; feed validates; tour plays clean under
reduced motion (skips); deploy.

## Wave 9 — long tail + final audit (~1 session)

Triage every remaining P3 explicitly — do, defer, or drop with a Deviations note:

- [ ] P6 · P7 · P12 · P15 · P21 · P22 · P23 · P24 · P26 · P29 · P30 · P31 · P33 ·
      P38 · P40 · P41 · P46 · P47 · P48
- [ ] F8 (decision #6 record) · F12 · F16 · F17 · F18 · F22 · F23 · F25 · F26 ·
      F36 · F38 · F45 · F46 · F47 · F49 · F50
- [ ] R17 · R19 · R27 · R35 · R36 · R37 · R43 · R44 · R45 · R49 · R50
- [ ] Final audit: full battery at 3 widths × 4 years · print PDF review ·
      accessibility spot-check (keyboard walk, SR pass on instrument) ·
      Lighthouse vs budget · README updated to reflect everything above
- [ ] Close this doc: every box checked or in Deviations

---

## Dedupe table (merged items — single implementations)

| Merged | Lands in | One implementation of |
|---|---|---|
| P50 ≡ R1 | Wave 0 | identity placeholders |
| D24 ≡ S24 | Wave 5 | Fig 02 hover-scrub + annotation |
| S50 ≡ R24 | Wave 6 | per-plate copy-link |
| F48 ≡ R26 | Wave 6 | print-PDF harness + brief |
| R15 ≡ P28 | Wave 6 | archived source links (P27 backend in Wave 3) |
| F8 ≡ R47 | Decision #6 | analytics stance |
| P34 → S46 · P8/P9 → S44/S45 · P10 → R12/R40 | backend Wave 3, frontend Wave 6+ | calendar/diff/changelog surfaces |

## Risk register

- **File hotspots:** `main.js` (waves 2,4,5), `index.html` (2,4,5,6), `styles.css`
  (2,4,5,7,8), `chart.js` (2,4,5). Mitigation: the wave clustering above; within a
  wave, land clusters in the listed order.
- **Source renumbering:** adding methods/decisions pages must not renumber `[n]`
  cites mid-wave; `sources.json` (P32) + the key→n ledger (P33) protect old posters.
- **`content-visibility` (F33)** can break cite anchor jumps and print — it ships
  with its own test or not at all.
- **Dark theme (D43)** touches the canvas's hard-coded copper and the poster/OG
  light-mode assumption — scoped last for a reason.
- **Copy creep:** ten items add rendered sentences; every one carries cites and the
  flagged ones wait for sign-off. When in doubt, the guardrail in the storytelling
  doc wins over this schedule.
- **Estimate honesty:** ~12–17 working sessions total. Waves 4 and 5 are the likely
  overruns; both split cleanly at their cluster boundaries if needed.

## Deviations & notes

**2026-06-10 — Wave 6 checkpoint decisions (Alex, on PR #7):**
- New copy approved in full (methods/decisions/changelog pages, absence
  voice, delta-chip template, colophon lines) — the Q4 batch review for this
  wave is closed.
- **NYISO: ship in current state** — the terms-ledger adjudication stands;
  nyiso.csv stays in the downloads.
- Commit-history identity exposure (`Alex Harris <aharris128@gmail.com>`):
  accepted, no history rewrite.
- M10 closed: test email to the colophon address confirmed working.
- PR #7 merged (1adfe78); production auto-deployed via the Git integration.
- **Post-deploy catch (S44 fix, 8b9c49e on main):** the health gate found a
  console 404 on production — live.js fetches /data/changes.json, which
  didn't exist until the first refresh change. Local gates missed it because
  vite preview's SPA fallback answers missing paths with index.html (200)
  while Vercel 404s. Fixed by committing an empty-state changes.json (no
  changes since the launch baseline — machine-readable, overwritten by the
  first real change run). **Gate-coverage note for future waves:** the
  offline/contract harnesses run against vite preview, which cannot prove a
  fetched path exists in production — the post-deploy health check is the
  gate that catches that class.

**Wave 6 progress (2026-06-10, branch `wave-6-reach`):**
- All boxes landed except R3 (staged — see below). Notes and deviations:
- **S44 (changed):** ships as since-last-refresh *delta chips* — a direct
  restatement of changes.json (period/revision counts + vintage transition) on
  each affected plate — not the plan's per-figure `(+82 SINCE 2025Q3)`
  arithmetic. P9's diff walks period-keyed arrays only; nested entity arrays
  (qcew's `corridor[]`) diff wholesale, so per-figure prior values aren't in
  the artifact. Verified against a synthetic changes.json (now a contract-test
  fixture); the real file appears with the first post-launch change.
- **P49 adjudication (author review):** seven of eight upstream sources are
  public domain or attribution-licensed (Urban's ODC-By attribution and the
  Census-API notice now ride in provenance). **NYISO grants no express reuse
  license.** The derived Zone C annual figures ship in the downloads anyway —
  they are facts computed by this pipeline from public operational CSVs, six
  rows deep (Feist) — with the judgment documented in docs/terms-ledger.md.
  If Alex prefers, nyiso.csv + the zip entry come out with one config line;
  emailing NYISO for written permission is the clean resolution.
- **R23 (changed):** per-section cards are design-system compositions
  (figure number + the section's own headline/eyebrow parsed from index.html
  + refresh date + corridor motif), not plate snapshots — snapshots would need
  a headless raster of the live DOM per refresh; the resvg harness stays
  deterministic and runs inside `npm run build`, so refresh deploys always
  ship current cards.
- **Budget revision (recorded in perf-budget.json):** cssBytes 20480→24576 —
  the size gate sums all dist CSS and the subpage sheet (3.4KB, standalone by
  design so prose pages don't load the 19.7KB instrument sheet) now exists.
  Main JS ends the wave at 98.8% of its unchanged budget; F9 (Wave 7) recovers.
- **S45 forced a QA hardening:** render output is now date-dependent (ages,
  TODAY tick, release calendar), so visual-diff pins the page clock
  (2026-06-15T12:00:00Z, ≥ all retrievedAt; ages clamp at 0). Baselines
  regenerated under the pinned clock.
- **R22 implementation note:** the share shims rewrite `#sNN` into an `&f=NN`
  hash slot so the `#y=` state survives the redirect; the index-side scroll is
  load-deferred and instant — the browser's load-time scroll restoration
  clobbers earlier scrolls, and the ledger's follow-scroll cancels smooth ones.
- **F48≡R26:** public/brief.pdf is committed (~1.1MB) and regenerated by the
  refresh workflow on change runs — repo weight grows per refresh, same
  watch-item as the visual baselines (M3 note).
- **R3 — already public:** exit verification found the repo ALREADY public
  (`private: false`, unauthenticated fetch 200; Wave 5's deploys still showed
  private) — Alex flipped it himself. The pre-public history audit ran clean:
  no secret-shaped strings in any committed blob, no .env/key/raw files ever
  committed. One exposure now live, flagged FYI: commit metadata (early
  commits + the refresh workflow's git config) carries
  `Alex Harris <aharris128@gmail.com>` while the public byline is "Alex"
  alone. Rewriting history would scrub it but breaks tags/PR refs — Alex's
  call whether it matters.



**2026-06-10 — Phase 0 decisions FINAL (all collected):**
1. Byline: **"Alex" alone** · contact **Alex@ozarkintelligence.com**
2. License: **MIT (code) + CC BY 4.0 (content/derived data)** — confirmed incl.
   commercial-reuse-with-attribution (Q16: yes)
3. Custom domain: **no** this cycle (R6 deferred — re-raise before Wave 8 outreach)
4. Editorial-decisions page: **yes, publish** (R8)
5. Refresh mode: **PR review**; refresh PRs containing only new periods /
   no value revisions **auto-merge after 72h** unreviewed (P4 + Q14)
6. Analytics: **none — and do not advertise "no tracking"** (adjust R47: silent)
7. Default year = today: **yes** (S3)
8. Dark theme: **no — D43 dropped**
9. Copy workflow: **batch-review in PRs**, guardrail is the rule; flagged five
   (S23/S24/S27/S30/S33) get individual sign-off (Q4)

**Q&A round 2 (all 20 answered):**
- Q2 independence statement: **omit entirely — R4 dropped** (author preference)
- Q3 GitHub repo: **private until Wave 6** (R3 = flip to public then); account
  walk-through with Alex when created
- Q5 finding-headlines: **s06 + s08 only** (S11 scoped)
- Q6 dek: **option A** (tension version) — S1 wording pre-approved
- Q8 guided tour: **in** · Q9 find-your-county: **in** · Q10 embed mode: **in**
- Q11 Wikipedia: **defer** until refresh track record exists (R45 → Wave 9 defer)
- Q12 cadence: weekly full + daily cheap checks **confirmed**
- Q13 alerts: **GitHub only** (no email wiring)
- Q15 Vercel token: Alex creates it **with a walk-through at Wave 3**
- Q17 audience priority: **TBD — re-ask at Wave 8 kickoff** (R38 partially blocked)
- Q18 social: **email only** · Q19 press contact: **yes, invite it**
- Q20 rhythm: **autonomous Waves 1–3 (deploy at exit), checkpoint reviews from
  Wave 4 on**

**Dropped:** D43 (dark theme) · R4 (independence statement) · R6 (custom domain,
deferred).

**2026-06-11 — decisions revised by Alex:**
- **Copy deck APPROVED in full** (docs/copy-deck.md, one pass): all nine items
  including the five individually-flagged wordings S23/S24/S27/S30/S33.
  S30 ships **Option A** (exact-number restatement), the deck's recommendation,
  approval given on the pass without an explicit A/B choice.
- **Autonomy extended through Wave 5** ("get wave 3,4,5 done") — supersedes
  Q20's checkpoint-from-Wave-4: Waves 3–5 merge on green CI and deploy; Alex
  reviews live. Checkpoints resume at Wave 6 (the repo-public wave).

**2026-06-10 — execution machinery (10 proposals → Wave 1 prelude M1–M10):**
M1 done by Alex (Vercel↔GitHub connected); M8 decided (repo stays in OneDrive);
M10 owned by Alex; M2–M7, M9 fold into Wave 1, to be executed first. Wave-branch
PR convention adopted from Wave 1 on. Wave 3 note: VERCEL_TOKEN no longer
needed — deploys ride the Git integration; remaining Wave 3 check is `workflow`
scope on the GCM token before pushing `.github/workflows/`.

**Wave 0 progress (2026-06-10):**
- [x] P50≡R1 — colophon (`index.html`) + poster (`poster.js:221`) placeholders
      filled with Alex · Alex@ozarkintelligence.com; git identity set locally
- [x] F7 — baseline recorded: main JS **177,975 B** · CSS **11,923 B** · poster
      chunk **8,680 B** (dist/assets, build of a876040); qa shots archived in
      `qa/shots/` + `qa/shots/sections/` at 375/768/1280 × y2022/26/30/45;
      Lighthouse re-run lands with Wave 1's LHCI
- [x] R38 — audience map: priority order TBD (Q17), candidates listed in
      `reach-improvements.md` #38
- [x] P1 — GitHub repo created via stored GCM credentials:
      **github.com/dirtnap420/second-corridor** (private per Q3), branch renamed
      master→main, pushed + tracking. No `gh` CLI on this machine — API calls go
      through the GCM token; pushes authenticate automatically.
- Vercel verified via connected MCP: project `second-corridor`
  (prj_joA8QUb1DKa93C3DeaPSIdVy288C, team_FtWfFaCKTmOfgnk3nkeJM1fT), production
  READY at second-corridor.vercel.app; direct deploys available in-session.
- **Wave 3 deploy decision now easier:** recommend connecting the GitHub repo to
  the Vercel project (dashboard action, ~1 min, works with private repos) —
  pushes to main auto-deploy and refresh PRs get preview deployments, which fits
  PR-review mode exactly; the VERCEL_TOKEN secret then becomes unnecessary.
  Check at Wave 3: whether the GCM token carries `workflow` scope (needed to
  push `.github/workflows/`); if not, one-time PAT walk-through with Alex.
- Plan library + Wave 0 changes committed; verification of the colophon render
  rides Wave 2's battery (text-only change)

**Wave 1 progress (2026-06-10, branch `wave-1-gates`):**
- All M-prelude items (M2–M7, M9) and all gate items (F1–F6, P3, P19, P20)
  landed. M10 remains with Alex (test email to the colophon address).
- **Gates proven to fail:** size gate + visual diff on seeded violations
  (budget cut to 100KB → fail at 178.2%; line-height 1.55→1.62 → all 12 shots
  fail on dimension change), both reverted. Unit tests and the axe gate failed
  on **real** violations found during the wave — better than seeded proof:
  - P20's citation-integrity sweep caught the talent sankey's GlobalFoundries
    node citing a nonexistent key (`ny-88-companies`) — it rendered uncited.
    Repointed to `ny-156-companies` (ESD page, same as the suppliers node).
  - M4's axe pass caught `nested-interactive` (serious): the map SVG was
    `role=img` with `role=button` node markers nested inside, hiding them
    from AT. Fixed: `role=group`. `color-contrast` (17 nodes) is allowlisted
    in `qa/contract.mjs` with the item ID that clears it (D42, Wave 2).
- **F3 deviation:** `@lhci/cli` replaced by a direct Lighthouse-API runner
  (`qa/lighthouse.mjs`, Playwright-launched Chromium over CDP) —
  chrome-launcher's temp-profile cleanup crashes on Windows (EPERM, no retry).
  Same gate, fewer deps. Gate takes the **median of 3 runs** (single-run
  lantern LCP varies ±10%).
- **F1 calibration:** lab LCP budget set to **2400ms** (measured median
  2.13s) — the LCP element is the masthead h1 in Archivo 900, which is not
  preloaded until **F10 (Wave 2)**; the budget file carries the instruction to
  tighten to 1800ms when F10 lands. Bundle/CLS/runtime budgets as planned;
  runtimeThrottled block added (60ms frame cap vs 33.3ms measured max).
- **M3 notes:** baselines are reduced-motion captures (particle engine off →
  bit-identical across runs, verified). 12 PNGs ≈ 14.3MB committed per
  baseline generation — repo weight grows with each visual wave; revisit if it
  hurts. Visual diff and qa/perf.mjs are **local-only** battery steps; CI
  excludes them by design (cross-OS rasterization noise; shared-runner timing
  noise).
- Housekeeping: README colophon line still had the `[NAME]` placeholder text —
  fixed; `desktop.ini` (OneDrive) gitignored; stale `lighthouserc.json`
  reference in the budget comment fixed.
- Measured at exit: desktop playback p95 16.7ms / max 16.8ms, zero long
  tasks; throttled (6×, DPR 2) p95 16.7ms / max 33.3ms; Lighthouse median
  perf 0.99 / a11y 0.97 / bp 1.0, CLS 0.013.
- **F20 pulled forward from Wave 2:** first CI run failed Lighthouse with
  CLS 0.175 (vs 0.013 locally) — on the slower runner the map SVG mounts
  after first paint, so the unreserved `.map-stage` collapse counts fully.
  Fixed the root cause instead of loosening the CLS budget. Note: the pure-CSS
  reservation (`aspect-ratio` + `min-height`) was tried first and **rejected by
  the visual gate** — min-height transfers through aspect-ratio into block
  width (stage ballooned 333→473px at mobile and the responsive mount rendered
  to it). Final fix: one synchronous pre-paint line in `boot()` setting the
  stage height with renderMap's exact formula, cleared after mount. Visual
  baselines unaffected (verified 12/12).
- Observation for Wave 2's defect sweep: pre-existing ~21px horizontal
  overflow at the 375px viewport (document scroll width 396) — likely one of
  the D-item clipping defects; confirm which item covers it.
- **F10 (preload half) also pulled forward:** after F20, CI CLS was still
  0.124 — the first screen renders Archivo 900 (h1/h2 = LCP), Archivo 400,
  and Plex Mono 500, none preloaded; Linux fallback metrics (DejaVu) rewrap
  the masthead so the swap reflows the whole first screen (Windows Arial
  masked it locally even at 24× CPU throttle). Preloading the three ended it:
  local CLS 0.013→0.003, LCP variance collapsed. F10's Archivo-500 usage
  audit stays in Wave 2; preload-list trim is F42.
- **Lab CLS budget calibrated 0.02→0.05:** post-fix CI still measures ~0.03
  (vs 0.003 local, 0.009 deployed) — observed CLS scales with runner
  slowness. 0.05 stays inside Lighthouse "good" and still catches structural
  regressions (the unreserved stage measured 0.175).
- **Vercel Git integration:** connected by Alex mid-wave (after the branch
  push — the earlier M1 note was premature). Preview deployments now fire on
  push but arrive **BLOCKED** pending one-time authorization (commit author
  email not verified on the dirtnap420 GitHub account), and the merge to main
  produced **no production deployment** — production branch setting likely
  still "master" from before the rename. Both are dashboard fixes for Alex.
  Wave 1 production was deployed manually (`npx vercel deploy --prod --yes`)
  per the operating rules; verified serving the Wave 1 build.
- **WAVE 1 EXIT MET (2026-06-10):** PR #1 merged (23cdbd6); CI green on the
  PR head and again on the main merge commit (the no-op proof); production
  deployed and verified. GCM token confirmed to carry `workflow` scope
  (Wave 3's open check, answered early).

**Wave 5 progress (2026-06-11, branch `wave-5-annotation`):**
- All ~35 boxes landed (S26/S27 were substantially closed by Wave 4's
  computed takeaways; Wave 5 added the remaining halves). Notes:
- F37 conductor: play, glide, morph, particles share one rAF. The preview
  widget's reduced-motion emulation initially masqueraded as a particle
  regression — the engine is OFF by design under reduced motion; verified
  with a clean Playwright run instead. Beware the preview widget for
  motion checks.
- S23 ships the spike's floor-line: the measured series at true scale +
  callout; Fig 02 now mounts post-data to receive QCEW. D24's click
  commits the hovered year through glideTo — charts as controllers.
- S34 reworded to COMMUTES (not the plan's COMMUTERS): LODES JT00 counts
  jobs, multiple jobholders count twice — Decision 16's honesty rule
  outranks the template wording here too.
- S43 deep links: view/p parse initially clobbered the year slot (writeHash
  fired before the year applied) — year captured first now; round-trip
  verified both directions.
- Two same-wave axe catches: S39's go-deeper links were color-only in a
  text block (underlined now); dial-label cites needed the fixed 24×24
  treatment at mobile. End state: axe zero findings, Lighthouse a11y 1.0,
  CLS 0.003, both perf traces clean (p95 16.8ms desktop / 33.3ms throttled).
- **Wave 3's dispatch proof CLOSED:** third run green end-to-end — full
  refresh, validation, Wayback step, FAIN check against live USAspending,
  gates green on the runner, and the pipeline opened its own PR (#5,
  data-refresh + gates-green labels). Two infra fixes were needed along the
  way: existence-checked git adds in the PR step, and the repo setting
  "Allow GitHub Actions to create and approve pull requests" (default off;
  enabled via API). PR #5 carries archives.json which Wave 5 also ships —
  close #5 as superseded after this merge; the next weekly run diffs clean.

**Wave 4 progress (2026-06-11, branch `wave-4-story`):**
- All 30 boxes landed; approved copy-deck wording throughout. Notes:
- Every value in a takeaway/verdict is computed from the data at render
  (the 10a series-high line self-adjusts if a later year beats it; the s08
  absence duration computes from provenance — 18 months, correcting the
  deck's hand-counted "fourteen"; the WATCHING verdict composes from
  whichever datasets loaded).
- S4 finale policy: natural intro completion glides 2022→today; interrupts
  snap to today only if the reader hasn't taken the timeline (scrolling is
  the common interrupt and must not strand them at 2022).
- **Bundle budget revised deliberately** (mainJs 180→200KiB, CSS 16→20KiB):
  the narrative layer measured +7.5KB JS / +4.9KB CSS; the size gate caught
  it as designed; rationale recorded in perf-budget.json. F9 (Wave 7)
  recovers bundle weight.
- **Lighthouse round-trip during exit:** target-size flagged the strip's
  cite marks; the first fix (inline-block+padding) caused CLS 0.128 — the
  marks fill after data loads and flow-affecting expansion rewrapped the
  masthead post-paint. Final: fixed 24×24 boxes from first paint (axe-
  measurable, fill-stable) + act-toc padding + era-readout fixed column and
  reserved height (its text changes mid-glide). End state: perf 0.99 /
  **a11y 1.0** / bp 1.0 / CLS 0.003.
- bindCiteMarks now collapses adjacent duplicate marks ([1][1] → [1] when
  two keys resolve to one source), matching the generated marks' dedupe.
- **Wave 3's dispatch proof closed out here:** the GitHub full refresh
  re-fetched every source cold and reproduced the committed data
  byte-for-byte ("checked, unchanged" — P44/P45 proven end-to-end); gates
  ran green on the runner. The run then failed in the PR step: the weekly
  Wayback step had written archives.json (a real, commit-worthy artifact)
  while no-change runs never create data-archive/, and the PR step's
  git add listed it unconditionally. Fixed (existence-checked adds +
  changes.json body fallback); re-dispatch after this merge.

**Wave 3 progress (2026-06-11, branch `wave-3-pipeline`):**
- All 22 boxes landed. Architecture: `refresh.mjs` = snapshot → fetch
  (fail-soft) → validate per-source with restore-on-fail → diff (timestamp
  churn ignored) → archive/changes.json/changelog/status only on real change.
- **Proofs run:** offline e2e (7 ok + ipeds fail-soft by design + checked-
  unchanged + clean tree); seeded prior-value change produced the exact diff,
  archive, changelog, status; seeded schema violation through the orchestrator
  → INVALID, previous data restored, exit 1; health check green against live
  production; Wayback availability API verified.
- **Design notes / deviations:**
  - PRs opened with the default GITHUB_TOKEN cannot trigger the `ci` workflow
    (GitHub anti-recursion) — the refresh workflow runs the gates itself
    against the refreshed data and labels the PR `gates-green`; the P4
    auto-merge requires that label + `new-period-only` + >72h.
  - status.json is written only on change runs, so daily no-op crons cause
    zero repo churn; "lastChecked" semantics live in the Actions run history.
  - ipeds has no offline mode (its latest-year probe must hit the network) —
    fails soft under --offline by design.
  - usaspending reads cache only under OFFLINE=1 (it is the FAIN watcher).
  - archives.json population started locally; the weekly run retries any
    URLs the Internet Archive timed out on (save endpoint is slow on some
    press-release hosts; availability-API fallback added after first run).
- Remaining for the dispatch proof: workflow_dispatch on main post-merge
  (recorded below at exit).

**Wave 2 progress (2026-06-10/11, branch `wave-2-defects`):**
- All boxes above landed. Notes and deviations:
- D1 went further than planned: the key also clipped at 375 (never seen in
  the column-width screenshots) — left-aligned everywhere + two-row wrap
  below 420px.
- D5 includes a bonus overlap fix: the GREAT-CIRCLE title sat at datum height
  and ran through the RIT risers — moved to the section panel's top-left.
- D42 raised Lighthouse accessibility 0.97 → **1.0**; the axe allowlist is
  now empty and axe reports zero findings at any severity. README Decision 20
  marked resolved.
- The mobile-overflow hunt found two real culprits: the OEWS wage table
  (361px in a 333px plate → the standing 21px page overflow) and the numbers
  tables when opened (page → 623px). Fixed with scoped overflow containment —
  and the first attempt (blanket `.plate-body` rule) was **caught by the axe
  gate** (scrollable-region-focusable): final version scopes to
  `details.numbers` + `#oews-panel` with keyboard access on the panel.
- The m-instrument shot review caught D2's first fix overprinting fab labels
  at 375 — captions moved to the panel bottom. (Two of this wave's own fixes
  were corrected by Wave 1's gates/review loop — the machinery pays rent.)
- P43 per the audit: qcew/bps/ipeds refetch their latest period fresh each
  run (with a freshThisRun set to avoid double-downloading probe files);
  lodes always probes (cache fallback only on probe failure); **usaspending
  never reads cache** — it is the FAIN watcher, and a cached response would
  have hidden the Micron award appearing on USAspending (raw/ is a write-only
  audit archive; OFFLINE=1 reads it back). oews/acs/nyiso vintages are
  immutable with calendar-anchored newest-first probes — cache-if-present is
  correct there; all eight honor NO_CACHE=1.
- P25 proven: `node scripts/refresh.mjs --only=nyiso,qcew --fail=qcew` →
  qcew FAIL, nyiso completed, exit 1 (the wave's fail-soft exit criterion).
  An incidental nyiso.json retrievedAt-only bump (UTC midnight rollover) was
  reverted — timestamp churn isn't a data refresh (P45's concern, Wave 3).
- Throttled perf trace after F19: boot stages now overlap fetches; playback
  p95 16.7ms / max 50.0ms (within the 60ms cap, 0 frames over).
- Exit battery: build+lints, units 8/8, offline proof, contract 4/4 (axe 0
  findings), visual baselines regenerated ×2 (post-D42 colors, post-caption
  fix) and verified deterministic, Lighthouse perf 0.99 / **a11y 1.0** / bp
  1.0 / CLS 0.003, shots reviewed at 375/768/1280 — zero clipping/overlap.
- **WAVE 2 EXIT MET (2026-06-11):** PR #2 merged (3cf4b36) on green CI.
  **The Vercel Git pipeline is now fully live end-to-end:** the PR got an
  unblocked preview deployment (the git-email fix resolved attribution), and
  the merge to main auto-deployed Production — verified serving the Wave 2
  build. Manual `vercel deploy` is no longer needed; Wave 3's CI deploy
  story simplifies to "merge the refresh PR".
