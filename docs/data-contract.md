# Data contract — `/data/*.json` as a public surface (R32)

The JSON files under `https://second-corridor.vercel.app/data/` are a
documented, stable surface you can script against. Tidy CSV mirrors live at
`/data/csv/*.csv`, and `/data/all.zip` bundles everything. Terms: derived data
CC BY 4.0 (`LICENSE-CONTENT.md`); upstream terms per source in
`docs/terms-ledger.md` and in each file's `provenance` block.

## Stability promise

- **`schemaVersion`** — every file carries one. Additive changes (new optional
  fields) do not bump it; renames, removals, or semantic changes do, and land
  only with a note in `CHANGELOG-DATA.md`. The site itself tolerates the
  current and previous version.
- **Suppression is never a number.** A withheld cell is
  `{"suppressed": true}`; an unpublished OEWS cell is `{"absent": true}`
  (`{"topcoded": true}` for wages at the publication top code). A `0` is a
  measured zero. Consumers must treat these as three different facts.
- **`provenance`** — every file embeds `{source, url, retrievedAt, vintage,
  notes, license, attribution}`. Dates are `YYYY-MM-DD` strings.
- Validation schemas ship in `schemas/`; the refresh pipeline rejects any
  fetch that fails them, so a published file always conforms.
- Output is deterministic: refetching unchanged upstream data reproduces the
  committed bytes. Files change only when the published record changes, and
  every change is diffed in `/data/changes.json` and logged in the changelog.

## Files

| File | Shape (beyond `schemaVersion`, `provenance`) |
|---|---|
| `qcew.json` | `corridor[]`: `{fips, name, series[{year, semi, total}]}` — `semi` = NAICS 3344 employment (countCell), `total` = all-industry. `comparators[]`: `{fips, name, months[{ym, emp}]}` monthly NAICS 3344 since 2020-01. |
| `oews.json` | `areas{syracuse, rochester}` (MSA codes/titles); `occupations[]`: `{soc, title, national, syracuse, rochester}` each `{median, emp}` or absence object. |
| `ipeds.json` | `institutions[]` `{unitid, name, short}`; `cips[]` `{code, title, total, byInst}`; `series[]` `{year, inst, cert, assoc, bach, grad}` — `year` is the NCES survey year (academic year ending). |
| `lodes.json` | `workCounty`, `totalJobs`, `origins[]` `{fips, name, state, jobs, share}` (top 30 home counties), `otherJobs`, `corridorShare`. Jobs, not workers (JT00). |
| `spending.json` | `awards[]` `{id, fain, recipient, agency, description, obligated, outlaid, outlaidAccount, kind, profileUrl, …}`; `chipsNotPublished{}` present only while the Micron CHIPS award records are absent from USAspending. |
| `permits.json` | `counties[]` `{fips, name, series[{year, units}]}` — housing units authorized per year. |
| `acs.json` | `counties[]` `{fips, name, pop25, lessHS, hs, someCollege, baPlus}` — counts, population 25+. |
| `nyiso.json` | `zone`, `annual[]` `{year, avgMW, peakMW, hours, partial?}` — derived from hourly zone load. |
| `sources.json` | `sources[]` `{n, keys, title, publisher, url, date, retrieved}` — the citation registry with the site's exact footnote numbering (append-only). |
| `archives.json` | `archives{url → {archiveUrl, archivedAt}}` — Internet Archive snapshots of every source URL. |
| `changes.json` | the latest refresh diff: `{generatedAt, newPeriodsOnly, datasets{name → {priorVintage, vintage, periodsAdded, valuesChanged, suppressionFlips, …}}}`. `datasets` is empty until the first post-launch change (the launch baseline). |

## CSV mirrors

One tidy long-format CSV per dataset (`/data/csv/<name>.csv`), one row per
entity-period-measure, UTF-8, header row, no comment lines — they open clean
in spreadsheets, Datawrapper/Flourish, R, and pandas. Absence states ride in a
`flag` column (`suppressed` / `not_published` / `topcoded` / `zero_no_employers`),
never as values. The CSVs are generated from the JSONs at every build and
carry the same vintages.
