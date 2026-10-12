import { ArrowRight, Box, Compass, Flower2, Gauge, ListChecks, ScrollText, Sparkles } from 'lucide-react'
import { VASTU_FEATURES, VASTU_REASONS, VASTU_STEPS } from '../../data/vastuGuide'
import VastuRose from './VastuRose'
import SplitText from '../ui/SplitText'

const ICONS = { notes: ScrollText, compass: Compass, ai: Sparkles, check: ListChecks, score: Gauge, pieces: Flower2 }

/**
 * What Vastu is, where SpaceSense uses it and why you might want it. Optional guidance, never a
 * promise: the copy only describes features the app really has.
 */
export default function VastuSection({ onStartVastu, onOpenDesigner }) {
  return (
    <section id="vastu" aria-labelledby="vastu-heading" className="border-y border-line bg-sand/40">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="reveal grid gap-6 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-end">
          <div>
            <p className="eyebrow">Vastu Shastra</p>
            <h2 id="vastu-heading" aria-label="Arrange by direction, if it matters to you." className="mt-4 font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl"><SplitText text="Arrange by direction, if it matters to you." /></h2>
          </div>
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            Vastu is a traditional Indian approach to arranging a home by compass direction. SpaceSense builds it in as optional guidance: it works out which of your walls is south or north-east and applies the guidelines where the room allows. It's a tradition many families value, not a guarantee of anything.
          </p>
        </div>

        <div className="reveal reveal-scale mt-14">
          <VastuRose />
        </div>

        <div className="mt-20">
          <h3 className="reveal font-display text-2xl font-medium sm:text-3xl">What you can do here</h3>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VASTU_FEATURES.map((f, i) => {
              const Icon = ICONS[f.icon]
              return (
                <li key={f.id} className="reveal" style={{ transitionDelay: `${(i % 3) * 90}ms` }}>
                  <div className="spotlight lift h-full rounded-xl border border-line bg-white p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sand text-sage-dark">
                      <Icon aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" />
                    </span>
                    <h4 className="mt-4 font-display text-xl font-medium">{f.title}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-20 grid gap-12 lg:grid-cols-2">
          <div className="reveal reveal-left">
            <h3 className="font-display text-2xl font-medium sm:text-3xl">Why use it</h3>
            <ul className="mt-6 space-y-5">
              {VASTU_REASONS.map((r) => (
                <li key={r.title} className="border-l-2 border-sage pl-4">
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{r.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal reveal-right" style={{ transitionDelay: '120ms' }}>
            <h3 className="font-display text-2xl font-medium sm:text-3xl">Turn it on in three steps</h3>
            <ol className="mt-6 space-y-4">
              {VASTU_STEPS.map((s, i) => (
                <li key={s} className="flex gap-4">
                  <span className="font-display text-3xl font-medium leading-none text-sage">0{i + 1}</span>
                  <p className="pt-1 text-sm leading-relaxed sm:text-base">{s}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#redesign" onClick={onStartVastu} data-magnetic="" className="press shine group inline-flex items-center gap-2 bg-ink px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-brass">
                Plan with Vastu <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              {onOpenDesigner && (
                <button type="button" onClick={onOpenDesigner} data-magnetic="" className="press inline-flex items-center gap-2 border border-ink px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-cream">
                  <Box aria-hidden="true" className="h-4 w-4" /> Try it in 3D
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
