import { ROOM_TYPES, STYLES } from '../../data/sampleData'
import { FLOOR_ITEMS, WALL_ITEMS } from '../../designer/model/catalog'
import { useCountUp } from '../../hooks/usePointerEffects'

// Real counts from the app's own data, so the figures can't drift from what's actually offered.
const STATS = [
  { value: STYLES.length, label: 'Design styles' },
  { value: ROOM_TYPES.length, label: 'Room types, each with a 3D starter layout' },
  { value: Object.keys(FLOOR_ITEMS).length + Object.keys(WALL_ITEMS).length, label: 'Furniture and decor pieces in the 3D designer' },
]

function Stat({ value, label }) {
  const [ref, shown] = useCountUp(value)
  return (
    <div ref={ref} className="border-l border-line pl-5">
      <p className="font-display text-5xl font-medium tabular-nums text-sage-dark sm:text-6xl" aria-hidden="true">{shown}</p>
      <p className="sr-only">{value} {label}</p>
      <p aria-hidden="true" className="mt-1 max-w-[14rem] text-sm text-muted">{label}</p>
    </div>
  )
}

const steps = [
  { n: 1, title: 'Share your space', text: 'Upload a room photo and enter your room dimensions.' },
  { n: 2, title: 'Make it yours', text: 'Choose your style, budget, and optional Vastu preferences.', more: { href: '#vastu', label: 'How Vastu works here' } },
  { n: 3, title: 'Get advice, then decide', text: 'Read written recommendations and shop budget-conscious pieces. Your photo is only edited if you approve it.' },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <div className="reveal">
        <p className="eyebrow">How It Works</p>
        <h2 id="how-it-works-heading" className="mt-4 font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">Three simple steps.</h2>
      </div>
      <div className="relative mt-14">
        <div className="how-line reveal pointer-events-none absolute top-7 right-[8%] left-[8%] hidden h-px bg-ink/40 md:block" />
        <ol className="grid gap-10 md:grid-cols-3 md:gap-0">
          {steps.map((s, i) => (
            <li key={s.n} className="reveal border-t border-ink/80 pt-6 md:border-t-0 md:pt-0 md:pr-10" style={{ transitionDelay: `${i * 120}ms` }}>
              <span className="font-display text-4xl font-medium text-sage sm:text-5xl">0{s.n}</span>
              <h3 className="mt-4 font-display text-2xl font-medium sm:text-3xl">{s.title}</h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted sm:text-base">{s.text}</p>
              {s.more && <a href={s.more.href} className="mt-2 inline-block rounded-sm text-sm font-medium text-sage-dark underline underline-offset-4 hover:text-ink">{s.more.label}</a>}
            </li>
          ))}
        </ol>
      </div>
      <div className="reveal mt-20 grid gap-8 sm:grid-cols-3">
        {STATS.map((s) => <Stat key={s.label} {...s} />)}
      </div>
    </section>
  )
}
