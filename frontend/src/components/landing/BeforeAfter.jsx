import { useCallback, useEffect, useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

export default function BeforeAfter() {
  const reduced = usePrefersReducedMotion()
  const [pos, setPos] = useState(reduced ? 50 : 18)
  const current = useRef(pos)
  const target = useRef(pos)
  const frame = useRef(0)

  // Ease towards the target, and stop once there so nothing re-renders while the slider is still.
  const animateTo = useCallback((value) => {
    target.current = value
    if (frame.current) return
    const tick = () => {
      const diff = target.current - current.current
      current.current = Math.abs(diff) < 0.1 ? target.current : current.current + diff * 0.12
      setPos(current.current)
      frame.current = current.current === target.current ? 0 : requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0 // so a later animateTo (e.g. after a StrictMode remount) can start again
  }, [])

  // A sweep when the section mounts, to show that the image can be compared.
  useEffect(() => {
    if (reduced) return undefined
    animateTo(72)
    const mid = setTimeout(() => animateTo(38), 1400)
    const end = setTimeout(() => animateTo(50), 2400)
    return () => {
      clearTimeout(mid)
      clearTimeout(end)
    }
  }, [reduced, animateTo])

  const setFromInput = (value) => {
    if (reduced) {
      current.current = value
      target.current = value
      setPos(value)
    } else {
      animateTo(value)
    }
  }

  const display = Math.round(pos)

  return (
    <section id="transformation" aria-labelledby="transformation-heading" className="border-y border-line bg-sand/60 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow">The Transformation</p>
            <h2 id="transformation-heading" className="mt-4 font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">See the potential in your space.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted sm:text-base lg:col-span-5">
            Drag the handle or use arrow keys to compare a bare interior with a furnished layout concept.
          </p>
        </div>

        <div className="reveal relative mt-12 aspect-[4/3] w-full select-none overflow-hidden rounded-xl border border-line sm:aspect-[16/9]" style={{ touchAction: 'pan-y' }}>
          <img src="/images/after.jpg" alt="Example of a furnished modern living room with a sectional sofa and large window" width="1200" height="800" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <img
            src="/images/before.jpg"
            alt="Example of a bare room with grey carpet and white walls"
            width="1200"
            height="800"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
          <span className="absolute left-4 top-4 rounded bg-cream/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] shadow-xs backdrop-blur-xs" style={{ opacity: Math.max(0.35, (100 - pos) / 100) }}>Before (Sample)</span>
          <span className="absolute right-4 top-4 rounded bg-ink/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cream shadow-xs backdrop-blur-xs" style={{ opacity: Math.max(0.35, pos / 100) }}>After (Sample)</span>
          <input
            type="range"
            min="0"
            max="100"
            value={display}
            onChange={(e) => setFromInput(Number(e.target.value))}
            aria-label="Compare before and after room concept"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={display}
            aria-valuetext={`${display}% before view, ${100 - display}% after view`}
            className="peer absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-md peer-focus-visible:[&>span]:ring-4 peer-focus-visible:[&>span]:ring-brass" style={{ left: `${pos}%` }}>
            <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lg ring-1 ring-ink/10">
              <MoveHorizontal strokeWidth={1.5} className="h-5 w-5" />
            </span>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
          Illustrative concept photographs of two separate rooms for styling inspiration. These sample images were not generated by SpaceSense.
        </p>
      </div>
    </section>
  )
}
