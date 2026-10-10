import { ArrowRight } from 'lucide-react'

export default function FinalCTA({ onStart }) {
  return (
    <section aria-labelledby="cta-heading" className="on-dark relative isolate overflow-hidden">
      <img src="/images/cta.jpg" alt="" role="presentation" width="1600" height="1060" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      {/* A dark wash that slowly drifts between ink and sage, so the section breathes. Fixed colours: it sits on a photo. */}
      <div aria-hidden="true" className="drift-bg absolute inset-0 -z-10 bg-gradient-to-br from-[#242620]/85 via-[#3b4334]/70 to-[#242620]/85" />
      <div className="reveal mx-auto max-w-4xl px-5 py-24 text-center text-cream sm:px-8 lg:py-36">
        <h2 id="cta-heading" className="font-display text-4xl font-medium leading-[1.04] sm:text-6xl lg:text-7xl">Get a plan for your next favourite room.</h2>
        <a href="#redesign" onClick={onStart} className="press group mt-10 inline-flex items-center gap-3 bg-cream px-8 py-4 text-sm font-semibold text-ink transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          Plan My Room <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </section>
  )
}
