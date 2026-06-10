# Reach improvement plan — "Built to be cited" — 50 items

Drafted 2026-06-10. Companion to the design, data-storytelling, pipeline, and
performance plans.

**The gap this plan closes:** the piece is engineered to be *quoted* — every number
sourced, honest captions, a poster export, a print brief — but nothing helps it
travel or earn institutional trust. The colophon still reads `[NAME] · [CONTACT/URL]`,
there's no license, no methods page, no structured data, no way to take the data with
you, and no repo a stranger can fork. The README already contains most of the trust
material (sections: *Data integrity*, *Provenance — verified figures*, *Decisions*) —
much of this plan is publishing what's already written.

Dependencies on the pipeline plan are marked **[needs pipeline #N]**. Several items
need author decisions (name, license, domain) — marked **[author]**.

Priority key: **P1** = blocks citability · **P2** = compounding reach ·
**P3** = opportunistic.

---

## A. Identity & authorship — you can't cite an anonymous tracker (1–6)

1. **P1 — Fill the placeholders. [author]** `[NAME]` / `[CONTACT/URL]` in the
   colophon (`index.html:450`) and the poster. Flagged since launch; every other
   item in this plan amplifies whatever name is (or isn't) here.

2. **P1 — License the work. [author]** Code MIT (or similar), text + derived data
   CC BY 4.0, with upstream data noted as public-domain/agency-licensed
   **[needs pipeline #49 — the terms ledger]**. Unlicensed work is legally
   un-reusable; journalists and Wikipedia both check.

3. **P1 — Public repository.** Push to GitHub (pipeline #1) and make it public.
   The fetch scripts *are* the methodology; letting anyone run `npm run data` and
   get the same numbers is the strongest trust move available to a solo tracker.

4. **P2 — Independence statement.** One colophon line + methods-page paragraph: not
   affiliated with Micron, ESD, or any cited agency; no funding to disclose (or
   disclose it). Readers can't tell an independent tracker from advocacy without
   being told.

5. **P2 — Contact & corrections channel.** A `mailto:` + GitHub issues link,
   "corrections welcome — see the policy" (item 9). Reachability is a Trust Project
   basic.

6. **P3 — Custom domain decision. [author]** `second-corridor.vercel.app` reads as
   a weekend project; `secondcorridor.org` (~$12/yr) reads as a source. Set the
   Vercel alias, keep the old URL redirecting. Decide before outreach (section F) —
   links accrue to whichever domain exists first.

## B. Methods & trust pages — publish what the README already knows (7–14)

7. **P1 — "How this site knows what it knows."** A `/methods.html` page adapted
   from README *Architecture* + *Data integrity*: the citation gate (uncited figures
   don't render), the suppression discipline, derived-vs-cited rules, refresh
   cadence. This is the page editors check before quoting a number.

8. **P1 — Publish the editorial decisions.** The README *Decisions* section already
   documents the three adjudicated spec-vs-record conflicts (CHIPS itemization per
   the 8-K; the unsourced ~$12M workforce figure omitted; the 88-companies count
   date-qualified). Putting disagreements-with-own-spec on the public record is
   radical transparency no institutional tracker matches. **[author sign-off —
   these three are already flagged for review]**

9. **P2 — Corrections policy + log.** Short policy ("errors corrected in place,
   logged here, material errors noted on the affected plate") + an empty log. The
   empty log *is* the signal.

10. **P2 — Data dictionary.** One page defining NAICS 3344, QCEW vs OEWS vs LODES
    semantics, suppression codes, FAIN/CFDA — linked from each plate's caption.
    (The plates' method-notes stay; this is the depth layer.)

11. **P2 — Recommended citation block.** Plain-text + BibTeX, including
    `retrievedAt` convention and the archive link (item 48): *"The Second Corridor
    (retrieved 2026-06-10), https://…"*. People cite what you make citable.

12. **P2 — Changelog page.** Rendered from `CHANGELOG-DATA.md`
    **[needs pipeline #10]** — the visible heartbeat that distinguishes a tracker
    from an essay.

13. **P3 — Limitations page.** The consolidated "what the record doesn't say"
    (storytelling #14) gets a permalink — reviewers and rivals will look for it;
    better it exists in your voice.

14. **P3 — `robots.txt` + `humans.txt`.** Allow all, point to sitemap (item 16);
    humans.txt carries the colophon. Two static files.

## C. Machine-readable trust (15–21)

15. **P2 — Archived source links.** Render each Sources row's Wayback link
    (`· archived` in muted mono) **[needs pipeline #27/#32]**. A citation that
    can't rot is a citation editors prefer.

16. **P2 — `sitemap.xml` + JSON-LD.** Sitemap (trivial — one page + methods +
    changelog), then `schema.org/Article` for the piece and one
    `schema.org/Dataset` node per `public/data/*.json` (temporalCoverage from
    `provenance.vintage`, license from item 2, `isBasedOn` the agency URLs).
    Dataset markup puts the data in Google's Dataset Search — a direct discovery
    channel for exactly the researchers who'd cite this.

17. **P3 — Validate structured data in CI.** Schema validator against the built
    HTML — markup that drifts invalid is worse than none.

18. **P2 — `og:updated_time` + freshness meta.** Refresh date into OG and
    `<meta name="last-modified">` at build; crawlers and link previews surface
    recency — the tracker's differentiator.

19. **P3 — Self-archive on deploy.** Trigger a Wayback snapshot of the *site* after
    each production deploy **[needs pipeline #2]** — citers of "retrieved June
    2026" can resolve what June 2026 actually said.

20. **P3 — Stable anchors as API.** Document `#s01`–`#s11`, `#src-N`, and the
    `#y=` state as stable, versioned anchors (they're already good); commit to not
    breaking inbound deep links.

21. **P3 — Build provenance in the colophon.** `__BUILD_REV__` is injected at build
    (`vite.config.js`) but only the poster uses it (`poster.js:153`); print
    `rev · data vintage` in the colophon so any screenshot is traceable to an exact
    build.

## D. Shareable surfaces — every figure independently citable (22–30)

22. **P1 — Per-section share URLs.** A single-page app can't give Fig 08 its own
    social card. Add Vercel rewrites: `/f/08` → tiny static HTML carrying
    section-specific OG tags + instant JS redirect to `/#s08`. Newsrooms share
    figures, not homepages.

23. **P1 — Per-section OG images.** Parameterize `scripts/build-og.mjs` (the
    resvg/sharp harness exists) to render a card per section: plate snapshot +
    takeaway line + vintage. Regenerated each refresh **[needs pipeline #2]** so
    shared cards always show current data.

24. **P2 — Copy-link affordance on plates.** Storytelling #50's `COPY LINK` should
    copy the `/f/NN` URL (with `#y=` state per storytelling #43) — one affordance,
    both plans satisfied.

25. **P2 — Poster closes the loop.** Verify the exported poster footer carries the
    site URL + rev (it has rev; add the URL if absent) — posters travel to walls
    and slide decks; the way back must be printed on them.

26. **P2 — The print brief becomes a linkable artifact.** Generate `brief.pdf` in
    CI per refresh (`page.pdf()` against the print stylesheet — performance #48
    builds the same harness) and link it: *"Download the brief (PDF, refreshed
    2026-06-10)"*. PDFs circulate in government inboxes where URLs die.

27. **P3 — Card validation pass.** Test OG/Twitter cards in the validators plus
    Bluesky/Mastodon/LinkedIn/Slack/iMessage previews once per design change —
    apple-touch-icon (performance #18) rides along.

28. **P2 — Embed mode.** `?embed=fig07` renders one plate, no masthead, attribution
    footer with backlink, `postMessage` height for iframes. Local newsrooms embed
    charts they couldn't build; every embed is a live backlink.

29. **P3 — oEmbed descriptor.** Static `oembed.json` + `<link rel="alternate"
    type="application/json+oembed">` so CMSes auto-embed pasted links. Cheap once
    item 28 exists.

30. **P3 — Five-numbers snapshot image.** Render the masthead stat strip
    (storytelling #2) as a standalone share image per refresh — the whole story in
    one image for social.

## E. Data out — let people take it with them (31–37)

31. **P1 — CSV per plate.** The "view the numbers" tables are already the tidy
    data; emit them as CSVs in the pipeline and link from each plate caption
    (`DOWNLOAD CSV`). Spreadsheet users are most of the audience that acts on data.
    **[needs pipeline #49 license check]**

32. **P2 — Document `/data/*.json` as a public API.** A `docs/data-contract.md`
    listing each file, fields, suppression semantics, `schemaVersion`
    **[needs pipeline #11]**, and a stability promise. Researchers script against
    documented endpoints.

33. **P2 — `data/all.zip` per refresh.** Bundle JSONs + CSVs + `sources.json` +
    license — one click for "give me everything."

34. **P3 — License field in provenance.** Each JSON's `provenance` block gains
    `license` + `attribution` so files carry their terms when they're copied
    around.

35. **P3 — Tidy-format check.** Keep CSVs long/tidy (one row per
    county-period-measure) so Datawrapper/Flourish/R/pandas ingest them without
    reshaping — that's how the charts get *re-made* with attribution.

36. **P3 — GitHub release per refresh.** Tag `vYYYY.MM.DD`, attach `all.zip`
    **[needs pipeline #2]** — versioned, permanent, citable data drops independent
    of Vercel's lifetime.

37. **P3 — Dataset registry listings.** Once 31–36 exist: list on Google Dataset
    Search (via item 16's markup), data.world, and the awesome-public-datasets
    index. One-time submissions, long-tail discovery.

## F. Distribution — the audience map (38–46)

38. **P1 — Write the audience map first. [author]** One page: local press
    (syracuse.com, CNY Business Journal, WAER, Spectrum), regional planners (SOCPA,
    CNY REDC, county IDAs), the schools on the talent plate (RIT, MCC, OCC, FLCC
    comms offices), state-level (Comptroller's office, ESD-watchers), national
    (semiconductor trade press, CSET/Brookings chips trackers). Every later item
    targets someone on this map.

39. **P2 — Refresh notes as posts.** Each material refresh gets a 3-paragraph note
    (the `changes.json` narrative): what moved, what it means, what's next-watch.
    Feeds the RSS (item 40), gives social a link, gives journalists a quote.

40. **P2 — RSS/Atom feed.** Static XML from the changelog **[needs pipeline #10]**.
    Feeds are how the highest-value audience (journalists, analysts) actually
    monitors sources.

41. **P2 — Press kit.** One page: what this is, who built it, boilerplate
    description, poster + OG images, embed instructions, contact. Newsrooms use
    what's frictionless.

42. **P2 — Launch/refresh outreach, mapped.** When a refresh lands news (the FAIN
    appearing — pipeline #36 — is the big one), send the note to the 3–5 mapped
    contacts it's relevant to. Trackers earn citations at news moments, not on
    launch day.

43. **P3 — Community submissions.** Show HN, r/dataisbeautiful (OC), Data Is
    Plural newsletter, DVS/Nightingale, Sigma Awards & Information is Beautiful
    Awards when windows open. One list, timed, never spammed.

44. **P3 — Search intent pass.** The queries that matter are "micron clay jobs",
    "micron syracuse timeline", "white pine commerce park". Title/meta/H2s should
    contain those phrases where honest (e.g., the s01 body already says "megafab at
    Clay" — good); no FAQ-schema games.

45. **P3 — Wikipedia eligibility.** *Micron Technology* and CHIPS-Act-related
    articles cite trackers as external links when independent + stable + licensed
    (items 2, 4, 6). Qualify first; one neutral external-link addition, no
    self-promotional editing.

46. **P3 — "Email me when data changes" without infrastructure.** Document
    GitHub's release-watch as the subscription mechanism (item 36), or a free
    Buttondown wired to the RSS. No servers, no analytics, no GDPR surface.

## G. Longevity — outlive the deploy (47–50)

47. **P2 — Analytics decision, documented. [author]** Currently none — and
    `qa/offline.mjs` *proves* no external requests, which is itself a privacy
    credential worth advertising on the methods page. If measurement is wanted,
    Vercel's first-party analytics is the only candidate compatible with that
    guarantee (performance #8); otherwise write "this site does not track you" in
    the colophon and bank the trust.

48. **P2 — Permanence statement.** Methods-page paragraph: where the archive lives
    (GitHub releases + Wayback snapshots), what happens if the domain lapses
    (repo remains), recommended citation against archives. Institutions cite
    things they believe will still resolve in 2031.

49. **P3 — Succession note.** README section: how to fork, refresh, and redeploy
    this tracker if the author stops — bus-factor honesty that costs three
    paragraphs and signals the work is bigger than its maintainer.

50. **P3 — Milestone-keyed editorial calendar.** The corridor's own dates are the
    content calendar: 2026 groundbreaking (this year — the launch-news window),
    2027 construction-workforce figure, 2030 Fab 1 ops. Schedule refresh-notes and
    outreach against the ledger the site already renders.

---

## Suggested sequencing

- **Pass 1 — citability floor (P1):** 1, 2, 3, 7, 8, 22, 23, 31, 38. Identity,
  license, public repo, methods, per-figure sharing, data out, audience map. Most
  of these are decisions + publishing already-written material.
- **Pass 2 — compounding channels (P2):** 4, 5, 9, 10, 11, 12, 15, 16, 18, 24, 25,
  26, 28, 32, 33, 39, 40, 41, 42, 47, 48.
- **Pass 3 — long tail (P3):** the rest, opportunistically; 45 (Wikipedia) only
  after 2/4/6 are done.

Hard dependencies: items 15, 23, 26, 33, 36, 40 need the pipeline plan's CI and
diff/archive layers; item 31 needs the terms ledger (pipeline #49); item 6 (domain)
should precede outreach (38–42) so links accrue to the permanent address. The
single best timing note: the **2026 groundbreaking** is this calendar year — the
natural news hook to launch the whole reach effort against.
