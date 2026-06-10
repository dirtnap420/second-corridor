# Performance improvement plan — "Instrument-grade speed" — 50 items

Drafted 2026-06-10. Companion to the design, data-storytelling, pipeline, and reach
plans.

**Honest starting point:** this site is already light — 178KB main JS + 12KB CSS
(`dist/assets/`), `poster.js` correctly code-split (8.7KB, dynamic import), all nine
data JSONs total ~46KB, the geo file is just 13.5KB, fonts are subset (~14.5KB each),
and `vercel.json` already ships immutable caching for assets/fonts. The risk isn't
today's weight; it's that the design and storytelling plans add motion, overlays, and
interactivity with **no budget protecting the floor**. This plan sets the budget,
fixes the real runtime findings below, and gates regressions.

Real findings from this review:
- The play loop's frame delta is unclamped (`src/main.js:140-146`) — backgrounding
  the tab mid-play and returning makes the year leap (rAF pauses, `t - lastT` spans
  the whole pause). The map's engine clamps (`map.js:418`); the orchestrator doesn't.
- `index.html` preloads Archivo **700** + Plex Mono regular, but `h1`/`h2` render in
  Archivo **900** (`styles.css:190-196`) — the masthead, the largest text on the
  first screen, swaps in late.
- `boot()` is fully serial (`main.js:481-493`): nine data fetches complete before the
  geo fetch even starts, and the map mounts after both.
- `.map-stage` has no reserved height — the SVG appends after the geo fetch, shifting
  everything below it (CLS on the page's centerpiece).

Priority key: **P1** = fixes a measured/observable problem or sets a guardrail ·
**P2** = real wins · **P3** = micro/optional.

---

## A. Measure first, then gate (1–8)

1. **P1 — Define the budget in one file.** `perf-budget.json`: main JS ≤ 180KB raw,
   CSS ≤ 16KB, total font bytes ≤ 90KB, LCP ≤ 1.8s (mid-tier mobile), CLS ≤ 0.02,
   no long task > 200ms during play. Numbers chosen to be *passable today* — the
   point is catching drift.

2. **P1 — Bundle-size gate.** A `scripts/lint-size.mjs` in the build (same pattern
   as `lint-design.mjs`, which proves the repo likes gates): fail if `dist/assets`
   exceeds the budget. Five minutes to write, permanent insurance.

3. **P1 — Lighthouse CI.** The repo ran Lighthouse once in Phase 5; make it a
   repeatable gate (`lhci` against `vite preview`, mobile emulation, budget
   asserted). Runs in the pipeline plan's CI (#3).

4. **P2 — `qa/perf.mjs`: scripted runtime trace.** Playwright + CDP tracing through
   the real scenario: intro plays → full 2022→2045 playback → map↔section morph →
   flows toggle. Assert: no frame > 50ms during playback, no long task > 200ms.
   This is the only test that protects the *feel* of the instrument.

5. **P2 — Throttled profile.** Run item 4 at 6× CPU throttle / 375px viewport —
   the corridor's local audience skews mobile.

6. **P3 — `performance.mark` the boot stages.** `initLive`, geo fetch, map mount,
   chart mounts, intro start (`main.js boot`) — so any future "it feels slower" has
   numbers in the Performance panel.

7. **P3 — Record a baseline table.** Before/after metrics for each pass committed
   to this doc — improvements that aren't recorded get re-litigated.

8. **P3 — No third-party RUM.** `qa/offline.mjs` *proves* zero external requests —
   that guarantee is worth more than field data. If field vitals are ever wanted,
   Vercel's first-party analytics is the only candidate (it reports same-origin) and
   `offline.mjs` must exempt it explicitly. Decision documented, default: none.

## B. Bundle & assets (9–18)

9. **P2 — Scope the d3 imports.** `chart.js:5`, `map.js:9`, `poster.js:6` import
   from the `d3` meta-package. Vite tree-shakes much of it, but importing from
   `d3-geo`/`d3-scale`/`d3-shape`/`d3-array` directly removes the bundler's guesswork.
   Measure the delta with item 2's report; expected modest (10–30KB), but it also
   drops ~25 unused d3 packages from `node_modules` and install time.

10. **P1 — Preload the fonts the first screen actually uses.** Add Archivo 900 to
    the preload list (the `h1` is the LCP candidate); audit whether Archivo 500 is
    used anywhere (only SVG `font-weight:500` references Plex Mono 500 — if Archivo
    500 has no usage, delete the file and its `@font-face`).

11. **P2 — Drop unused font weights after the audit.** Six woff2 files ship; every
    one not used by a rendered style is 14.5KB of pure waste. Candidates: Archivo
    regular (body uses it — keep), 500 (verify), 700 (verify against 900 usage).

12. **P3 — `font-display: optional` consideration for non-first-screen weights.**
    Keep `swap` for body/headline; `optional` for weights that only style deep-page
    SVG labels avoids late-load reflow. Test before committing — mono labels
    flashing fallback would be worse.

13. **P2 — Verify the poster chunk never loads eagerly.** It's correctly dynamic
    (`main.js:600-603`); add a CI assertion (no `poster` chunk in the initial
    HTML's modulepreload list) so a future refactor doesn't accidentally hoist it.

14. **P3 — Prefetch the poster chunk on intent.** `mouseenter`/`focus` on
    `#export-poster` → `import()` warm-up; the click becomes instant without
    touching the initial load.

15. **P3 — Build target audit.** Set `build.target: 'es2022'` (or `baseline-widely-
    available`) explicitly in `vite.config.js` — the default is conservative;
    shipping fewer transpiled helpers trims a few KB and matches the browsers this
    site supports.

16. **P3 — CSS audit.** 12KB is healthy; keep it that way by running the design
    plan's additions through the same size gate. No action beyond the gate.

17. **P3 — `og.png` weight check.** 1200×630 social image — ensure it's
    optimized (sharp is already a dependency; `build-og.mjs` can emit at quality 80,
    typically < 100KB). It loads only for crawlers, but crawlers time out too.

18. **P3 — SVG favicon is final.** `favicon.svg` is already the right call; add
    a 180px PNG `apple-touch-icon` only if reach-plan testing shows iOS share
    sheets need it (they do) — tiny, cached forever.

## C. Startup path (19–26)

19. **P1 — Parallelize boot.** `main.js:481-493` awaits `initLive()` (nine fetches)
    before *starting* the geo fetch, and mounts the map after both. Restructure:
    kick off geo fetch + `initLive()` together (`Promise.all`); mount map, chart,
    sankeys as soon as their own inputs exist. The ordering constraint (live
    sections must register sources before `bindCiteMarks`/`buildSources`) gates only
    the *citation* steps — not the geometry.

20. **P1 — Reserve the map's space.** `.map-stage` gets `aspect-ratio: 1100/560`
    (matching the H = W×0.55 formula in `map.js:20`, with its clamps mirrored in
    media queries) so the plate doesn't collapse-then-expand when the SVG mounts.
    Kills the page's main CLS.

21. **P2 — Preload the geo file.** `<link rel="preload" as="fetch" crossorigin
    href="/data/ny-geo.json">` in `index.html` — it's 13.5KB and on the critical
    path to the centerpiece; let it ride the HTML's connection immediately.

22. **P2 — Keep the data fetches eager — and document why.** All nine JSONs total
    ~46KB; lazy-loading them would break the source-numbering order
    (`registerSources` assigns footnote numbers in load order) for a saving that
    rounds to nothing. Record the decision in code comment + this doc so nobody
    "optimizes" it into a citation bug.

23. **P3 — Inline the tiny boot-blocking JSONs?** No — same reasoning as 22; the
    HTML should stay clean and cacheable. Decision recorded.

24. **P2 — Intro cost accounting.** The plotter intro runs ≤2.5s of dasharray
    animation over the already-rendered DOM (`intro.js`) — good design. Add it to
    the perf trace (item 4) and assert it never delays interactivity (controls are
    disabled during it — verify the disable window can't exceed 2.5s even if a
    `getTotalLength` is slow on low-end devices; add a hard 3s failsafe re-enable).

25. **P3 — `requestIdleCallback` for non-critical builds.** `buildChartNumbers` and
    the three `details.numbers` table builders render content that's closed by
    default — defer them to idle (with a fallback) so they never compete with first
    paint.

26. **P3 — Hash-state fast path.** A `#y=2030` deep link currently boots at 2022
    state then sets the year (one extra full-surface update). Read the hash before
    the first `setYear` (it already does — `main.js:596-597` — verify no double
    notify) and confirm with the marks from item 6.

## D. Runtime & animation (27–38)

27. **P1 — Clamp the play-loop delta.** `stepPlay` (`main.js:140-146`):
    `const dt = Math.min(0.1, (t - lastT) / 1000)` — matches the particle engine's
    clamp and stops the year teleporting after a backgrounded tab. Two-line fix.

28. **P2 — Gate offscreen surfaces during playback.** Every `onYear` subscriber
    updates on every frame of play — including the Fig 02 cursor and the site panel
    when they're three screens away. Give `responsiveMount` consumers an
    IntersectionObserver gate (the map already self-gates its engine,
    `map.js:518-525`): offscreen → record `pendingYear`, apply on re-entry.
    `responsive.js` already has the `pendingYear` pattern; extend it.

29. **P2 — Adaptive particle pool.** Track a rolling frame-time average in the
    engine; if it exceeds ~25ms for 2s, reduce `targetCount` 30% and stop spawning
    until it recovers. Low-end phones keep the atmosphere without the jank.

30. **P3 — Scale DPR with device signals.** The canvas caps DPR at 2 (`map.js:285`);
    drop to 1.5 when `navigator.deviceMemory ≤ 4` — particles are streaks, not
    text; nobody will see the difference on a low-RAM phone.

31. **P2 — Cheapen the morph loop.** During the 650ms map↔section morph,
    `traceFill.getTotalLength()` runs per frame (`map.js:577`) — a forced geometry
    computation. Precompute the start/end lengths once and lerp between them; the
    dasharray during a morph doesn't need geometric truth, just continuity.

32. **P3 — Pre-scale the canvas context.** `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`
    once per resize instead of multiplying every coordinate by `dpr` in `drawStreak`
    (`map.js:389-399`) — fewer multiplies per particle per frame, and simpler code.

33. **P2 — `content-visibility: auto` on below-fold sections.** Sections 06–11 +
    sources with `contain-intrinsic-size` estimates. The page renders ~14 plates of
    SVG up front; this defers layout/paint of everything below the fold. Test
    carefully against: anchor jumps from cites (item: design #11's scroll-margin),
    the IntersectionObservers, and print (override to `visible` in `@media print`).

34. **P3 — `contain: layout paint` on `.plate`.** Plates are visually self-contained
    boxes; telling the engine so isolates their layout invalidations (the ledger's
    per-year class toggles currently can invalidate more than they need to).

35. **P3 — Batch the ledger's class writes.** `buildLedger`'s `onYear` walks all
    rows twice per year change (`main.js:228-252`). Compute the single
    current index, touch only rows whose state changed — same pattern the wafer
    dial already uses (`main.js:369-387`, explicitly "touch only the dice whose
    state changed — cheap at 60fps").

36. **P3 — Audit `scrollTo` smooth during glide.** Already handled (`behavior:
    motion.reduced || state.gliding ? 'auto' : 'smooth'`, `main.js:247-250`) — add
    a comment and a regression test; this is the kind of correct subtlety that gets
    refactored away.

37. **P2 — One rAF conductor.** Play (`main.js`), glide (`main.js`), morph
    (`map.js`), and particles (`map.js`) each run their own rAF. Fine today; the
    storytelling plan adds draw-on-scroll and count-ups. Before that lands, add a tiny
    shared ticker (subscribe/unsubscribe) so concurrent animations coalesce into
    one callback per frame and pause as a group when hidden.

38. **P3 — Reduced-motion is already exemplary — keep it tested.** Global tween
    kill (`styles.css:119-127`), discrete play steps, static flows. Add a
    `prefers-reduced-motion` pass to `qa/perf.mjs` asserting zero rAF loops run.

## E. Delivery (39–44)

39. **P2 — `stale-while-revalidate` on data.** `vercel.json` serves `/data/*` at
    `max-age=3600`; change to `max-age=3600, stale-while-revalidate=86400` — repeat
    visitors render instantly from cache while the CDN revalidates behind them.
    (Deploys already bust everything; this only affects intra-day repeat visits.)

40. **P3 — Explicit HTML cache policy.** Add `/(.*)` HTML header
    `Cache-Control: public, max-age=0, must-revalidate` — Vercel's default is
    close to this; making it explicit prevents surprise when config changes.

41. **P3 — Verify Brotli end-to-end.** Vercel compresses automatically; assert it
    in CI (`curl -H 'Accept-Encoding: br'` against prod, check `content-encoding`)
    so a config regression can't silently ship gzip-only or raw.

42. **P3 — Trim the preload list to exactly what's used.** After items 10–11, the
    preload set should be: the ≤3 first-screen font files + geo JSON. Over-preloading
    competes with the critical path — the audit is the deliverable.

43. **P3 — 404 hygiene.** A missing data file currently fails soft
    (`live.js fetchJson` → plate stays hidden). Good — but Vercel serves the SPA
    HTML for unknown paths under some configs; assert `/data/missing.json` returns
    a real 404, not 200-with-HTML (which would break `r.ok` checks elsewhere).

44. **P3 — Security headers ride along.** `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP (`default-src
    'self'` — the offline proof shows the site can satisfy it) in `vercel.json`.
    Not performance, but the same file, the same PR, and a trust signal the reach
    plan wants anyway.

## F. Long-page rendering & QA (45–50)

45. **P2 — Decompose `qa/screenshot.mjs` timings.** The QA harness waits a flat
    400ms; record actual settle times per section while it runs — free
    instrumentation of real render cost per plate, tracked over time in CI.

46. **P3 — Memory pass.** `responsiveMount` correctly destroys instances on
    re-render (`responsive.js:13`) and the map's `destroy()` disconnects its
    observers (`map.js:643-649`) — verified clean. Add a Playwright heap-snapshot
    check (resize loop ×20 → heap stable) so it stays true.

47. **P3 — Resize-storm behavior.** The 150ms debounce (`responsive.js:21`) +
    full re-render per surface is the design; assert a continuous window drag
    triggers ≤ 2 rebuilds per surface and the year state survives (it does, via
    `pendingYear` — test it).

48. **P2 — Print path cost.** `@media print` hides canvas/controls but renders all
    ledger rows and every SVG at full size. Run a headless `page.pdf()` in QA —
    print is a first-class artifact here (the brief), so its render path deserves a
    smoke test + timing.

49. **P3 — Battery/visibility audit.** `visibilitychange` stops the particle engine
    (`map.js:513-517`); after item 27, assert via trace that a hidden tab schedules
    zero rAF callbacks and zero timers besides the play fallback — the site should
    cost nothing in a background tab.

50. **P3 — Annual device-floor review.** Define the floor explicitly (e.g., 2019
    mid-tier Android, 4× CPU slowdown) in this doc; re-run items 4–5 against it
    after each major pass from the other plans.

---

## Suggested sequencing

- **Pass 1 — guardrails + the four findings (P1):** 1, 2, 3, 10, 19, 20, 27 —
  budget, gates, font preload, parallel boot, reserved map space, clamped play loop.
- **Pass 2 — runtime wins (P2):** 4, 5, 9, 11, 13, 21, 24, 28, 29, 31, 33, 37, 39,
  45, 48.
- **Pass 3 — micro & hygiene (P3):** the rest, opportunistically alongside other
  plans' PRs.

Interactions: do item 37 (rAF conductor) **before** storytelling #40/41 (draw-on-
scroll, count-ups) land; item 33 (`content-visibility`) must be tested against
design #11 (scroll-margin anchors); item 8's decision gates reach #47 (analytics).
