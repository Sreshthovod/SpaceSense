import { ArrowRight } from 'lucide-react'

export default function FinalCTA({ onStart }) {
  return (
    <section className="on-dark relative isolate overflow-hidden">
      <img src="/images/cta.jpg" alt="" width="1600" height="1060" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/70" />
      <div className="reveal mx-auto max-w-4xl px-5 py-28 text-center text-cream sm:px-8 lg:py-40">
        <h2 className="font-display text-5xl font-medium leading-[1.02] sm:text-7xl">Your next favourite room starts here.</h2>
        <a href="#redesign" onClick={onStart} className="group mt-10 inline-flex items-center gap-3 bg-cream px-8 py-4 text-sm font-medium text-ink transition-colors hover:bg-white">
          Start Your Redesign <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </section>
  )
}
