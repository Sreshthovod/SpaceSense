import { ArrowRight } from 'lucide-react'

export default function FinalCTA({ onStart }) {
  return (
    <section aria-labelledby="cta-heading" className="on-dark relative isolate overflow-hidden">
      <img src="/images/cta.jpg" alt="" role="presentation" width="1600" height="1060" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/75" />
      <div className="reveal mx-auto max-w-4xl px-5 py-24 text-center text-cream sm:px-8 lg:py-36">
        <h2 id="cta-heading" className="font-display text-4xl font-medium leading-[1.04] sm:text-6xl lg:text-7xl">Your next favourite room starts here.</h2>
        <a href="#redesign" onClick={onStart} className="group mt-10 inline-flex items-center gap-3 bg-cream px-8 py-4 text-sm font-semibold text-ink transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          Start Your Redesign <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </section>
  )
}
