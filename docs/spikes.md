# Spikes — feasibility notes (M6)

Written 2026-06-10, Wave 1. Notes only; implementations land in their items'
waves (S23 → Wave 5, D3 → Wave 2).

---

## Spike A — S23: the measured series on Fig 02's 0–52K axis

**The problem, measured.** Fig 02's jobs panel maps domain 0–52,000 onto
~260px (desktop H; `chart.js`: `yJ` domain `[0, 52000]`, `JOBS.h ≈ 260`).
The measured Onondaga NAICS-3344 series spans 411–670, so the entire line
lives in the bottom **2.1–3.4px** of the panel — at 375px width, under 2.5px.
Unannotated, it reads as a rendering artifact.

**Where it sits.** QCEW annual data covers 2020–2025; clipped to the chart's
2022 start, the line spans 2022–2025 on the x-axis. That region of the panel
is otherwise empty (perm and supply are zero until 2029; the constr band
starts at 2025-0). No collision with existing series; minor collision with
the x-axis hairline itself.

### Option 1 — annotated floor-line (recommended)

Draw the measured series at true scale — a near-flat ink line riding the
floor — and let a leader-line callout state what the eye can barely see:

```
MEASURED: ONONDAGA NAICS-3344 — 670 AT 2025 [n]
└─ leader to the line's right end
```

- The flatness **is** the thesis. The whole piece hangs on promise-vs-meter;
  52,000 promised against 670 measured, in one frame, at one scale, with no
  visual apology. An inset would *soften* exactly the contrast the plate
  exists to show.
- Zero scale distortion to defend; the no-causal-claims guardrail stays
  untouched (one series, one label, one cite).
- Implementation: one `<path>` + one callout group in `chart.js`; the
  callout text doubles as the legibility guarantee (the *number* carries the
  information; the line carries the proof of scale).
- Cost: the 2020→2025 within-series trend (411→670, including the 2024→2025
  jump 456→670) is unreadable at this scale. That detail already has a home —
  Fig 06a — and S37's cross-links will point to it.

### Option 2 — magnified inset

A small inset (own y-domain 0–700) above the floor region, leader-keyed to
the true position.

- Pro: the within-series trend becomes visible on the thesis plate itself.
- Con: introduces a second y-scale to the most-quoted image on the site
  (misreading risk; every screenshot of the plate now needs the inset's
  scale label to travel with it); ~3–4× the implementation surface
  (responsive placement, collision with the key at narrow widths, its own
  caption line); and it dilutes the one-frame contrast.

**Decision: Option 1.** Revisit only if Wave 5 visual QA shows the callout
illegible at 375px. Wording for the label is in `docs/copy-deck.md` §1.

---

## Spike B — D3: Fig 04 talent sankey below ~560px

**The problem.** At 375px the sankey's node labels clip at both viewBox
edges, the top program label is cut, and mid-column labels sit on the
ribbons (`qa/shots/sections/m-s04.png`).

**The structure being drawn.** `TALENT_SANKEY` is 3 layers — 6 sources
(schools/cohorts) → 4 mechanisms (co-ops, certificates, cleanroom lab,
apprenticeships) → 4 employers — with **explicitly illustrative equal-weight
widths** ("STRUCTURE: PUBLIC RECORD · WIDTHS: ILLUSTRATIVE"). The widths
carry no data; only the connectivity does.

### Recommended: stacked route list below ~560px

One block per layer-1 mechanism (4 blocks), chip-headed, listing its inbound
sources and outbound employers:

```html
<ul class="route-list">                      <!-- replaces the SVG -->
  <li class="route">
    <span class="route-chip">CO-OPS — 48 REQUIRED WEEKS AT RIT [17]</span>
    <div class="route-from">RIT microelectronic &amp; electrical eng. · UPWARDS cohort</div>
    <div class="route-to">→ Micron Clay · GlobalFoundries · Albany NanoTech · NY supplier base</div>
  </li>
  …
</ul>
```

- **Loses nothing quantitative** — the widths were never data. A list states
  "structure only" more honestly than ribbons that *look* proportional.
- Feasibility: branch in `renderTalentSankey` on `width < 560`, emit DOM
  instead of SVG (`responsiveMount` already re-renders across the
  breakpoint — verified it destroys and rebuilds per width change). Est.
  ~60 lines JS + ~20 lines CSS. Chips are square (design lint safe); cite
  marks render through the normal path.
- Accessibility improves: real list semantics replace SVG text for AT.

### Rejected: min-width SVG + horizontal scroll

Hides half the lattice off-viewport; weak scroll affordance inside a plate;
pinch/touch targets stay tiny; and the clipped-label bug returns at every
intermediate width. No.

**Decision: route list.** Lands as D3 in Wave 2 with fresh baselines.
