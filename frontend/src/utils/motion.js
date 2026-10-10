/** Small motion helpers shared by the site and the designer. No animation library: CSS + browser APIs. */

export function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

/**
 * Runs `update` inside a View Transition when the browser has them (Chrome, Edge, Safari 18+), so the
 * old and new screens cross-fade. Elsewhere, or with reduced motion, it just runs `update`.
 */
export function withViewTransition(update) {
  if (typeof document === 'undefined' || !document.startViewTransition || prefersReducedMotion()) {
    update()
    return null
  }
  try {
    return document.startViewTransition(update)
  } catch {
    update()
    return null
  }
}

/** Eases a number from `from` to `to` over `ms`, calling `onUpdate` each frame. Returns a cancel function. */
export function tween(from, to, ms, onUpdate) {
  if (from === to || ms <= 0 || prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
    onUpdate(to)
    return () => {}
  }
  const start = performance.now()
  let frame = 0
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms)
    const eased = 1 - (1 - t) ** 3
    onUpdate(from + (to - from) * eased)
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
  return () => cancelAnimationFrame(frame)
}
