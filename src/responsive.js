// responsive.js — re-render SVG modules at the container's real pixel width so
// mono labels stay at true size on every viewport (no viewBox text shrinkage).
// F28: every consumer gets an IntersectionObserver gate — during play each
// onYear subscriber updates per frame, including surfaces three screens away;
// offscreen we record pendingYear and apply it on re-entry (the same pattern
// the map's particle engine already uses for itself).
export function responsiveMount(container, renderFn) {
  let instance = null;
  let lastW = 0;
  let pendingYear = null;
  let appliedYear = null;
  let timer = null;
  let onscreen = true; // assume visible until the first IO callback

  function build() {
    const w = container.clientWidth;
    if (!w || Math.abs(w - lastW) < 2) return;
    lastW = w;
    if (instance && instance.destroy) instance.destroy();
    container.innerHTML = '';
    instance = renderFn(w);
    if (instance && instance.update && pendingYear !== null) apply();
  }

  function apply() {
    if (instance && instance.update && pendingYear !== null && pendingYear !== appliedYear) {
      appliedYear = pendingYear;
      instance.update(pendingYear);
    }
  }

  const ro = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(build, 150);
  });
  ro.observe(container);

  const io = new IntersectionObserver(
    (entries) => {
      onscreen = entries[0].isIntersecting;
      if (onscreen) apply(); // catch up on re-entry
    },
    { rootMargin: '120px 0px' }
  );
  io.observe(container);

  // print renders every surface — flush any gated year before the snapshot
  window.addEventListener('beforeprint', apply);

  build();

  return {
    update(y) {
      pendingYear = y;
      if (onscreen) apply();
    },
    get instance() {
      return instance;
    },
  };
}
