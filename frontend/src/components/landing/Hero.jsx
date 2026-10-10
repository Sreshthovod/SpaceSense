import { ArrowRight, ArrowUpRight } from 'lucide-react'

export default function Hero({ onStart }) {
  return (
    <section id="top" className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col justify-between overflow-hidden">
      <img
        src="/images/hero.jpg"
        alt="Sunlit living room with warm wood panelling, a cream sofa and a low timber coffee table"
        width="1600"
        height="1067"
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_center]"
      />
      {/* Primary directional overlay: ensures high legibility on text while beautifully revealing the room */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-cream via-cream/92 via-60% to-cream/70 lg:bg-gradient-to-r lg:from-cream lg:from-28% lg:via-cream/85 lg:via-48% lg:via-cream/30 lg:via-65% lg:to-transparent lg:to-80%"
      />
      {/* Soft bottom vignette for seamless section transition */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-16 bg-gradient-to-t from-cream/60 to-transparent lg:h-24"
      />

      {/* Main hero content */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pt-12 pb-14 sm:px-8 lg:pt-16 lg:pb-16">
        <div className="reveal min-w-0 max-w-xl">
          <p className="eyebrow">AI-Powered Interior Design</p>
          <h1 className="mt-6 font-display text-ink">
            <span className="block text-5xl font-medium tracking-tight sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[0.98]">
              Your space.
            </span>
            <em className="mt-1 block text-5xl font-light italic text-sage-dark sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[0.98] sm:mt-2">
              Reimagined.
            </em>
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/80 sm:text-lg">
            Transform your room into a space you love — personalized to your style, your budget, and the way you live.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a
              href="#redesign"
              onClick={onStart}
              className="group inline-flex min-h-12 items-center gap-3 bg-brass px-7 py-3.5 text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-200 hover:bg-ink focus-visible:outline-brass shadow-xs"
            >
              Redesign My Room
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <a
              href="#styles"
              className="inline-flex min-h-12 items-center gap-1.5 text-sm font-medium text-ink underline decoration-ink/30 underline-offset-[6px] transition-colors duration-200 hover:text-brass hover:decoration-brass"
            >
              Explore design styles
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-10 border-t border-line/70 pt-5">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
                <span>Personalized design</span>
              </li>
              <li aria-hidden="true" className="h-3 w-px bg-line" />
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brass" aria-hidden="true" />
                <span>Budget-conscious planning</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar: Subtle functional scroll indicator & refined mood label */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl items-end justify-between px-5 pb-6 pt-2 sm:px-8">
        <a
          href="#transformation"
          aria-label="Scroll to discover transformation"
          className="group inline-flex items-center gap-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-muted transition-colors duration-200 hover:text-ink focus-visible:outline-sage-dark"
        >
          <span className="flex h-6 w-3.5 items-start justify-center rounded-full border border-ink/30 p-0.5 transition-colors group-hover:border-ink">
            <span className="h-1.5 w-0.5 rounded-full bg-sage-dark animate-scroll-dot" />
          </span>
          <span>Scroll to discover</span>
        </a>

        <div className="hidden items-center gap-2 rounded-full border border-cream/60 bg-cream/80 px-4 py-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink/75 backdrop-blur-md shadow-xs lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
          <span>Warm timber · Soft linen · Natural light</span>
        </div>
      </div>
    </section>
  )
}
