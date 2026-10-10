import { ArrowRight, ArrowUpRight } from 'lucide-react'

export default function Hero({ onStart }) {
  return (
    <section id="top" className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden">
      <img
        src="/images/hero.jpg"
        alt="Sunlit living room with warm wood panelling, a cream sofa and a low timber coffee table"
        width="1600" height="1067" fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_center]"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-cream via-cream/75 to-transparent lg:bg-gradient-to-r lg:from-cream/90 lg:from-0% lg:via-cream/55 lg:via-40% lg:to-transparent lg:to-65%" />

      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-20 pt-14 sm:px-8 lg:pb-24 lg:pt-20">
        <div className="reveal min-w-0 max-w-xl">
          <p className="eyebrow">AI-Powered Interior Design</p>
          <h1 className="mt-7 font-display text-ink">
            <span className="block text-[2.6rem] font-medium uppercase leading-none tracking-[0.045em] min-[420px]:text-5xl sm:text-6xl xl:text-7xl">Your space.</span>
            <em className="-mt-1 block pl-[0.6em] text-[3.4rem] font-light normal-case leading-[0.95] tracking-[-0.01em] text-sage-dark min-[420px]:text-7xl sm:text-8xl xl:text-[7rem]">Reimagined.</em>
          </h1>
          <p className="mt-8 max-w-md text-[1.0625rem] leading-relaxed text-ink/80">
            Transform your room into a space you love — personalized to your style, your budget, and the way you live.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href="#redesign" onClick={onStart} className="group inline-flex min-h-12 items-center gap-3 bg-brass px-8 py-4 text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-200 hover:bg-ink focus-visible:outline-brass">
              Redesign My Room <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <a href="#styles" className="inline-flex min-h-12 items-center gap-1.5 border-b border-transparent text-sm font-medium underline decoration-ink/40 underline-offset-[6px] transition-colors duration-200 hover:text-brass hover:decoration-brass">
              Explore design styles <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] tracking-[0.1em] text-ink/60">
            <span>Personalized design</span><span aria-hidden="true">·</span><span>Budget-conscious planning</span>
          </p>
        </div>
      </div>

    </section>
  )
}
