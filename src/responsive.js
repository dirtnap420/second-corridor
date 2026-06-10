// responsive.js — re-render SVG modules at the container's real pixel width so
// mono labels stay at true size on every viewport (no viewBox text shrinkage).
export function responsiveMount(container, renderFn) {
  let instance = null;
  let lastW = 0;
  let pendingYear = null;
  let timer = null;

  function build() {
    const w = container.clientWidth;
    if (!w || Math.abs(w - lastW) < 2) return;
    lastW = w;
    if (instance && instance.destroy) instance.destroy();
    container.innerHTML = '';
    instance = renderFn(w);
    if (instance && instance.update && pendingYear !== null) instance.update(pendingYear);
  }

  const ro = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(build, 150);
  });
  ro.observe(container);
  build();

  return {
    update(y) {
      pendingYear = y;
      if (instance && instance.update) instance.update(y);
    },
    get instance() {
      return instance;
    },
  };
}
