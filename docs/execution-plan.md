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

## Wave 1 — gates before changes (~1 session)

Goal: every subsequent wave lands on a protected build.

- [ ] F2 — `lint-size.mjs` bundle gate in `npm run build`
- [ ] F1 — `perf-budget.json` written
- [ ] F3 — Lighthouse CI runnable locally + in CI
- [ ] F4 — `qa/perf.mjs` runtime trace (intro → play → morph → flows)
- [ ] F5 — throttled variant of F4
- [ ] F6 — `performance.mark` boot stages
- [ ] P3 — CI workflow: build + offline proof + (skeleton) contract test on push
- [ ] P20 — unit tests for derived series + citation gate
- [ ] P19 — frontend contract test, first version (plates render, no console errors)

**Exit:** CI green on a no-op commit; gates demonstrably fail on a seeded violation
(test once, revert).

## Wave 2 — defect sweep (~1–2 sessions)

Goal: clean base. Every visible defect from the design review plus the four runtime
findings and two pipeline bugs.

Design P1s:
- [ ] D1 — Fig 02 legend clipping
- [ ] D2 — mobile site-panel caption collision
- [ ] D3 — mobile talent sankey legibility (largest item this wave)
- [ ] D4 — Fig 02 mobile milestone flags
- [ ] D5 — section-view riser label collisions
- [ ] D6 — Albany riser right-edge clip
- [ ] D7 — Fig 04 duplicated caption
- [ ] D8 — node-plate `NODECLAY` spacing
- [ ] D19 — Play button width lock
- [ ] D35 — Fig 10a `GB.` label clipping

Runtime findings:
- [ ] F27 — clamp play-loop delta
- [ ] F10 — preload Archivo 900; audit 500
- [ ] F19 — parallelize `boot()`
- [ ] F20 — reserve `.map-stage` space (CLS)

Pipeline script bugs (independent of CI):
- [ ] P25 — fail-soft orchestrator replaces `&&` chain (first cut of P42)
- [ ] P43 — stale-cache fix across all eight fetchers

Token safety (do before later styling work builds on it):
- [ ] D42 — `--copper-text` accessible token

**Exit:** full battery; fresh qa shots at 3 widths × 2 years show zero clipping or
overlap; `npm run data -- --dry-run` (or equivalent) survives one fetcher failing.

## Wave 3 — pipeline goes live (~1–2 sessions)

Goal: the tracker refreshes, validates, archives, and alerts itself.

- [ ] P42 — orchestrator finished (`--only`, `--dry-run`, `--offline`)
- [ ] P2 — scheduled refresh workflow (cron + dispatch + deploy)
- [ ] P16 — JSON Schemas per dataset
- [ ] P17 — cross-field invariants
- [ ] P18 — provenance completeness check
- [ ] P8 — `data-archive/` snapshots
- [ ] P9 — `changes.json` diff emission
- [ ] P10 — `CHANGELOG-DATA.md`
- [ ] P11 — `schemaVersion`
- [ ] P13 — no-change short-circuit
- [ ] P14 — new-period detection
- [ ] P44 — deterministic JSON output
- [ ] P45 — single run timestamp
- [ ] P27 — Wayback-archive all source URLs
- [ ] P32 — `sources.json` consolidated registry
- [ ] P34 — release-calendar config
- [ ] P36 — FAIN watcher with loud alert
- [ ] P35 — refresh outcome notifications
- [ ] P37 — daily cheap checks / weekly full refresh split
- [ ] P39 — `status.json`
- [ ] P4 — review mode per decision #5
- [ ] P5 — post-deploy health check

**Exit:** one full scheduled run executes on GitHub end-to-end (allowed to no-op);
a seeded schema violation fails the run; FAIN watcher confirmed querying.

## Wave 4 — the page becomes a story (~2–3 sessions)

Goal: storytelling spine + the design items that edit the same components.
This is the biggest single wave; land it in the file-cluster order below.

Masthead / opening (`index.html`, `styles.css`, `intro.js`):
- [ ] S1 — dek poses the stake *[sign-off]*
- [ ] S2 — five-numbers strip
- [ ] S5 — act-structure TOC
- [ ] S7 — expectations line (plates · minutes · refreshed)
- [ ] S4 — intro ends by scrubbing to today
- [ ] D37 — text-wrap balance/pretty
- [ ] D48 — skip link

Time anchor (`main.js`, `chart.js`, `data.js`):
- [ ] S3 — default year = today (per decision #7)
- [ ] S16 — TODAY tick on scrubber
- [ ] S17 — TODAY hairline on Fig 02
- [ ] S18 — phase bands under scrubber
- [ ] S19 — era readout beside year
- [ ] S20 — ledger TODAY divider
- [ ] D50 — calm aria-live during play

Instrument interaction (`map.js`, `main.js`, `index.html`):
- [ ] D18 — scrubber moves up under the map
- [ ] D13 — auto-select Clay
- [ ] D14 — node hover state
- [ ] D15 — node selected state
- [ ] D16 — node label paper halo

Citation plumbing (`main.js`, `styles.css`):
- [ ] D9 — cites land on `#src-N`
- [ ] D10 — `:target` source highlight
- [ ] D11 — scroll-margin
- [ ] D12 — superscript line-height fix

Narrative frame (section copy + plate chrome):
- [ ] S8 — PLAN / DERIVED / MEASURED stamps
- [ ] S10 — Part Two pivot at s06
- [ ] S11 — finding-headlines *[sign-off]*
- [ ] S12 — takeaway line per plate (first batch: 06a, 07, 10a) *[sign-off]*
- [ ] S13 — section 08 leads with the absence
- [ ] S9 — forward links between sections
- [ ] S14 — "what the record doesn't say" block

Ending:
- [ ] S48 — synthesis plate
- [ ] S49 — "what to watch next"

**Exit:** full battery + a top-to-bottom read-through against the storytelling doc;
all sign-off wordings approved; fresh deploy.

## Wave 5 — annotation & engagement (~2 sessions)

Prerequisite first:
- [ ] F37 — shared rAF conductor (before any new motion below)

Figure annotation (`chart.js`, `sankey.js`, `live.js`, `map.js`):
- [ ] S23 — plan-vs-measured overlay on Fig 02 *[sign-off]*
- [ ] D23 — Fig 02 end-labels replace legend
- [ ] D24≡S24 — hover-scrub on Fig 02 (one implementation) *[sign-off on annotation]*
- [ ] S25 — Fig 03 8× takeaway
- [ ] D25 — Fig 03 small-flow inset
- [ ] D26 — Fig 03 fedrd identity
- [ ] D27 — Fig 04 program spine emphasis
- [ ] S26 — Fig 07 Monroe payoff
- [ ] S27 — Fig 10a series-high stamp *[sign-off]*
- [ ] S28 — Fig 11 stakes arithmetic
- [ ] S30 — Fig 06c trend takeaway *[sign-off]*
- [ ] S29 — wafer-dial legend
- [ ] D17 — map scale bar + north arrow
- [ ] D20 — milestone tick tooltips
- [ ] D21 — ledger affordances
- [ ] D22 — site panel ↔ Clay linkage
- [ ] D28 — Fig 05 grid balance
- [ ] D29 — spec-cell numerals
- [ ] D30 — QCEW suppressed compression
- [ ] D31 — QCEW zero-state
- [ ] D32 — Fig 06c totals + width
- [ ] D33 — Fig 07 self-commute bar
- [ ] D34 — Fig 09 data-edge tick
- [ ] D36 — Fig 11 legend row

Humanizing & links:
- [ ] S31 — internal MW/MGD ratios
- [ ] S32 — wage delta column
- [ ] S33 — $100B internal anchor *[sign-off]*
- [ ] S34 — particles = commuters legend
- [ ] S35 — 50,000 decomposition chips
- [ ] S37 — instrument ↔ section cross-links
- [ ] S38 — sankey ribbon detail
- [ ] S39 — node-plate go-deeper links
- [ ] S42 — disclosure rename + row counts
- [ ] S43 — full hash state (`view`/`particles`)
- [ ] S6 — first-visit scrubber nudge

CSS polish batch:
- [ ] D38 — eyebrow rules · D39 — ::selection · D40 — thin scrollbars ·
      D41 — tabular numerals · D44 — registration marks

**Exit:** full battery + perf trace (instrument touched heavily); deploy.

## Wave 6 — reach pass 1 + live-data storytelling (~1–2 sessions)

Pipeline-dependent frontend now unblocks:
- [ ] S44 — "since last refresh" deltas (consumes P9)
- [ ] S45 — relative data-age chips
- [ ] S46 — next-release calendar surface (consumes P34)
- [ ] S47 — one voice for empty states
- [ ] R15≡P28 — archived links rendered in Sources

Citability floor:
- [ ] R2 — license applied (per decision #2)
- [ ] R3 — repo public
- [ ] R4 — independence statement
- [ ] R5 — contact + corrections channel
- [ ] R7 — methods page
- [ ] R8 — editorial-decisions page *(per decision #4)*
- [ ] R9 — corrections policy + log
- [ ] R10 — data dictionary
- [ ] R11 — recommended-citation block
- [ ] R12 — changelog page (consumes P10)
- [ ] R13 — limitations page (reuses S14 content)
- [ ] R14 — robots.txt + humans.txt
- [ ] R16 — sitemap + JSON-LD Article/Dataset
- [ ] R18 — og:updated_time
- [ ] R20 — stable-anchor documentation
- [ ] R21 — build rev in colophon

Shareable surfaces & data out:
- [ ] R22 — `/f/NN` share URLs
- [ ] R23 — per-section OG images (extends `build-og.mjs`)
- [ ] S50≡R24 — copy-link per plate (one implementation)
- [ ] R25 — poster footer URL check
- [ ] F48≡R26 — print-PDF harness + linked brief (one implementation)
- [ ] P49 — API terms ledger (gates next three)
- [ ] R31 — CSV per plate
- [ ] R32 — data-contract doc
- [ ] R33 — `all.zip`
- [ ] R34 — license field in provenance

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

**Wave 0 progress (2026-06-10):**
- [x] P50≡R1 — colophon (`index.html`) + poster (`poster.js:221`) placeholders
      filled with Alex · Alex@ozarkintelligence.com; git identity set locally
- [x] F7 — baseline recorded: main JS **177,975 B** · CSS **11,923 B** · poster
      chunk **8,680 B** (dist/assets, build of a876040); qa shots archived in
      `qa/shots/` + `qa/shots/sections/` at 375/768/1280 × y2022/26/30/45;
      Lighthouse re-run lands with Wave 1's LHCI
- [x] R38 — audience map: priority order TBD (Q17), candidates listed in
      `reach-improvements.md` #38
- [ ] P1 — GitHub repo (blocked: account walk-through with Alex; private per Q3)
- Plan library + Wave 0 changes committed locally; verification of the colophon
  render rides Wave 2's battery (text-only change)
