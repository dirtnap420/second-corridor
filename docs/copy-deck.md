# Copy deck — every sign-off sentence, pre-drafted (M5)

Drafted 2026-06-10 for **one async approval pass**. Items 1–5 are the five
flagged for individual sign-off (Q4); items 6–9 are batch-review copy
pre-drafted here so their waves don't stall. Every figure in every draft is
arithmetic on already-cited values or a direct restatement of the record —
cite keys shown in brackets resolve to live footnote numbers at render.

**How to approve:** mark each item `APPROVED`, `APPROVED WITH EDITS (text…)`,
or `REJECTED`. Unmarked items block their wave (S23/S24 → Wave 5; the rest
ship with their wave under batch review unless rejected here).

Data values quoted below were verified against `public/data/*.json` as
retrieved 2026-06-10.

---

## 1 · S23 — Fig 02 plan-vs-measured overlay label *(Wave 5, individual sign-off)*

The measured Onondaga QCEW series (annual, NAICS 3344) drawn as an ink line on
the jobs panel up to today. Label:

> **ONONDAGA NAICS-3344, MEASURED — ANNUAL** [qcew-data]

Carried caveat (already on Fig 06a, repeated under Fig 02):

> QCEW counts all NAICS-3344 employers in the county, not Micron headcount —
> the plan series and this measured line answer different questions.

Scale treatment (floor-line vs inset) is decided in `docs/spikes.md`; this
sign-off covers the wording only.

- [ ] Sign-off: ____________

## 2 · S24 ≡ D24 — Fig 02 hover-scrub readout *(Wave 5, individual sign-off)*

Hovering (or touch-dragging) the chart scrubs a hairline and shows a readout.
Proposed format, values computed live at the hovered year:

> **2030 · INVESTED $20.0B [1][8] · CONSTRUCTION 3,000–4,000 [12] ·
> PERMANENT 563 [1] · SUPPLY & INDUCED 2,563 [14]**

(Interpolated values stay unrounded to the displayed precision of each series;
the plate's existing `INTERPOLATED — NOT A FORECAST` label remains visible
during hover.)

- [ ] Sign-off: ____________

## 3 · S27 — Fig 10a series-high stamp *(Wave 5, individual sign-off)*

On the Onondaga permits panel only:

> **2025: 1,701 UNITS — SERIES HIGH** [bps-data]

Verified: Onondaga series 2015–2025; prior high 1,130 (2016). The bottom
caption's existing no-causal-claim disclaimer stays. Adjacency stated, cause
never.

- [ ] Sign-off: ____________

## 4 · S30 — Fig 06c trend takeaway *(Wave 5, individual sign-off)*

Computed from `ipeds.json` (all four institutions, all award bands):
AY 2017-18 **409** · 2018-19 **401** · 2019-20 **482** · 2020-21 **389** ·
2021-22 **373**.

**Option A (recommended — exact restatement):**

> **CORRIDOR COMPLETIONS: 373 IN AY 2021-22, DOWN FROM THE AY 2019-20 PEAK OF
> 482** [ipeds-data]

**Option B (the plan doc's wording — "flat" is a characterization):**

> **PIPELINE COMPLETIONS: FLAT SINCE 2018, DOWN FROM THE 2020 PEAK** [ipeds-data]

Either ships beside the existing caveat: *IPEDS completions lag roughly two
years* (the latest year predates the fall-2023 OCC/Micron program launches).

- [ ] Sign-off (A / B / edits): ____________

## 5 · S33 — $100B internal scale anchor, s03 body copy *(Wave 5, individual sign-off)*

Internal comparison only — no new source required (100 ÷ 5.5 = 18.2):

> Up to $100B is eighteen times the state's entire $5.5B Green CHIPS
> package. [micron-100b][green-chips-5_5b]

If an external anchor is wanted instead (state capital budget, Erie Canal in
today's dollars), it needs a Phase-0-grade citation first — say the word.

- [ ] Sign-off: ____________

---

## 6 · S11 — finding-headlines, s06 + s08 only *(Wave 4, batch review)*

s06, replacing "The measured baseline.":

> **Semiconductor employment today: hundreds, not thousands.**

(Record: QCEW 2025 annual — Onondaga 670, Monroe 298; cites stay in the body
and on the plate.)

s08, replacing "Announced, obligated, outlaid.":

> **Announced, obligated, outlaid — and not yet recorded.**

## 7 · S10 — the Part Two pivot at s06 *(Wave 4, batch review)*

Interstitial above s06: full-width rule + eyebrow
`PART TWO — THE MEASURED REALITY`, then:

> Sections 01–05 drew the promise from announcements, agreements, and the
> environmental record. From here, every number is a measurement from a public
> statistical agency — and some of the most important ones are missing. The
> absences render too.

## 8 · S13 — section 08 lede *(Wave 4, batch review)*

Replacing the current s08 body copy:

> The most consequential number in this ledger is the one that is not there.
> Commerce has published no award record for the Micron funding agreements —
> fourteen months after signing, the obligation column is the absence the
> plate documents. [chips-direct-8k][usaspending-data]

(The 8-K signing date is 2024-12-09; "fourteen months" must be recomputed at
each refresh or rendered as a computed relative — implementation note for
Wave 4: render the duration from data, never hard-code it.)

## 9 · S48 — synthesis plate verdicts *(Wave 4, batch review)*

"The corridor at a glance" — five stamped lines, each linking to its plate:

> **PROMISED** — UP TO $100B · 9,000 DIRECT JOBS BY 2045
> [micron-100b][micron-9000-direct] → 02
> **COMMITTED** — $5.5B STATE (PERFORMANCE-BASED) · UP TO $6.165B FEDERAL
> [green-chips-5_5b][chips-direct-8k] → 03
> **MEASURED** — 670 SEMICONDUCTOR JOBS IN ONONDAGA COUNTY, 2025
> [qcew-data] → 06
> **UNRECORDED** — NO AWARD RECORD ON USASPENDING FOR THE MICRON AGREEMENTS
> [usaspending-data] → 08
> **WATCHING** — PERMITS (1,701 IN '25) · COMPLETIONS (373 IN AY '21-22) ·
> ZONE C LOAD [bps-data][ipeds-data][nyiso-goldbook] → 10 · 06c · 11

---

## Pre-approved (reference only — no action)

**S1 dek (option A, tension version)** — approved at Phase 0 Q6:

> Up to $100B is promised between Buffalo and Albany. This instrument tracks
> what the public record shows actually arriving.
