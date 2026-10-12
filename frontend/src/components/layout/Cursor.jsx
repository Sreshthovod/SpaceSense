import { useEffect, useRef, useState } from 'react'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'
import { canHover } from '../../hooks/usePointerEffects'

const TEXT = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]), textarea, select, [contenteditable="true"]'
const INTERACTIVE = 'a[href], button, [role=button], [role=radio], [role=tab], [role=option], label, summary, input[type=range], input[type=checkbox], input[type=radio]'
const LABELS = { view: 'View', pick: 'Pick', drag: 'Drag', open: 'Open' }
const RING_EASE = 0.2
const MAGNET = 0.28
const MAGNET_MAX = 14

/**
 * The desktop pointer: a dot that follows the mouse exactly and a ring that trails it, growing over
 * things you can click and turning into a label over `[data-cursor]` elements. The same frame loop
 * also drives the page spotlight (a soft light trailing the ring), the card glow on `.spotlight` elements
 * (`--sx/--sy`) and the pull of `[data-magnetic]` buttons, so the whole site shares one listener.
 * Nothing renders on touch screens or when reduced motion is on; the native cursor stays then.
 */
export default function Cursor() {
  const reduced = usePrefersReducedMotion()
  const [fine] = useState(canHover)
  const on = fine && !reduced
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const labelRef = useRef(null)
  const lightRef = useRef(null)

  useEffect(() => {
    if (!on) return undefined
    const root = document.documentElement
    const dot = dotRef.current
    const ring = ringRef.current
    const light = lightRef.current
    root.classList.add('has-cursor')

    let mx = -100
    let my = -100
    let rx = mx
    let ry = my
    let frame = 0
    let magnet = null
    let spot = null

    const releaseMagnet = () => {
      if (magnet) magnet.style.translate = ''
      magnet = null
    }

    const tick = () => {
      frame = 0
      rx += (mx - rx) * RING_EASE
      ry += (my - ry) * RING_EASE
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`
      light.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`
      if (spot) {
        const r = spot.getBoundingClientRect()
        spot.style.setProperty('--sx', `${mx - r.left}px`)
        spot.style.setProperty('--sy', `${my - r.top}px`)
      }
      if (magnet) {
        const r = magnet.getBoundingClientRect()
        const clamp = (v) => Math.max(-MAGNET_MAX, Math.min(MAGNET_MAX, v))
        const dx = clamp((mx - (r.left + r.width / 2)) * MAGNET)
        const dy = clamp((my - (r.top + r.height / 2)) * MAGNET)
        magnet.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`
      }
      // Keep going until the ring has caught up, then sleep until the mouse moves again.
      if (Math.abs(mx - rx) + Math.abs(my - ry) > 0.2) frame = requestAnimationFrame(tick)
    }
    const wake = () => { if (!frame) frame = requestAnimationFrame(tick) }

    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      mx = e.clientX
      my = e.clientY
      if (ring.dataset.hidden) {
        // First move (or back from outside the window): start the ring where the pointer is.
        delete ring.dataset.hidden
        delete dot.dataset.hidden
        delete light.dataset.hidden
        rx = mx
        ry = my
      }
      wake()
    }

    const onOver = (e) => {
      const t = e.target instanceof Element ? e.target : null
      if (!t) return
      const labelled = t.closest('[data-cursor]')
      let state = ''
      if (labelled) {
        state = 'label'
        const key = labelled.getAttribute('data-cursor')
        labelRef.current.textContent = LABELS[key] ?? key
      } else if (t.closest(TEXT)) state = 'text'
      else if (t.closest(INTERACTIVE)) state = 'hover'
      ring.dataset.state = state
      dot.dataset.state = state
      const dark = t.closest('.on-dark') ? 'true' : ''
      ring.dataset.dark = dark
      dot.dataset.dark = dark

      const nextMagnet = t.closest('[data-magnetic]')
      if (nextMagnet !== magnet) {
        releaseMagnet()
        magnet = nextMagnet
      }
      spot = t.closest('.spotlight')
      wake()
    }

    const onDown = () => { ring.dataset.down = 'true' }
    const onUp = () => { delete ring.dataset.down }
    const onLeave = () => {
      ring.dataset.hidden = 'true'
      dot.dataset.hidden = 'true'
      light.dataset.hidden = 'true'
      releaseMagnet()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerover', onOver, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    root.addEventListener('mouseleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      releaseMagnet()
      root.classList.remove('has-cursor')
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerover', onOver)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      root.removeEventListener('mouseleave', onLeave)
    }
  }, [on])

  if (!on) return null
  return (
    <div aria-hidden="true">
      <div ref={lightRef} className="page-spotlight" data-hidden="true" />
      <div ref={ringRef} className="cursor-ring" data-hidden="true">
        <span className="cursor-ring-shape"><span ref={labelRef} className="cursor-label" /></span>
      </div>
      <div ref={dotRef} className="cursor-dot" data-hidden="true" />
    </div>
  )
}
