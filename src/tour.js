// tour.js — S15: the 60-second guided tour. Five beats, each a scroll target
// + an instrument state + two lines of caption, then release into free
// exploration. Author-driven first pass, reader-driven second. Dynamically
// imported on the TOUR button — never part of the main bundle.
//
// Copy discipline: captions are deictic — they point at what is on screen
// (whose figures carry their own cite marks); they state no figures of
// their own. Reduced motion: beats jump instead of glide — the tour still
// plays, the motion skips.
const BEATS = (todayYear) => [
  {
    target: '#instrument',
    year: 2022,
    cap: ['The instrument: five corridor nodes on the I-90 line.', 'Everything on this page answers to one timeline.'],
  },
  {
    target: '#instrument',
    year: todayYear,
    glide: true,
    cap: ['Scrub or play — every surface follows the year.', 'Left of the TODAY tick is record; right of it is promise.'],
  },
  {
    target: '#s02',
    year: 2045,
    cap: ['The plan as arithmetic: derived series, interpolated between cited anchors.', 'The flat ink line along the floor is what is measured so far.'],
  },
  {
    target: '#s08',
    cap: ['Section 08 documents an absence in the federal ledger.', 'What is not yet recorded renders too — that is the point.'],
  },
  {
    target: '#s06',
    cap: ['Section 06: the measured baseline the promise lands on.', 'County by county — and suppression renders as suppression, never zero.'],
  },
];

let active = null; // singleton — a second invocation finishes the first

export function runTour({
  glideTo,
  setYear,
  stopPlay = () => {},
  cancelGlide = () => {},
  motion,
  todayYear,
  onEnd = null,
  // explicit, because the caller may disable the button (dropping focus to
  // <body>) before this runs — restore focus here on exit
  invoker = document.activeElement,
}) {
  if (active) active.finish(); // no stacked dialogs, no leaked listeners
  const beats = BEATS(todayYear);
  let i = -1;
  let done = false;

  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Guided tour');
  card.innerHTML = `
    <p class="tour-cap" aria-live="polite"></p>
    <div class="tour-row">
      <span class="tour-step"></span>
      <button class="btn tour-next">Next</button>
      <button class="btn tour-end">End tour</button>
    </div>`;
  document.body.appendChild(card);
  const capEl = card.querySelector('.tour-cap');
  const stepEl = card.querySelector('.tour-step');
  const nextBtn = card.querySelector('.tour-next');
  const endBtn = card.querySelector('.tour-end');

  function finish() {
    if (done) return;
    done = true;
    active = null;
    window.removeEventListener('keydown', onKey);
    card.remove();
    if (onEnd) onEnd(); // re-enables the invoker before focus lands on it
    // WCAG 2.4.3: the focused node was removed — hand focus back to the
    // control that opened the tour, not <body>
    if (invoker && document.contains(invoker)) invoker.focus();
  }

  function show(idx) {
    i = idx;
    const b = beats[i];
    // settle the instrument BEFORE scrolling: a beat's setYear triggers the
    // ledger's smooth follow-scroll, which would cancel an in-flight smooth
    // page scroll (the R22 mechanism) — year first, page scroll second.
    // And never apply a year on top of a running glide or play loop.
    stopPlay();
    cancelGlide();
    if (typeof b.year === 'number') {
      if (b.glide && !motion.reduced) glideTo(b.year);
      else setYear(b.year);
    }
    const el = document.querySelector(b.target);
    if (el) el.scrollIntoView({ behavior: motion.reduced ? 'instant' : 'smooth', block: 'start' });
    capEl.innerHTML = b.cap.map((l) => `<span>${l}</span>`).join('<br>');
    stepEl.textContent = `${i + 1} / ${beats.length}`;
    const last = i === beats.length - 1;
    nextBtn.textContent = last ? 'Explore freely' : 'Next';
    nextBtn.setAttribute(
      'aria-label',
      last ? 'Explore freely — end of tour' : `Next — step ${i + 2} of ${beats.length}`
    );
    nextBtn.focus();
  }

  const onKey = (e) => {
    if (e.key === 'Escape') finish();
  };
  window.addEventListener('keydown', onKey);
  nextBtn.addEventListener('click', () => (i >= beats.length - 1 ? finish() : show(i + 1)));
  endBtn.addEventListener('click', finish);

  active = { finish };
  // a frame later, so the live region exists in the a11y tree before its
  // first write (same-task insert+mutate can miss the announcement)
  setTimeout(() => !done && show(0), 0);
  return { finish };
}
