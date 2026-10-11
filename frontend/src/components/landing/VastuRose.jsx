import { useEffect, useRef, useState } from 'react'
import { VASTU_ZONES } from '../../data/vastuGuide'
import { prefersReducedMotion } from '../../utils/motion'

const C = 130 // centre of the 260×260 drawing
const INNER = 38
const OUTER = 104
const LABEL = 119
const START = 1 // north-east: the zone most people ask about

// Bearing 0 is north (up), clockwise.
const at = (deg, r) => {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)]
}
const wedge = (bearing) => {
  const [a, b] = [bearing - 22.5, bearing + 22.5]
  const p = [at(a, INNER), at(a, OUTER), at(b, OUTER), at(b, INNER)].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
  return `M${p[0]} L${p[1]} A${OUTER} ${OUTER} 0 0 1 ${p[2]} L${p[3]} A${INNER} ${INNER} 0 0 0 ${p[0]}Z`
}
// The shortest turn from one bearing to another, so the needle never spins the long way round.
const towards = (from, to) => from + ((((to - (from % 360)) % 360) + 540) % 360) - 180

/**
 * An eight-direction rose: pick a zone (hover, tap or the arrow keys) to read what SpaceSense suggests
 * there. On first view it walks once round the directions as a hint, unless motion is reduced.
 */
export default function VastuRose() {
  const [index, setIndex] = useState(START)
  const [needle, setNeedle] = useState(START * 45)
  const touched = useRef(false)
  const rootRef = useRef(null)
  const zonesRef = useRef([])

  const select = (i, { focus = false } = {}) => {
    const next = (i + VASTU_ZONES.length) % VASTU_ZONES.length
    setIndex(next)
    setNeedle((n) => towards(n, next * 45))
    if (focus) zonesRef.current[next]?.focus()
  }
  const choose = (i, opts) => {
    touched.current = true
    select(i, opts)
  }

  // The one-time tour, started when the rose scrolls into view.
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return undefined
    let timer = 0
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      let step = 0
      timer = setInterval(() => {
        step += 1
        if (touched.current || step > VASTU_ZONES.length) {
          clearInterval(timer)
          return
        }
        const next = (START + step) % VASTU_ZONES.length
        setIndex(next)
        setNeedle((n) => towards(n, next * 45))
      }, 1100)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => { io.disconnect(); clearInterval(timer) }
  }, [])

  const onKeyDown = (e) => {
    const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (move) {
      e.preventDefault()
      choose(index + move, { focus: true })
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      choose(e.key === 'Home' ? 0 : VASTU_ZONES.length - 1, { focus: true })
    }
  }

  const zone = VASTU_ZONES[index]
  return (
    <div ref={rootRef} className="grid items-center gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-12">
      <svg viewBox="0 0 260 260" className="mx-auto w-full max-w-[20rem] select-none md:max-w-none" role="radiogroup" aria-label="Directions" onKeyDown={onKeyDown}>
        <circle cx={C} cy={C} r={OUTER + 4} className="fill-none stroke-line" strokeWidth="1" />
        {VASTU_ZONES.map((z, i) => {
          const bearing = i * 45
          const on = i === index
          const [lx, ly] = at(bearing, LABEL)
          const cardinal = z.short.length === 1
          return (
            <g key={z.id}>
              <path
                ref={(el) => { zonesRef.current[i] = el }}
                d={wedge(bearing)}
                role="radio"
                aria-checked={on}
                aria-label={z.name}
                tabIndex={on ? 0 : -1}
                onClick={() => choose(i)}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') choose(i) }}
                className={`cursor-pointer stroke-cream outline-none transition-[fill] duration-300 focus-visible:stroke-ink ${on ? 'fill-sage-dark' : 'fill-sand hover:fill-sage-light'}`}
                strokeWidth="2"
              />
              <text
                x={lx} y={ly} textAnchor="middle" dominantBaseline="central" aria-hidden="true"
                className={`pointer-events-none font-sans font-semibold transition-[fill] duration-300 ${on ? 'fill-ink' : 'fill-muted'}`}
                fontSize={cardinal ? 13 : 10}
              >
                {z.short}
              </text>
            </g>
          )
        })}
        <g aria-hidden="true" className="pointer-events-none">
          <circle cx={C} cy={C} r={INNER - 6} className="fill-white stroke-line" strokeWidth="1" />
          <g className="transition-transform duration-700 ease-[var(--ease-spring)] motion-reduce:transition-none" style={{ transform: `rotate(${needle}deg)`, transformOrigin: `${C}px ${C}px` }}>
            <path d={`M${C} ${C - 24} L${C + 5} ${C} L${C - 5} ${C}Z`} className="fill-clay" />
            <path d={`M${C} ${C + 24} L${C + 5} ${C} L${C - 5} ${C}Z`} className="fill-muted" />
          </g>
          <circle cx={C} cy={C} r="2.5" className="fill-ink" />
        </g>
      </svg>

      <div aria-live="polite" className="min-h-[11rem]">
        <div key={zone.id} className="anim-up">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-sage-dark">{zone.name}</p>
          <h3 className="mt-2 font-display text-3xl font-medium sm:text-4xl">{zone.title}</h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted sm:text-base" data-testid="vastu-zone-text">{zone.text}</p>
        </div>
        <p className="mt-5 text-xs text-muted">Hover or tap a direction, or use the arrow keys.</p>
      </div>
    </div>
  )
}
