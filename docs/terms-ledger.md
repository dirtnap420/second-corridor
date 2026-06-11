# Terms-of-use ledger (P49)

Verified 2026-06-10 against the authoritative terms pages (links below). This
ledger gates the republication surfaces (CSV per plate, `all.zip`) and supplies
the `license` / `attribution` fields each published JSON carries in its
`provenance` block (R34). The Second Corridor's own derived data and content
are CC BY 4.0 (see `LICENSE-CONTENT.md`); the entries below are the *upstream*
terms.

| Source | Status / license | Attribution | Redistribution notes | Terms |
|---|---|---|---|---|
| BLS QCEW | Public domain (U.S. government work; BLS: everything it publishes "is in the public domain", photos excepted) | Requested: cite the Bureau of Labor Statistics | No restrictions on the data | [bls.gov/opub/copyright-information.htm](https://www.bls.gov/opub/copyright-information.htm) |
| BLS OEWS | Same bureau-wide BLS policy | Same | Same | Same |
| Census BPS (annual county files) | Public domain (17 U.S.C. §105) | Citation guidance at [census.gov citation page](https://www.census.gov/about/policies/citation.html) | No limits on the data; fetched as published files, not via the API | [census.gov ToS](https://www.census.gov/data/developers/about/terms-of-service.html) |
| Census ACS (API, with summary-file fallback) | Public domain; API use under the Census API ToS | **Required when the API path is used:** "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau." (carried in provenance) | API ToS prohibits re-identification and implying endorsement; no redistribution limits on the data | [census.gov API ToS](https://www.census.gov/data/developers/about/terms-of-service.html) |
| LEHD LODES | U.S. government work — public domain by default; **no explicit license statement on the LODES pages** | Recommended: "U.S. Census Bureau, LEHD Origin-Destination Employment Statistics, {vintage}, accessed {date}" | Public-use files; no restrictions stated | [lehd.ces.census.gov/data](https://lehd.ces.census.gov/data/) |
| USAspending.gov | Open data: "available to copy, adapt, redistribute, or otherwise use for non-commercial or for commercial purposes," subject to a legacy Dun & Bradstreet carve-out | Suggested: "USAspending.gov, U.S. Department of Treasury, Bureau of the Fiscal Service. Accessed {date}." | The D&B limitation covers legacy DUNS-era recipient fields only — this pipeline republishes award amounts, dates, FAINs, and recipient names, not D&B-sourced fields | [usaspending.gov/about](https://www.usaspending.gov/about) (Licensing) |
| Urban Institute Education Data Portal (IPEDS completions) | **ODC-By v1.0** — binding for all data retrieved via the portal; underlying IPEDS records are U.S. government work (public domain) | **Required (ODC-By):** "Education Data Portal, Urban Institute, accessed {date}, https://educationdata.urban.org/, made available under the ODC Attribution License." (carried in provenance and on the Sources list) | Redistribution and commercial use permitted with attribution | [educationdata.urban.org/documentation](https://educationdata.urban.org/documentation/) (Terms of use) |
| NYISO (MIS public load CSVs; Gold Book) | **No affirmative reuse grant.** NYISO is a private nonprofit; its Legal Notice confers no license, and no terms are posted at mis.nyiso.com. The only express prohibition covers images/video | None specified; this site cites "New York Independent System Operator" with document and table on every figure | See adjudication below | [nyiso.com/legal-notice](https://www.nyiso.com/legal-notice) |
| us-atlas (county geometry) | Package ISC; underlying Census TIGER public domain | ISC notice retained in `node_modules` distribution; none required for rendered maps | Free reuse incl. commercial | [github.com/topojson/us-atlas](https://github.com/topojson/us-atlas) |

## Adjudication: NYISO (the one source without an express grant)

What this site republishes from NYISO is (a) two interconnection-request
megawatt figures quoted, with citation, from a published planning document
(the 2026 Gold Book, Table IV-7), and (b) annual average/peak load values for
one zone, *computed by this pipeline* from NYISO's publicly posted hourly
operational CSVs. Both are facts — quantitative measurements and filings — and
facts are not copyrightable (Feist v. Rural, 499 U.S. 340); the aggregation in
`nyiso.json`/`nyiso.csv` is this site's own derived series, six rows deep, and
about as far from a substantial taking of NYISO's compilation as a use can be.

**Decision:** the derived NYISO figures ship in the data downloads, attributed,
with this entry documenting that NYISO grants no express license. If NYISO
objects, the figures come down and the plate falls back to citation-only
rendering. Requesting written permission from NYISO is the clean resolution —
flagged to the author. *(Author review: this judgment shipped in the Wave 6
PR.)*

## Confidence notes

- BLS pages block automated fetches; the public-domain wording is BLS's
  long-standing boilerplate, surfaced verbatim from the official page.
- LODES states no explicit license; the ledger claims only the federal default.
- The USAspending licensing text was verified against the official
  `usaspending-website` source repository (the live About page is a JS app).
