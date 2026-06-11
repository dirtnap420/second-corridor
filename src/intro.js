// intro.js — the plotter opening: a pen tip draws the state outline, the
// county hairlines develop in, the corridor trace plots with its own pen,
// node markers stamp in with staggered label typesetting, the dials and
// scrubber carriage slide into place, the ledger cascades. Implemented as a
// draw-over of the already-rendered DOM (opacity/transform/stroke only — no
// layout shift). Total ≤2.5s, linear pen-plotter easings. Skipped by
// ?nointro, reduced motion, or any input.
export function runIntro({ mapInstance, motion, finale = null }) {
  if (motion.reduced) return;
  if (new URLSearchParams(location.search).has('nointro')) return;
  if (!mapInstance || !mapInstance.svg) return;

  const svg = mapInstance.svg;
  const outline = svg.querySelector('.state-outline');
  const mesh = svg.querySelector('.county-mesh');
  const traceBase = svg.querySelector('.trace-base');
  const traceFill = svg.querySelector('.trace-fill');
  const traceTip = svg.querySelector('.trace-tip');
  const nodes = [...svg.querySelectorAll('.node-marker')];
  const scrubRow = document.getElementById('scrubber-row');
  const dials = document.getElementById('dials');
  const ledgerRows = [...document.querySelectorAll('#ledger li')];
  const rule = document.querySelector('.masthead-rule');
  const controls = [
    document.getElementById('play'),
    document.getElementById('tab-ambient'),
    document.getElementById('tab-flows'),
    document.getElementById('tab-map'),
    document.getElementById('tab-section'),
    document.getElementById('export-poster'),
  ].filter(Boolean);

  const timeouts = [];
  const rafs = [];
  const pens = [];
  let done = false;

  /* ---- initial draw-over state ---- */
  const outlineLen = outline.getTotalLength();
  outline.style.strokeDasharray = `${outlineLen}`;
  outline.style.strokeDashoffset = `${outlineLen}`;

  mesh.style.opacity = '0';

  const baseLen = traceBase.getTotalLength();
  const baseDash = traceBase.style.strokeDasharray;
  traceBase.style.strokeDasharray = `${baseLen}`;
  traceBase.style.strokeDashoffset = `${baseLen}`;

  traceFill.style.opacity = '0';
  if (traceTip) traceTip.style.opacity = '0';

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
  dials.style.opacity = '0';
  for (const li of ledgerRows) li.style.opacity = '0';
  controls.forEach((c) => (c.disabled = true));

  /* ---- a pen tip that rides a path while it draws ---- */
  function ridePen(pathEl, start, dur) {
    const pen = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pen.setAttribute('width', '5');
    pen.setAttribute('height', '5');
    pen.setAttribute('fill', 'var(--copper)');
    pen.setAttribute('stroke', 'var(--ink)');
    pen.setAttribute('stroke-width', '0.75');
    pen.style.opacity = '0';
    svg.appendChild(pen);
    pens.push(pen);
    const len = pathEl.getTotalLength();
    const t0 = performance.now() + start;
    const step = (now) => {
      if (done) return;
      const k = (now - t0) / dur;
      if (k < 0) {
        rafs.push(requestAnimationFrame(step));
        return;
      }
      if (k >= 1) {
        pen.remove();
        return;
      }
      pen.style.opacity = '1';
      const p = pathEl.getPointAtLength(len * k);
      pen.setAttribute('x', p.x - 2.5);
      pen.setAttribute('y', p.y - 2.5);
      rafs.push(requestAnimationFrame(step));
    };
    rafs.push(requestAnimationFrame(step));
  }

  function finish() {
    if (done) return;
    done = true;
    timeouts.forEach(clearTimeout);
    rafs.forEach(cancelAnimationFrame);
    pens.forEach((p) => p.remove());
    for (const el of [outline, traceBase, traceFill, mesh, rule, scrubRow, dials]) {
      if (!el) continue;
      el.style.transition = 'none';
    }
    outline.style.strokeDasharray = '';
    outline.style.strokeDashoffset = '';
    mesh.style.opacity = '';
    traceBase.style.strokeDasharray = baseDash || '';
    traceBase.style.strokeDashoffset = '';
    traceFill.style.opacity = '';
    if (traceTip) traceTip.style.opacity = '';
    for (const g of nodes) {
      const mark = g.querySelector('.mark');
      const text = g.querySelector('text');
      mark.style.transition = 'none';
      mark.style.transform = '';
      text.style.transition = 'none';
      text.style.opacity = '';
    }
    if (rule) rule.style.transform = '';
    scrubRow.style.opacity = '';
    scrubRow.style.transform = '';
    dials.style.opacity = '';
    for (const li of ledgerRows) {
      li.style.transition = '';
      li.style.opacity = '';
    }
    controls.forEach((c) => {
      if (c.dataset.keepDisabled === 'true') return;
      c.disabled = false;
    });
    window.removeEventListener('pointerdown', interruptFinish);
    window.removeEventListener('keydown', interruptFinish);
    window.removeEventListener('wheel', interruptFinish);
  }
  const interruptFinish = () => {
    finish();
    if (finale) finale('interrupt');
  };
  window.addEventListener('pointerdown', interruptFinish, { once: true });
  window.addEventListener('keydown', interruptFinish, { once: true });
  window.addEventListener('wheel', interruptFinish, { once: true, passive: true });

  const at = (ms, fn) => timeouts.push(setTimeout(() => !done && fn(), ms));

  /* ---- timeline (linear, pen-plotter cadence, ≤2.5s) ---- */
  // 0–900ms: the pen draws the state outline
  requestAnimationFrame(() => {
    if (done) return;
    outline.style.transition = 'stroke-dashoffset 900ms linear';
    outline.style.strokeDashoffset = '0';
  });
  ridePen(outline, 0, 900);

  // 150ms: hairline rule sweeps
  at(150, () => {
    if (rule) {
      rule.style.transition = 'transform 500ms linear';
      rule.style.transform = 'scaleX(1)';
    }
  });
  // 550ms: county hairlines develop in
  at(550, () => {
    mesh.style.transition = 'opacity 450ms linear';
    mesh.style.opacity = '1';
  });
  // 850ms: the corridor trace plots with its own pen
  at(850, () => {
    traceBase.style.transition = 'stroke-dashoffset 550ms linear';
    traceBase.style.strokeDashoffset = '0';
  });
  ridePen(traceBase, 850, 550);

  // 1200ms+: node markers stamp in, labels typeset, staggered west→east
  nodes.forEach((g, i) => {
    at(1200 + i * 130, () => {
      const mark = g.querySelector('.mark');
      mark.style.transition = 'transform 120ms linear';
      mark.style.transform = 'scale(1)';
    });
    at(1280 + i * 130, () => {
      const text = g.querySelector('text');
      text.style.transition = 'opacity 90ms linear';
      text.style.opacity = '1';
    });
  });
  // 1500ms: trace fill + carriage tip appear
  at(1500, () => {
    traceFill.style.transition = 'opacity 300ms linear';
    traceFill.style.opacity = '1';
    if (traceTip) {
      traceTip.style.transition = 'opacity 300ms linear';
      traceTip.style.opacity = '1';
    }
  });
  // 1800ms: dials fade up, scrubber carriage slides into place
  at(1800, () => {
    dials.style.transition = 'opacity 350ms linear';
    dials.style.opacity = '1';
    scrubRow.style.transition = 'opacity 350ms linear, transform 350ms linear';
    scrubRow.style.opacity = '1';
    scrubRow.style.transform = 'translateY(0)';
  });
  // 1950ms+: ledger rows cascade
  ledgerRows.forEach((li, i) => {
    at(1950 + i * 24, () => {
      li.style.transition = 'opacity 140ms linear';
      li.style.opacity = '1';
    });
  });
  // 2400ms: controls enable; resting styles restored. S4: on natural
  // completion (not an interrupt) the final beat scrubs 2022 → today —
  // trace fills, nodes ping, ledger advances, and the opening ends in the
  // present. Interrupts skip it: the reader has taken the controls.
  at(2400, () => {
    finish();
    if (finale) finale('natural');
  });
}
