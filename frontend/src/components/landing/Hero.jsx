import { ArrowRight, ArrowUpRight } from 'lucide-react'

export default function Hero({ onStart }) {
  return (
    <section id="top" className="relative mx-auto grid max-w-7xl items-stretch gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-12 lg:gap-0 lg:pb-24 lg:pt-16">
      <div className="reveal flex min-w-0 flex-col justify-center lg:col-span-5 lg:pr-12">
        <p className="eyebrow">AI-Powered Interior Design</p>
        <h1 className="mt-6 font-display text-6xl font-medium leading-[0.95] tracking-tight sm:text-7xl xl:text-8xl">
          Your space.<br /><em className="font-normal text-sage-dark">Reimagined.</em>
        </h1>
        <p className="mt-7 max-w-md text-lg leading-relaxed text-muted">
          Transform your room into a space you love — personalized to your style, your budget, and the way you live.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <a href="#redesign" onClick={onStart} className="group inline-flex items-center gap-3 bg-ink px-7 py-4 text-sm font-medium text-cream transition-colors hover:bg-sage-dark">
            Redesign My Room <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a href="#styles" className="inline-flex items-center gap-1.5 border-b border-ink pb-0.5 text-sm font-medium transition-colors hover:border-sage hover:text-sage-dark">
            Explore design styles <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5 text-xs uppercase tracking-[0.16em] text-muted">
          <span>Personalized design</span><span aria-hidden="true" className="h-3 w-px bg-line" /><span>Budget-conscious planning</span>
        </p>
      </div>

      <div className="reveal relative lg:col-span-7">
        <div aria-hidden="true" className="absolute -left-4 top-8 hidden h-full w-full border border-sage/50 lg:block" />
        <figure className="relative">
          <img
            src="/images/hero.jpg"
            alt="Sunlit living room with warm wood panelling, a cream sofa and a low timber coffee table"
            width="1600" height="1067" fetchPriority="high"
            className="h-[62vw] max-h-[720px] min-h-[320px] w-full object-cover lg:h-[min(78vh,720px)]"
          />
          <figcaption className="absolute bottom-0 left-0 bg-cream px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-muted">
            Warm timber · Soft linen · Natural light
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
