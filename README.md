# The Second Corridor

**Live: https://second-corridor.vercel.app**

An interactive, single-purpose tracker of New York State's semiconductor buildout
(2022–2045), assembled entirely from public data. One master scrubber drives a
corridor map, a derived-series chart, dials, a milestone ledger, and a
measured-reality suite refreshed from BLS, Census, NSF, USAspending, and NYISO
with one command.

**Why this exists.** The Micron megafab at Clay, the CHIPS Act, and Albany
NanoTech are usually discussed as headlines. This instrument lays the published
plan (sections 01–05, every figure cited) against the measured reality
(sections 06–11, fetched from public statistical agencies) so a policy reader
can check one against the other — and lift any number into their own documents
with its source attached.

## Architecture

```
scripts/        Node data pipeline — run manually (`npm run data`), never at runtime
public/data/    committed aggregates only, each with an embedded provenance object
src/            vanilla JS + D3 v7 + d3-sankey + topojson-client (vendored, no CDN)
qa/             Playwright visual-QA harness (dev only)
```

- **No frameworks, no trackers, no external requests after build.** Fonts are
  self-hosted latin-subset woff2. All data is committed JSON.
- **Projection:** `d3.geoConicConformal().parallels([40.5, 44.5]).rotate([76.5, 0])`,
  fitted to each panel.
- **Geometry:** `us-atlas` counties-10m filtered to FIPS 36, simplified to ~35%
  detail, quantized (~0.005°), emitted as TopoJSON (13.2KB); the state outline is
  derived client-side via `topojson.merge`.
- **Design system is enforced mechanically:** the build fails if `border-radius`,
  `gradient`, or `backdrop-filter` appears in shipped CSS (`scripts/lint-design.mjs`).

## Refresh & deploy

```sh
npm install
npm run data    # re-fetch all public data → public/data/*.json (with provenance)
npm run geo     # rebuild NY geometry from us-atlas
npm run og      # rebuild the 1200×630 OG card
npm run build   # vite build + design lint
npx vercel deploy --prod --yes   # deploy ./dist per vercel.json
```

Deep links: `https://second-corridor.vercel.app/#y=2030` opens the instrument at
a given year. `?nointro` skips the plotter opening.

QA: `npm run qa` screenshots years {2022, 2026, 2030, 2045} × widths
{375, 768, 1280} into `qa/shots/` (gitignored) for before/after comparison.

## Data integrity

- **Derived series (sections 01–02) are interpolations, not forecasts.** Rules:
  `invest` linear through (2022, 0) → (2030, $20B) → (2045, $100B); `constr` a
  band ramping (2025, 0) → (2027, 3,000–4,000), held flat at the only cited
  figure through 2041, ramp-down to (2042, 0) is illustrative; `perm` linear
  (2029, 0) → (2045, 9,000); `supply` = cited ~50,000 total minus cited 9,000
  direct, linear (2029, 0) → (2045, 41,000). Every chart carrying them is
  labeled `INTERPOLATED BETWEEN CITED ANCHORS — NOT A FORECAST`.
- **Suppression is information.** QCEW small-cell suppression renders as
  "suppressed (BLS confidentiality)", never zero. OEWS unavailable cells render
  as such.
- **LODES measures all-industry commuting** into Onondaga County jobs — the
  labor-market geometry the fab plugs into, not semiconductor-specific flows.
  OD files carry no industry breakout and the instrument does not imply one.
- **Announced ≠ obligated ≠ outlaid.** CHIPS direct funding disburses against
  milestones; a gap between obligation and outlay is the design of the
  agreement, not delay. Green CHIPS is a New York State performance-based tax
  credit and never appears in federal spending data.
- **Vintages render from provenance objects** embedded by the fetch scripts —
  never from strings in markup.
- Fetch scripts fail loudly on schema drift or missing data. No placeholders.

## Provenance — verified figures (sections 01–05)

Every anchor figure was located in a primary public source and then
adversarially re-verified against the live document (retrieved 2026-06-10).

| Figure | Claim | Source | Published |
|---|---|---|---|
| micron-100b | Up to $100B over 20+ years, megafab at Clay — largest private investment in NYS history | [Micron press release](https://www.globenewswire.com/news-release/2022/10/04/2527958/0/en/Micron-Announces-Historic-Investment-of-up-to-100-Billion-to-Build-Megafab-in-Central-New-York.html) | 2022-10-04 |
| micron-9000-direct | ~9,000 direct Micron jobs | [Micron press release](https://www.globenewswire.com/news-release/2022/10/04/2527958/0/en/Micron-Announces-Historic-Investment-of-up-to-100-Billion-to-Build-Megafab-in-Central-New-York.html) | 2022-10-04 |
| micron-50000-total | Nearly 50,000 NY jobs total (9,000 direct + 40,000+ community) | [Governor's office](https://www.governor.ny.gov/news/hochul-schumer-mcmahon-announce-micron-coming-onondaga-county-micron-will-invest-unprecedented) | 2022-10-04 |
| micron-20b-first-phase | First-phase ~$20B by end of decade | [Micron press release](https://www.globenewswire.com/news-release/2022/10/04/2527958/0/en/Micron-Announces-Historic-Investment-of-up-to-100-Billion-to-Build-Megafab-in-Central-New-York.html) | 2022-10-04 |
| green-chips-5_5b | $5.5B Green CHIPS package | [Governor's office](https://www.governor.ny.gov/news/hochul-schumer-mcmahon-announce-micron-coming-onondaga-county-micron-will-invest-unprecedented) | 2022-10-04 |
| green-chips-structure | Performance-based tax credits, realized as milestones are met | [Empire State Development](https://esd.ny.gov/green-chips) | current page |
| chips-act-2022 | CHIPS and Science Act signed Aug 9, 2022 (P.L. 117-167) | [Congress.gov](https://www.congress.gov/bill/117th-congress/house-bill/4346) | 2022-08-09 |
| chips-direct | Up to $6.165B CHIPS direct funding, finalized Dec 9–10, 2024 | [NIST](https://www.nist.gov/news-events/news/2024/12/department-commerce-awards-chips-incentives-micron-idaho-and-new-york) · [Micron 8-K](https://www.sec.gov/Archives/edgar/data/723125/000110465924127174/tm2430615d1_8k.htm) | 2024-12 |
| upwards-2023 | UPWARDS launched 2023; RIT one of six US universities | [RIT News](https://www.rit.edu/news/growing-collaboration-advances-semiconductor-industry) | 2025-01-07 |
| emerge-micro-2024 | NSF EMERGE-MICRO award — RIT + MCC + FLCC | [NSF award 2347157](https://www.nsf.gov/awardsearch/showAward?AWD_ID=2347157) | 2024-07-08 |
| euv-825m | ~$825M NSTC EUV Accelerator at Albany | [NIST](https://www.nist.gov/news-events/news/2024/10/biden-harris-administration-announces-ny-creates-albany-nanotech-complex) | 2024-10-31 |
| euv-operational-2025 | EUV Accelerator operational July 1, 2025 | [Natcast](https://www.prnewswire.com/news-releases/natcast-celebrates-grand-opening-of-nstc-euv-accelerator-at-ny-creates-albany-nanotech-complex-one-of-three-nstc-flagship-semiconductor-rd-facilities-across-the-country-302504465.html) | 2025-07-14 |
| groundbreaking-2026 | Official groundbreaking January 16, 2026 | [Micron press release](https://www.globenewswire.com/news-release/2026/01/16/3220324/14450/en/Micron-Celebrates-Official-Groundbreaking-at-New-York-Megafab-Site.html) | 2026-01-16 |
| fab phasing (2026 Q2 constr → 2028 Fab 1 structure/Fab 2 → 2030 ops → 2033 Fab 3 → 2039 Fab 4 → 2041 constr end → 2045 full ops) | Four-fab construction & ramp schedule | [Micron NY Final EIS, CHIPS Program Office & OCIDA](https://ongoved.com/wp-content/uploads/2025/11/2025_1105_MicronNY_FEIS_Final.pdf) (+ [App. B-5](https://ongoved.com/wp-content/uploads/2025/11/2025_1105_MicronNY_FEIS_Appendix_A-D.pdf)) | 2025-11 |
| constr-3000-4000 | 3,000–4,000 construction workers on site | [Onondaga County, 2026 State of the County](https://onondaga.gov/communications/2026/03/28/county-executive-mcmahon-delivers-2026-state-of-the-county-address/) | 2026-03-28 |
| ny-88-establishments-2022 | 88 semiconductor establishments (April 2022) | [Governor's office](https://www.governor.ny.gov/news/governor-hochul-announces-new-team-guide-states-strategy-become-nations-leading-hub) | 2022-04-22 |
| ny-156-companies / ny-34000-workers | 156+ semiconductor & supply-chain companies, 34,000+ workers | [Empire State Development](https://esd.ny.gov/industries/semiconductors) | current page |
| rit-cleanroom / rit-150mm | Class-1000 cleanroom (Semiconductor Nanofabrication Lab), 150mm CMOS line | [RIT program page](https://www.rit.edu/study/microelectronic-engineering-bs) · [SNL tool set](https://www.rit.edu/nanofab/tool-set) | current pages |
| rit-1500-alumni | 1,500+ microelectronic engineering alumni in industry | [RIT News](https://www.rit.edu/news/computer-chip-technology-aligns-rits-microelectronic-engineering-program-growth) | 2022-04-12 |
| rit-coop-48 | 48 required co-op weeks (four blocks) | [RIT program page](https://www.rit.edu/study/microelectronic-engineering-bs) | current page |
| node-stamp | STAMP mega-site, Genesee County (Edwards Vacuum $319M) | [Governor's office](https://www.governor.ny.gov/news/governor-hochul-and-majority-leader-schumer-announce-major-semiconductor-supply-chain) | 2022-11-02 |
| node-marcy | Wolfspeed 200mm SiC fab, Marcy Nanocenter, Oneida County | [Empire State Development](https://esd.ny.gov/esd-media-center/press-releases/governor-hochul-announces-grand-opening-wolfspeeds-1-billion-silicon-carbide-fabrication-facility-mohawk-valley) | 2022-04-25 |
| node-albany | Albany NanoTech Complex, NSTC EUV Accelerator | [Governor's office](https://www.governor.ny.gov/news/governor-hochul-announces-grand-opening-nstc-euv-accelerator-ny-creates-albany-nanotech) | 2025-07-14 |
| node-clay | White Pine Commerce Park, Town of Clay, Onondaga County | [Governor's office](https://www.governor.ny.gov/news/hochul-schumer-mcmahon-announce-micron-coming-onondaga-county-micron-will-invest-unprecedented) | 2022-10-04 |
| node-rit | RIT microelectronic engineering programs | [RIT News](https://www.rit.edu/news/rit-expands-its-workforce-initiatives-semiconductor-industry) | 2024-07-26 |
| ann-tsmc-az | TSMC Arizona announced May 15, 2020 | [TSMC](https://pr.tsmc.com/english/news/2033) | 2020-05-15 |
| ann-intel-oh | Intel Ohio announced January 21, 2022 | [Intel](https://www.intc.com/news-events/press-releases/detail/1521/intel-announces-next-us-site-with-landmark-investment-in) | 2022-01-21 |
| ann-micron-id | Micron Boise announced September 1, 2022 | [Micron](https://www.globenewswire.com/news-release/2022/09/01/2508617/0/en/Micron-to-Invest-15-Billion-in-New-Idaho-Fab-Bringing-Leading-Edge-Memory-Manufacturing-to-the-US.html) | 2022-09-01 |
| ann-samsung-tx | Samsung Taylor TX announced November 2021 | [Samsung](https://news.samsung.com/global/samsung-electronics-announces-new-advanced-semiconductor-fab-site-in-taylor-texas) | 2021-11-24 |

Live-data sources (sections 06–11) carry their vintages in the provenance
objects inside `public/data/*.json` and in the on-page Sources list.

## Decisions

1. **CHIPS direct funding is rendered itemized, contradicting the spec's
   framing.** The spec called for a single sankey band labeled "single
   agreement, NY share not itemized." Micron's SEC Form 8-K (Dec 9, 2024)
   itemizes the finalized award: $4.6B for Clay Fabs 1–2, $1.5B for Boise, up
   to $65M for workforce — executed as *two* funding agreements under one
   finalized award. Shipping the spec's label would have shipped a false
   statement; the itemized, citable version renders instead. **Flagged for
   author review.**
2. **The spec's ~$12M federal workforce figure is omitted.** No ~$12M figure
   exists in the public record (searched NSF, NIST, Commerce, White House, DOL,
   Natcast). The citable figures are $40M (April 2024 preliminary terms,
   superseded) and up to $65M (final agreements). The $65M renders, cited to
   the 8-K.
3. **"88 NY semiconductor companies" is date-qualified.** The 88 figure is the
   state's April 2022 count of *establishments*; the state's current count is
   156+ companies (ESD). Both render in section 05 with dates; the talent
   sankey's supplier node uses 156+.
4. RIT's cleanroom is labeled by its current name (Semiconductor
   Nanofabrication Lab; formerly SMFL), and the 1,500+ alumni figure is scoped
   to the microelectronic engineering program, per the cited sources.
5. **Jobs chart composition:** perm + supply are stacked from zero (stack top =
   the cited ~50,000 at 2045); the constr band is *overlaid* at its own cited
   3,000–4,000 values rather than stacked, to avoid implying a stacked total
   that mixes a range with point series.
6. The corridor trace fill is a scrub-position progress indicator (a timeline
   cursor in space), not a data series. Node activation years come from the
   cited milestones (Clay/STAMP/Marcy 2022, RIT 2023, Albany 2024).
7. Capital sankey bands below 1.25px at true scale (the $65M workforce grant)
   are drawn at a 1.25px minimum, noted on the plate.
8. Geometry ships as TopoJSON (smaller than GeoJSON); the state outline merges
   client-side.
9. The OG card renders via `@resvg/resvg-js` with the committed woff2 fonts
   decompressed to TTF at build time (sharp on Windows lacks reliable custom
   font loading).
10. Git identity is repo-local placeholder (`Aharr <aharr@localhost>`).
11. Comparator announcement-date nuances (per the verified primary sources):
    TSMC's May 15, 2020 release names Arizona but not Phoenix; Intel's Jan 21,
    2022 release names Licking County but not New Albany; Samsung's newsroom
    dateline is Nov 24, 2021 (KST) for the Nov 23 US-time announcement.

## Colophon

Built by [NAME] · [CONTACT/URL]. Bracketed fields are intentional placeholders
for the author.
