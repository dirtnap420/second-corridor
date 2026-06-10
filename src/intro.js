// intro.js — the plotter opening: the state outline draws itself, the corridor
// trace plots, node markers stamp in, the scrubber carriage slides into place.
// Implemented as a draw-over of the already-rendered DOM (opacity/transform/
// stroke only — no layout shift; content is present underneath throughout).
// Total ≤2.5s, linear easings. Skipped by ?nointro, reduced motion, any input.
export function runIntro({ mapInstance, motion }) {
  if (motion.reduced) return;
  if (new URLSearchParams(location.search).has('nointro')) return;
  if (!mapInstance || !mapInstance.svg) return;

  const svg = mapInstance.svg;
  const outline = svg.querySelector('.state-outline');
  const traceBase = svg.querySelector('.trace-base');
  const traceFill = svg.querySelector('.trace-fill');
  const nodes = [...svg.querySelectorAll('.node-marker')];
  const scrubRow = document.getElementById('scrubber-row');
  const rule = document.querySelector('.masthead-rule');
  const controls = [
    document.getElementById('play'),
    document.getElementById('tab-ambient'),
    document.getElementById('tab-flows'),
    document.getElementById('tab-map'),
    document.getElementById('tab-section'),
  ].filter(Boolean);

  const timeouts = [];
  let done = false;

  /* ---- initial draw-over state ---- */
  const outlineLen = outline.getTotalLength();
  outline.style.strokeDasharray = `${outlineLen}`;
  outline.style.strokeDashoffset = `${outlineLen}`;

  const baseLen = traceBase.getTotalLength();
  const baseDash = traceBase.style.strokeDasharray;
  traceBase.style.strokeDasharray = `${baseLen}`;
  traceBase.style.strokeDashoffset = `${baseLen}`;

  traceFill.style.opacity = '0';

  for (const g of nodes) {
    const mark = g.querySelector('.mark');
    const text = g.querySelector('text');
    mark.style.transformBox = 'fill-box';
    mark.style.transformOrigin = 'center';
    mark.style.transform = 'scale(0)';
    text.style.opacity = '0';
  }
  if (rule) {
    rule.style.transformOrigin = 'left';
    rule.style.transform = 'scaleX(0)';
  }
  scrubRow.style.opacity = '0';
  scrubRow.style.transform = 'translateY(6px)';
  controls.forEach((c) => (c.disabled = true));

  function finish() {
    if (done) return;
    done = true;
    timeouts.forEach(clearTimeout);
    outline.style.transition = 'none';
    outline.style.strokeDasharray = '';
    outline.style.strokeDashoffset = '';
    traceBase.style.transition = 'none';
    traceBase.style.strokeDasharray = baseDash || '3 3';
    traceBase.style.strokeDashoffset = '';
    traceFill.style.transition = 'none';
    traceFill.style.opacity = '';
    for (const g of nodes) {
      const mark = g.querySelector('.mark');
      const text = g.querySelector('text');
      mark.style.transition = 'none';
      mark.style.transform = '';
      text.style.transition = 'none';
      text.style.opacity = '';
    }
    if (rule) {
      rule.style.transition = 'none';
      rule.style.transform = '';
    }
    scrubRow.style.transition = 'none';
    scrubRow.style.opacity = '';
    scrubRow.style.transform = '';
    controls.forEach((c) => {
      if (c.id === 'tab-flows' && c.dataset.keepDisabled === 'true') return;
      c.disabled = false;
    });
    window.removeEventListener('pointerdown', finish);
    window.removeEventListener('keydown', finish);
    window.removeEventListener('wheel', finish);
  }
  window.addEventListener('pointerdown', finish, { once: true });
  window.addEventListener('keydown', finish, { once: true });
  window.addEventListener('wheel', finish, { once: true, passive: true });

  const at = (ms, fn) => timeouts.push(setTimeout(() => !done && fn(), ms));

  /* ---- timeline (linear, pen-plotter cadence) ---- */
  // 0–900ms: the state outline draws itself
  requestAnimationFrame(() => {
    if (done) return;
    outline.style.transition = 'stroke-dashoffset 900ms linear';
    outline.style.strokeDashoffset = '0';
  });
  // 150ms: hairline rule sweeps
  at(150, () => {
    if (rule) {
      rule.style.transition = 'transform 500ms linear';
      rule.style.transform = 'scaleX(1)';
    }
  });
  // 750ms: corridor trace plots
  at(750, () => {
    traceBase.style.transition = 'stroke-dashoffset 550ms linear';
    traceBase.style.strokeDashoffset = '0';
  });
  // 1150ms+: node markers stamp in with label typesetting, staggered
  nodes.forEach((g, i) => {
    at(1150 + i * 140, () => {
      const mark = g.querySelector('.mark');
      mark.style.transition = 'transform 130ms linear';
      mark.style.transform = 'scale(1)';
    });
    at(1240 + i * 140, () => {
      const text = g.querySelector('text');
      text.style.transition = 'opacity 90ms linear';
      text.style.opacity = '1';
    });
  });
  // 1450ms: trace fill (year progress) appears
  at(1450, () => {
    traceFill.style.transition = 'opacity 300ms linear';
    traceFill.style.opacity = '1';
  });
  // 1900ms: scrubber carriage slides into place
  at(1900, () => {
    scrubRow.style.transition = 'opacity 350ms linear, transform 350ms linear';
    scrubRow.style.opacity = '1';
    scrubRow.style.transform = 'translateY(0)';
  });
  // 2350ms: controls enable; restore resting styles
  at(2350, finish);
}
