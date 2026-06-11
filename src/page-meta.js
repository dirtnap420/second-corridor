// page-meta.js — subpage chrome (methods/decisions/changelog): fill the build
// rev (R21) and the data-refresh date (R11) from the published registry.
// Static fallback is an em dash; nothing here is load-bearing copy.
document
  .querySelectorAll('[data-fill="rev"]')
  .forEach((el) => (el.textContent = __BUILD_REV__));

fetch('/data/sources.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((reg) => {
    if (!reg || !reg.sources) return;
    const dates = reg.sources.map((s) => s.retrieved).filter(Boolean).sort();
    const latest = dates[dates.length - 1];
    if (!latest) return;
    document
      .querySelectorAll('[data-fill="refreshed"]')
      .forEach((el) => (el.textContent = latest));
  })
  .catch(() => {});
