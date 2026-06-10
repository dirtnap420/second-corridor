# Data storytelling improvement plan — 50 items

Drafted 2026-06-10, companion to `docs/design-improvements.md` (visual/design fixes).
This plan is about **attention**: hooking the reader in the first screen, holding them
through eleven plates, and giving them a reason to come back. Grounded in the rendered
site, `src/data.js` (milestones, anchors), and the live data in `public/data/`.

**Guardrail that governs every item:** this site's identity is *every number cited,
estimates labeled, no causal claims*. Nothing below may editorialize past the record.
Where an item proposes a "takeaway" line, the takeaway must be arithmetic on already-
cited figures or a direct restatement of the record — and carries its cite marks like
any other figure.

Priority key: **P1** = core narrative gap · **P2** = strong engagement win ·
**P3** = enhancement.

---

## A. The hook — masthead & first screen (1–7)

1. **P1 — Pose the central question in the dek.** The masthead currently describes
   ("Tracking New York's semiconductor buildout…"). Add the tension the whole piece
   hangs on: *"Up to $100B is promised between Buffalo and Albany. This instrument
   tracks what the public record shows actually arriving."* Description tells; a
   question or stake pulls. (`index.html:54-57`)

2. **P1 — "The corridor in five numbers" strip.** Under the masthead rule, five mono
   stat chips, each deep-linking to its section: `$100B PRIVATE [1]` · `$12.5B PUBLIC
   [2][5][9]` · `9,000 DIRECT JOBS [1]` · `~50,000 TOTAL [14]` · `232 MI`. Inverted
   pyramid: a scanner gets the whole story in five seconds; each chip is a door.

3. **P1 — Land the reader in the present.** The timeline boots at 2022 (`main.js:597`),
   so the instrument opens on four-year-old news. Default to today's year (2026) when
   no `#y=` deep link is present — history sits behind the cursor, the promise ahead
   of it. (Pairs with items 16–20.)

4. **P2 — Make the intro tell "the story so far."** The plotter opening draws
   geography, then stops. Let the final beat scrub 2022 → today (trace fills, nodes
   ping, ledger advances) so the opening animation ends where the reader begins:
   the present. (`src/intro.js`, reduced-motion exempt as now.)

5. **P2 — Act-structure TOC after the masthead.** Three labeled acts with one-line
   synopses: *"I. THE PLAN (01–05) — what was promised, drawn from the record · II.
   THE MEASURED REALITY (06–11) — what BLS, Census, and USAspending show today · III.
   THE RECORD — every source."* This is the classic author-guided-then-reader-free
   (martini glass) shape the site already has — make it visible upfront.

6. **P3 — First-visit scrubber nudge.** After the intro completes, pulse the scrubber
   handle once with a `DRAG` microlabel (localStorage one-shot, reduced-motion safe).
   The single most important interaction on the page currently has no invitation
   beyond body copy.

7. **P3 — Set expectations in the masthead sub-line.** Replace the vague
   `Sources [1]+ below` slot with `11 PLATES · ~9 MIN · REFRESHED 2026-06-10`.
   Readers commit when they can size the commitment; freshness is the tracker's
   promise.

## B. Narrative architecture across sections (8–15)

8. **P1 — Stamp every plate PLAN / DERIVED / MEASURED.** A small mono chip in each
   plate's top caption declaring its epistemic status: 01 `RECORD`, 02 `DERIVED`,
   03–04 `RECORD`, 05 `CONTEXT`, 06–11 `MEASURED`. The site's core tension —
   promise vs measurement — becomes a persistent visual thread the reader tracks
   from plate to plate, and it formalizes the honesty already in the captions.

9. **P2 — Connective tissue between sections.** End each section with a one-line mono
   forward link: after 04, *"The lattice exists on paper. 06 measures who is actually
   moving through it →"*; after 05, *"That was the starting inventory. What follows is
   the meter →"*. Cliffhanger pacing; eleven sections currently sit side by side with
   no current pulling the reader downstream.

10. **P1 — Sharpen the Part Two pivot at s06.** The plan→measured hinge is the
    dramatic center of the piece and currently reads as just another section. Give it
    an interstitial treatment: full-width rule, `PART TWO — THE MEASURED REALITY`
    eyebrow, and one paragraph of method contrast (*"Sections 01–05 drew the promise
    from announcements and agreements. From here, every number is a measurement, and
    some of them are missing."*).

11. **P2 — Let headlines carry findings where the record supports them.** Several h2s
    are labels, not findings. Candidates that stay strictly factual:
    s06 *"The measured baseline."* → *"Semiconductor employment today: hundreds, not
    thousands."* (QCEW: Onondaga 670, Monroe 298); s08 *"Announced, obligated,
    outlaid."* → *"Announced, obligated, outlaid — and not yet recorded."* Findings in
    headlines are the highest-leverage annotation in data journalism; keep cites in
    the body.

12. **P2 — One takeaway line per plate.** A single declarative mono sentence at the
    top of each plate body, cited: Fig 06a → `ONLY MONROE AND ONONDAGA PUBLISH
    SEMICONDUCTOR EMPLOYMENT; THE REST IS SUPPRESSED OR ZERO.` Fig 10a → `ONONDAGA
    PERMITTED 1,701 UNITS IN 2025 — THE HIGHEST IN THE SERIES.` Readers skim plates;
    the takeaway is what they keep. (Distinct from the methodological notes already
    in bottom captions — those say *how*, this says *what*.)

13. **P1 — Lead section 08 with the absence.** The most arresting fact on the page is
    buried in a plate note: Commerce has published **no award record** for the Micron
    agreements. Rewrite the section body-copy to open with it: *"The most consequential
    number in this ledger is the one that is not there."* The plate then proves it.
    The 'absence as datapoint' framing already exists (`live.js` spending panel) —
    promote it from caption to lede.

14. **P2 — "What the record doesn't say yet" block.** Before Sources, consolidate the
    honesty scattered across captions (ramp-down illustrative · sankey widths
    illustrative · no full-buildout MW figure in any NYISO document · FAIN absent ·
    QCEW ≠ Micron headcount) into one numbered list. Curiosity + credibility in one
    move, and it tees up items 46/49 (reasons to return).

15. **P2 — A 60-second guided tour.** A `TOUR` button beside Play: five beats, each a
    scroll-target + instrument state + two lines of caption (map@2022 → play to today
    → Fig 02@2045 → Fig 08's absent record → Fig 06a baseline), then release into free
    exploration. Author-driven first pass, reader-driven second — the canonical
    structure for keeping both skimmers and explorers.

## C. Time — the "you are here" problem (16–22)

The single biggest storytelling gap: the page never marks **today** (2026-06) anywhere
on a 2022–2045 instrument. The plan/measured divide is temporal, and the reader is
never placed on the timeline.

16. **P1 — TODAY tick on the master scrubber.** Copper-outlined tick + `TODAY` mono
    label at 2026.4 on the scrubber track (`main.js buildTicks`). Everything left of
    it happened; everything right of it is promise.

17. **P1 — TODAY hairline on Fig 02.** A labeled vertical at 2026.4 in `chart.js` —
    it visually splits the derived series into "history behind us" and "interpolation
    ahead," which is exactly the caption's claim (*not a forecast*) made visible.

18. **P2 — Phase bands under the scrubber.** Labeled spans from the cited milestones:
    `SITEWORK →2026` · `CONSTRUCTION 2026–41 [12]` · `OPERATIONS 2030– [13]`. The
    timeline gets chapters; scrubbing gets narrative texture.

19. **P2 — Era readout beside the year.** Under the big `2030` add the operative
    milestone state: `FAB 1 OPERATIONS [13]` (latest milestone ≤ year, from
    `MILESTONES`). The number becomes a story state.

20. **P2 — TODAY divider in the ledger.** A rule between 2025 and 2026 rows — above
    it the record, below it the schedule. One hairline reframes the whole list as
    "done vs promised."

21. **P3 — Milestone toast during play.** When play crosses a milestone year, flash
    its label next to the year readout for ~1.2s (the map already pings nodes —
    `node-ping` — but the *text* of the beat never surfaces during playback).

22. **P3 — Relative time on future milestones.** Muted suffixes in the ledger:
    `Fab 3 — in 7 yrs`, `Full operations — in 19 yrs`, computed against today.
    Future-dated promises become concrete distances.

## D. Annotation — every figure states its finding (23–30)

23. **P2 — Plan-vs-measured overlay on Fig 02.** Draw Onondaga's measured QCEW series
    (from Fig 06a) as an ink line on the jobs panel up to today, labeled `COUNTY
    NAICS-3344, MEASURED [n]`, with the existing definitional caveat carried over.
    This is the thesis image of the entire piece — promise and meter in one frame —
    and both series already exist on the page, three screens apart.

24. **P2 — Annotate the Micron strip's bump in Fig 09.** The Onondaga ramp shows a
    visible rise around months 24–30. If a cited event dates it (construction
    staffing per the milestone record), flag it with a dated callout; annotation is
    what turns a squiggle into an event. If no citation matches, no annotation —
    per the guardrail.

25. **P3 — Fig 03 arithmetic takeaway.** `MICRON'S PRIVATE CAPITAL IS 8× ALL PUBLIC
    MONEY ON THIS PLATE COMBINED` ($100B vs $5.5B + $6.165B + $0.825B = $12.49B) —
    pure arithmetic on cited values, and it's the sentence everyone will quote.

26. **P3 — Pay off the Monroe setup in Fig 07.** The body copy promises *"Monroe —
    Rochester — is already in it"*; the plate buries the payoff in a footnote.
    Promote `MONROE RANKS #6 · 6,196 COMMUTERS [33]` to the plate takeaway line and
    bold the Monroe row. Setup → payoff is basic narrative hygiene.

27. **P3 — Date-stamp the Fig 10a series high.** `2025: 1,701 UNITS — SERIES HIGH`
    on the Onondaga panel. State the adjacency, never the cause (the bottom caption
    already disclaims causality — keep it).

28. **P2 — Fig 11 stakes arithmetic.** Two derived lines, both divisions of cited
    figures: `FULL-BUILDOUT WATER DEMAND = 77% OF CURRENT PERMITTED WITHDRAWAL`
    (48 / 62.5 MGD) and `FABS 1–2 = 63% OF ZONE C'S MEASURED AVERAGE LOAD`
    (1,056 / 1,685 MW). Two bars become a stake the region can feel.

29. **P2 — Explain the wafer-dial metaphor.** The die-map dial is the site's best
    visual idea and is never explained. One mono line under it: `EACH DIE = 50 JOBS ·
    EDGE DICE NEVER FILL — LIKE REAL WAFERS, THE EDGE DOESN'T YIELD.` A metaphor the
    reader is taught once becomes a hook they remember.

30. **P3 — State the Fig 06c trend.** Completions peaked in 2020 and have declined
    since — into the buildout. Takeaway: `PIPELINE COMPLETIONS: FLAT SINCE 2018,
    DOWN FROM THE 2020 PEAK` with the existing ~2-year-lag caveat alongside. That
    tension (demand rising, supply flat) is the talent story; the chart currently
    leaves the reader to derive it.

## E. Humanizing numbers — comparison & translation (31–36)

31. **P2 — Translate MW/MGD using internal comparisons.** Prefer ratios to imported
    equivalences (no new sources needed): Fig 11 right-column subtexts like
    `= 17% OF ZONE C MEASURED PEAK` (480/2,764). Numbers land when they're fractions
    of something the plate already showed.

32. **P2 — Wage deltas, not absolutes, in Fig 06b.** Add a `Δ vs national` column:
    `+$4,640` (Syracuse EE techs), `−$9,560` (Syracuse EEs), `−$910` (Rochester
    techs). Three columns of absolutes make the reader do arithmetic; the delta *is*
    the story (technicians paid above national, engineers below).

33. **P3 — Scale anchor for $100B in s03 copy.** Internal version (no new source):
    *"$100B is eighteen times the state's entire Green CHIPS package."* If the author
    wants an external anchor (state capital budget, Erie Canal in today's dollars),
    it needs a Phase-0-grade citation first.

34. **P3 — Make flow particles explicitly people.** The flows legend reads
    `1 PARTICLE = N JOBS` (`main.js:517`). Reword to `EACH STREAK ≈ N COMMUTERS ·
    LODES 2023` — same number, human noun. The ambient/flows toggle then reads as
    "atmosphere vs people."

35. **P3 — Decompose 50,000 inline in s02 copy.** Chips in the body text:
    `9,000 DIRECT [1] + ~41,000 SUPPLY & INDUCED [14] = THE CITED ~50,000`. The
    stacked area's arithmetic, stated where the reader first meets the number.

36. **P2 — "Find your county" personalization.** A small select on Fig 07 and Fig 10
    that highlights that county's row/panel (pure highlight, no data change). For a
    regional audience, self-relevance is the strongest attention device that exists;
    the LODES and permits tables already carry every corridor county.

## F. Exploration depth — engagement loops (37–43)

37. **P2 — Cross-link the instrument to its chapters.** Dial labels link to the
    sections that explain them (investment → s02/s03; permanent jobs → s02); Fig 07's
    caption links back up: *"see these commutes animated — Flows view ↑"* (sets
    `uiState.particles='flows'`, scrolls to the instrument). Loops between summary
    and detail are what keep a reader inside the piece.

38. **P3 — Hover/tap detail on talent ribbons.** Fig 04 ribbons reveal the cited
    program facts in a plate-styled detail line (RIT: 48 required co-op weeks [17];
    OCC: $15M cleanroom simulation lab [25]). Progressive disclosure: the curious get
    depth, the skimmer stays uncluttered.

39. **P3 — "Go deeper" links on the node plate.** Each node's data plate ends with
    its related figures: Clay → 02 · 08 · 11; RIT → 04 · 06c; Albany → 03 · 08. The
    map becomes a hub, not a dead end.

40. **P3 — Draw-on-scroll for Fig 02.** Pen-draw the series once when the plate first
    enters the viewport (IntersectionObserver; reduced-motion renders static). Motion
    as chapter punctuation, consistent with the plotter identity — and a reason to
    keep scrolling.

41. **P3 — Count-up numerals on Fig 05.** Spec-cell values count up over ~300ms on
    first reveal (tabular-nums prevents jitter; reduced-motion: instant). Cheap
    salience for the context plate that currently reads as a static table.

42. **P3 — Rename and size the disclosure.** `View the numbers` → `OPEN THE DATA
    TABLE · 24 ROWS`. Naming the content (and its size) measurably increases
    disclosure open rates; nine plates carry this affordance.

43. **P2 — Hash-encode full instrument state.** Extend `#y=2030` to
    `#y=2030&view=section&p=flows` (`main.js` readHash/setYear). Deep links are how
    data stories travel; right now a shared link loses the view the sharer was
    looking at.

## G. Live-data storytelling — the tracker's edge (44–47)

44. **P1 — "Since last refresh" deltas.** Persist the prior snapshot in the fetch
    scripts (`scripts/fetch-*.mjs` already write JSON; keep a `previous` block) and
    render deltas on the measured plates: `ONONDAGA 670 (+82 SINCE 2025Q3)`. A static
    essay becomes a tracker the moment numbers visibly move.

45. **P3 — Relative data-age chips.** Alongside each vintage: `RETRIEVED 0 DAYS AGO`
    computed at render. Freshness is this site's differentiator — make it felt, not
    archival.

46. **P2 — Publish the next-release calendar.** In the colophon or the s06 intro:
    `NEXT QCEW RELEASE: SEP 2026 · NEXT IPEDS: NOV 2026 · NEXT NYISO GOLD BOOK: APR
    2027`. Appointment viewing for data — the reader knows when returning will show
    something new.

47. **P2 — One voice for empty states.** Standardize the Fig 08 pattern — `THE
    ABSENCE IS THE DATAPOINT` — across every suppressed/unpublished cell (OEWS `not
    published`, QCEW `S`, LODES gaps), each with its one-line *why* (BLS
    confidentiality · survey scope · reporting lag). Absence handled with confidence
    reads as authority; handled inconsistently it reads as gaps.

## H. The ending — synthesis, return, and sharing (48–50)

48. **P1 — Close with a synthesis plate.** The piece currently ends at Sources — an
    appendix, not an ending. After s11, add "The corridor at a glance": five stamped
    verdict lines, each linking back to its plate —
    `PROMISED: $100B / 9,000 JOBS BY 2045 [1]` ·
    `MEASURED: 670 COUNTY SEMICONDUCTOR JOBS TODAY [n]` ·
    `UNRECORDED: $6.165B FEDERAL — NO AWARD RECORD YET [34]` ·
    `WATCHING: PERMITS, COMPLETIONS, ZONE C LOAD`. Endings are what readers quote.

49. **P1 — "What to watch next."** Beneath the synthesis: the next 2–3 dated
    milestones paired with the series that will confirm them — *"Fab 1 operations,
    2030 → watch Onondaga QCEW"; "3,000–4,000 construction workers, 2027 → watch the
    next refresh."* This converts one-time readers into return visitors, which is the
    entire point of a tracker.

50. **P2 — Per-plate share affordance.** A small `COPY LINK` action in each plate
    caption that copies the section anchor + current instrument state (builds on
    item 43). Every figure becomes independently citable — and inbound links land on
    exactly the chart that earned them.

---

## Suggested sequencing

- **Pass 1 — the spine (P1):** 1, 2, 3, 8, 10, 13, 16, 17, 44, 48, 49 — the hook,
  the present-day anchor, the plan/measured thread, and the ending. These eleven
  change what the piece *is*.
- **Pass 2 — annotation & engagement (P2):** 4, 5, 9, 11, 12, 14, 15, 18, 19, 20,
  23, 24, 28, 29, 31, 32, 36, 37, 43, 46, 47, 50.
- **Pass 3 — texture (P3):** the rest.

Items 23, 24, 27, 30, 33 require the author's sign-off on wording — they sit closest
to the no-causal-claims line. Everything else is arithmetic, restatement, or
structure.

After each pass: `npm run qa` + `node qa/sections.mjs` for visual review, and confirm
every new line of copy carries its cite marks.
