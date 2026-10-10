import { useCallback, useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, tween } from '../utils/motion'

// Pointer effects only make sense with a real hovering pointer and when motion is welcome.
const canHover = () => {
  try {
    return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches && !prefersReducedMotion()
  } catch {
    return false
  }
}

/**
 * A card that tilts towards the pointer (up to `max` degrees) with a soft glare. Spread the returned
 * props on an element with the `tilt` class (and optionally a `.tilt-glare` child). Frame-throttled.
 */
export function useTilt(max = 6) {
  const frame = useRef(0)
  const onPointerMove = useCallback((e) => {
    if (e.pointerType !== 'mouse' || !canHover()) return
    const el = e.currentTarget
    const { clientX, clientY } = e
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      const px = (clientX - r.left) / r.width
      const py = (clientY - r.top) / r.height
      el.style.setProperty('--rx', `${((px - 0.5) * 2 * max).toFixed(2)}deg`)
      el.style.setProperty('--ry', `${((0.5 - py) * 2 * max).toFixed(2)}deg`)
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
      el.classList.add('is-tilting')
    })
  }, [max])
  const onPointerLeave = useCallback((e) => {
    cancelAnimationFrame(frame.current)
    const el = e.currentTarget
    el.classList.remove('is-tilting')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  return { onPointerMove, onPointerLeave }
}

/** Shifts an element a few pixels towards the pointer, for a sense of depth. Returns a ref. */
export function useParallax(strength = 12) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !canHover()) return undefined
    let frame = 0
    const onMove = (e) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * -strength
        const y = (e.clientY / window.innerHeight - 0.5) * -strength
        el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [strength])
  return ref
}

// Without motion (or an observer to start it) a counter shows the real figure straight away.
const still = () => prefersReducedMotion() || typeof IntersectionObserver === 'undefined'

/** Counts from 0 up to `value` the first time the returned ref scrolls into view. */
export function useCountUp(value, ms = 1200) {
  const ref = useRef(null)
  const [shown, setShown] = useState(() => (still() ? value : 0))
  useEffect(() => {
    const el = ref.current
    if (!el || still()) return undefined
    let cancel = () => {}
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      cancel = tween(0, value, ms, (v) => setShown(Math.round(v)))
    }, { threshold: 0.4 })
    io.observe(el)
    return () => {
      io.disconnect()
      cancel()
    }
  }, [value, ms])
  return [ref, shown]
}
