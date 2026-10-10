import { useRef, useState } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { useTilt } from '../../hooks/usePointerEffects'

// Directions for the little burst when a style is picked.
const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2
  return { sx: `${Math.cos(a) * 46}px`, sy: `${Math.sin(a) * 46}px`, color: i % 2 ? 'var(--color-brass)' : 'var(--color-sage-light)' }
})

const tiles = [
  { id: 'modern-indian', name: 'Modern Indian', text: 'Warm timber, earthy tones and tactile textiles with a contemporary line.', img: '/images/style-modern-indian.jpg', alt: 'Living room with timber wall panels, terracotta cushion and dark stone fireplace', span: 'md:col-span-7' },
  { id: 'minimalist', name: 'Minimalist', text: 'Quiet rooms, honest materials and only what you need.', img: '/images/style-minimalist.jpg', alt: 'Minimal white interior with a pendant lamp, round table and timber stools', span: 'md:col-span-5' },
  { id: 'scandinavian', name: 'Scandinavian', text: 'Soft light, pale linens and calm, functional comfort.', img: '/images/style-scandinavian.jpg', alt: 'Bright room with sheer curtains, linen cushions and a framed print', span: 'md:col-span-5' },
  { id: 'contemporary-luxury', name: 'Contemporary Luxury', text: 'Marble, deep wood and layered symmetry for a refined finish.', img: '/images/style-contemporary-luxury.jpg', alt: 'Formal living room with marble fireplace wall and dark wood shelving', span: 'md:col-span-7' },
]

export default function DesignStyles({ onSelectStyle, selected }) {
  const tilt = useTilt(5)
  const [burst, setBurst] = useState(null) // { id, x, y, key }
  const bursts = useRef(0)
  const pick = (e, id) => {
    const r = e.currentTarget.getBoundingClientRect()
    // Keyboard clicks report 0,0: burst from the centre then.
    const x = e.clientX ? e.clientX - r.left : r.width / 2
    const y = e.clientY ? e.clientY - r.top : r.height / 2
    setBurst({ id, x, y, key: ++bursts.current })
    onSelectStyle(id)
  }
  return (
    <section id="styles" aria-labelledby="styles-heading" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
      <div className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Design Styles</p>
          <h2 id="styles-heading" className="mt-4 font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">Find your look.</h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted sm:text-base">Click any style to start your redesign with it already chosen.</p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-12">
        {tiles.map((t) => {
          const active = selected === t.id
          return (
            <div key={t.id} className={`reveal ${t.span}`}>
            <button
              type="button"
              onClick={(e) => pick(e, t.id)}
              {...tilt}
              aria-pressed={active}
              aria-label={`Start a redesign in the ${t.name} style`}
              className={`tilt group relative block w-full cursor-pointer overflow-hidden rounded-xl text-left hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark ${active ? 'ring-2 ring-brass ring-offset-2 ring-offset-cream' : ''}`}
            >
              <img
                src={t.img}
                alt={t.alt}
                width="1000"
                height="667"
                loading="lazy"
                className="style-ken aspect-[4/3] w-full object-cover md:aspect-auto md:h-[26rem]"
              />
              <div className="on-dark absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
              <div className="on-dark style-caption absolute inset-x-0 bottom-0 p-5 text-cream sm:p-6">
                <h3 className="flex items-center gap-2 font-display text-2xl font-medium sm:text-3xl">
                  {t.name}
                  <ArrowUpRight aria-hidden="true" className="h-5 w-5 text-cream/80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-cream/85 sm:text-sm">{t.text}</p>
              </div>
              <span aria-hidden="true" className="tilt-glare pointer-events-none absolute inset-0" />
              {active && (
                <span aria-hidden="true" className="anim-pop absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-brass text-white shadow-lg">
                  <Check className="h-5 w-5" />
                </span>
              )}
              {burst?.id === t.id && (
                <span key={burst.key} aria-hidden="true" className="pointer-events-none absolute" style={{ left: burst.x, top: burst.y }}>
                  {SPARKS.map((sp, i) => (
                    <span key={i} className="spark" style={{ '--sx': sp.sx, '--sy': sp.sy, background: sp.color, left: -3, top: -3 }} />
                  ))}
                </span>
              )}
            </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
