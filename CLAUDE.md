# The Second Corridor — working agreement

NY semiconductor buildout tracker. Live: https://second-corridor.vercel.app
Master roadmap + progress tracker: `docs/execution-plan.md` (check boxes there;
log deviations at the bottom). Item detail lives in the five plan docs in `docs/`.

## Session ritual

1. **Read the tracker** — `docs/execution-plan.md`: current wave, open boxes,
   deviations log.
2. **Run the battery** (below) and **confirm green** before changing anything.
   Never start work on a red build; fix or log the red first.
3. Change things. One item = one commit where practical.
4. Re-run the battery before the wave exits. Check boxes, log deviations, deploy
   per wave.

## Branch & commit conventions

- Each wave is a branch (`wave-1-gates`, `wave-2-defects`, …) landing as a PR to
  `main`. Vercel attaches a preview deployment to every PR — that preview is the
  review artifact for author checkpoints (checkpoints from Wave 4 on; Waves 1–3
  are autonomous with deploy at exit).
- The item ID leads the commit message: `D5: riser value labels horizontal`.
  Multi-item commits list every ID.
- Git identity: Alex (byline "Alex" alone) · Alex@ozarkintelligence.com.

## Verification battery

Run at every wave exit (and before starting work, to confirm green):

```sh
npm run build           # vite build + design lint + bundle-size gate
npm test                # unit tests: derived series + citation gate
node qa/offline.mjs     # self-containment proof: zero external requests/console errors
node qa/contract.mjs    # contract test: plates render, no NaN/undefined, axe a11y, fixtures
node qa/visual-diff.mjs # pixelmatch vs qa/baselines/ (deterministic reduced-motion shots)
npm run qa              # year×width screenshots for human review (gitignored)
node qa/sections.mjs    # per-section shots (needs dev server on 5173)
node qa/instrument.mjs  # instrument close-ups (needs dev server on 5173)
node qa/perf.mjs        # runtime trace — required on any wave that touched the instrument
```

Waves that *intend* visual change regenerate baselines in their PR:
`node qa/visual-diff.mjs --update`.

## Copy guardrail (governs every rendered sentence)

The site's identity: **every number cited, estimates labeled, no causal claims.**

- Any new rendered sentence carries cite marks per the site's rule. A figure
  whose source key is absent from `SOURCES` must not render.
- Takeaway lines must be arithmetic on already-cited figures or a direct
  restatement of the record — nothing editorializes past it.
- State adjacency, never cause ("2025: 1,701 units — series high", not "permits
  rose because of Micron").
- Suppression is information: suppressed cells render as suppressed, never zero.

## Sign-off list (author approval required before shipping wording)

Pre-drafted wording lives in `docs/copy-deck.md` for one async approval pass.

- **Individual sign-off:** S23 (Fig 02 plan-vs-measured overlay label),
  S24≡D24 (Fig 02 hover-scrub annotation), S27 (Fig 10a series-high stamp),
  S30 (Fig 06c trend takeaway), S33 ($100B internal anchor).
- **Batch review in PRs** (Q4): all other new copy — S11 headlines (s06+s08
  only), S10 Part Two pivot, S12 takeaways, S48 synthesis verdicts, etc.
- Pre-approved: S1 dek option A (tension version).

## Hard decisions already made (do not re-open without the author)

- Analytics: none — and do not advertise "no tracking". No external requests.
- Dark theme (D43) and independence statement (R4): dropped. Custom domain:
  deferred to Wave 8.
- License: MIT (code) + CC BY 4.0 (content/derived data), applied in Wave 6;
  repo private until Wave 6.
- Refresh mode: PR review; new-period-only refresh PRs auto-merge after 72h.
- Locked design system: no border-radius, no gradients, no backdrop-filter
  (build-enforced by `scripts/lint-design.mjs`).
- The three spec-vs-record citation decisions in README → Decisions (CHIPS
  itemization, omitted ~$12M, date-qualified 88) stand unless Alex overrules.
