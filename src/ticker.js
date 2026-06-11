// ticker.js — F37: one rAF conductor for every animation on the page.
// Play, glide, the view morph, and the particle engine each ran their own
// rAF; concurrent animations now coalesce into one callback per frame and
// pause as a group when the tab hides (rAF stops firing). The storytelling
// plan's draw-on-scroll and count-ups (Wave 8) subscribe here too.
// onTick(fn) → unsubscribe function; fn receives the rAF timestamp.
const subs = new Set();
let rafId = null;

function loop(t) {
  rafId = null;
  for (const fn of [...subs]) fn(t);
  if (subs.size) rafId = requestAnimationFrame(loop);
}

export function onTick(fn) {
  subs.add(fn);
  if (rafId === null) rafId = requestAnimationFrame(loop);
  return () => {
    subs.delete(fn);
    if (subs.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
