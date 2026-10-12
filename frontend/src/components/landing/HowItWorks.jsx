import { ArrowUpRight, Check, Upload } from 'lucide-react'
import { ROOM_TYPES, STYLES } from '../../data/sampleData'
import { FLOOR_ITEMS, WALL_ITEMS } from '../../designer/model/catalog'
import { useCountUp } from '../../hooks/usePointerEffects'
import SplitText from '../ui/SplitText'

// Real counts from the app's own data, so the figures can't drift from what's actually offered.
const STATS = [
  { value: STYLES.length, label: 'Design styles' },
  { value: ROOM_TYPES.length, label: 'Room types, each with a 3D starter layout' },
  { value: Object.keys(FLOOR_ITEMS).length + Object.keys(WALL_ITEMS).length, label: 'Furniture and decor pieces in the 3D designer' },
]

function Stat({ value, label }) {
  const [ref, shown] = useCountUp(value)
  return (
    <div ref={ref} className="flex items-baseline gap-4 px-6 py-6 sm:block sm:px-8 sm:py-7">
      <p className="font-display text-5xl font-semibold leading-none tabular-nums text-sage-dark sm:text-6xl" aria-hidden="true">{shown}</p>
      <p className="sr-only">{value} {label}</p>
      <p aria-hidden="true" className="text-sm leading-snug text-muted sm:mt-3 sm:max-w-[15rem]">{label}</p>
    </div>
  )
}

// The little pictures on each card. They only illustrate the step (aria-hidden, nothing clickable)
// and use the site's own room photos.
const ROOM_PHOTO = '/images/before.jpg'
const ROOM_AFTER = '/images/after.jpg'

function SharePreview() {
  return (
    <div className="relative h-full overflow-hidden rounded-lg">
      <img src={ROOM_PHOTO} alt="" width="640" height="420" loading="lazy" className="how-zoom h-full w-full object-cover" />
      <div className="on-dark absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
      {/* Corner marks, like a photo being framed. */}
      <span className="on-dark absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-cream/80" />
      <span className="on-dark absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-cream/80" />
      <span className="on-dark absolute bottom-3 left-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-cream">Room photo</span>
      <span className="on-dark absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-cream/90 text-ink">
        <Upload className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    </div>
  )
}

const CHIPS = ['scandinavian', 'minimalist', 'modern-indian'].map((id) => STYLES.find((s) => s.id === id)?.name).filter(Boolean)

function TailorPreview() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 rounded-lg border border-line bg-cream px-4 py-4">
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((name, i) => (
          <span key={name} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${i === 0 ? 'border-sage-dark bg-sage-dark text-cream' : 'border-line text-muted'}`}>{name}</span>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          <span>Budget</span><span>INR</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
          <div className="how-bar h-full w-3/5 rounded-full bg-sage-dark" />
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span className="relative h-3.5 w-6 rounded-full bg-sage-dark"><span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-cream" /></span>
        Vastu preferences
      </div>
    </div>
  )
}

function DecidePreview() {
  return (
    <div className="relative h-full overflow-hidden rounded-lg">
      <div className="grid h-full grid-cols-2 gap-1">
        <img src={ROOM_PHOTO} alt="" width="320" height="420" loading="lazy" className="how-zoom h-full w-full object-cover" />
        <img src={ROOM_AFTER} alt="" width="320" height="420" loading="lazy" className="how-zoom h-full w-full object-cover" />
      </div>
      <span className="on-dark absolute left-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream">Before</span>
      <span className="on-dark absolute right-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream">After</span>
      <span className="on-dark absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-md bg-cream/95 px-2 py-1.5 text-[11px] font-medium text-ink">
        <Check className="h-3.5 w-3.5 text-sage-dark" strokeWidth={2.5} /> Edited only if you approve
      </span>
    </div>
  )
}

const steps = [
  { n: 1, title: 'Share your space', text: 'Upload a room photo and enter your room dimensions.', Preview: SharePreview },
  {
    n: 2, title: 'Make it yours', text: 'Choose your style, budget, and optional Vastu preferences.', Preview: TailorPreview,
    more: { href: '#vastu', label: 'How Vastu works here' },
  },
  { n: 3, title: 'Get advice, then decide', text: 'Explore personalised recommendations and budget-conscious furniture. Your photo is only edited if you approve it.', Preview: DecidePreview },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <div className="reveal flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">How It Works</p>
          <h2 id="how-it-works-heading" aria-label="Three simple steps." className="mt-4 font-display text-4xl font-semibold leading-[0.95] tracking-[-0.01em] sm:text-5xl lg:text-6xl"><SplitText text="Three simple steps." /></h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted sm:text-base">From a photo of your room to a plan you can act on, at your pace.</p>
      </div>

      <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6">
        {steps.map(({ n, title, text, more, Preview }, i) => {
          const wide = i === 2 // spans both columns on tablets
          return (
          <li key={n} className={`reveal how-card ${wide ? 'md:col-span-2 lg:col-span-1' : ''}`} style={{ transitionDelay: `${i * 110}ms`, '--d': `${i * 110}ms` }}>
            <article className={`spotlight how-lift group flex h-full flex-col rounded-xl border border-line bg-white p-6 sm:p-7 ${wide ? 'md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:gap-7' : ''}`}>
              <div className="flex flex-1 flex-col">
                <span className="how-seq how-num font-display text-5xl font-semibold leading-none tabular-nums text-sage sm:text-6xl">0{n}</span>
                <h3 className="how-seq mt-5 font-display text-[1.75rem] font-semibold leading-tight sm:text-3xl" style={{ '--s': '1' }}>{title}</h3>
                <p className="how-seq mt-2.5 text-sm leading-relaxed text-muted sm:text-[0.95rem]" style={{ '--s': '1' }}>{text}</p>
                {more && (
                  <a href={more.href} className="how-seq how-link mt-3 inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-sage-dark" style={{ '--s': '1' }}>
                    {more.label} <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div aria-hidden="true" className={`how-seq how-preview mt-6 h-40 ${wide ? 'md:max-lg:mt-0 md:max-lg:h-full' : ''}`} style={{ '--s': '2' }}>
                <Preview />
              </div>
            </article>
          </li>
          )
        })}
      </ol>

      <div className="reveal mt-8 grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:mt-10">
        {STATS.map((s) => <Stat key={s.label} {...s} />)}
      </div>
    </section>
  )
}
