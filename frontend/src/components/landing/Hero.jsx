import { useEffect, useRef } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

export default function Hero({ onStart, onOpenDesigner }) {
  const reduced = usePrefersReducedMotion()
  const photoRef = useRef(null)

  useEffect(() => {
    if (reduced) return undefined
    const el = photoRef.current
    if (!el) return undefined
    const onScroll = () => {
      el.style.transform = `translate3d(0, ${Math.min(80, window.scrollY * 0.18)}px, 0)`
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced])

  return (
    <section id="top" className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden">
      <div ref={photoRef} className="absolute inset-0 -z-20 overflow-hidden">
        <img
          src="/images/hero.jpg"
          alt="Sunlit living room with warm wood panelling, a cream sofa and a low timber coffee table"
          width="1600"
          height="1067"
          fetchPriority="high"
          className="hero-photo h-[115%] w-full object-cover object-[65%_center]"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-cream/88 via-cream/45 to-transparent lg:from-cream/80 lg:via-cream/35 lg:to-transparent"
      />

      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-16 pt-10 sm:px-8 lg:pb-20 lg:pt-14">
        <div className="hero-stagger min-w-0 max-w-xl">
          <p className="eyebrow">AI-Powered Interior Design</p>
          <h1 className="mt-6 font-display text-ink">
            <span className="block text-[2.35rem] font-medium uppercase leading-none tracking-[0.04em] min-[420px]:text-5xl sm:text-6xl">Your space.</span>
            <em className="mt-1 block text-[3.1rem] font-light leading-[0.95] text-sage-dark min-[420px]:text-6xl sm:text-7xl lg:text-8xl">Reimagined.</em>
          </h1>
          <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-ink/80">
            Upload a photo of your room and get clear, written design advice shaped around your style and budget. Edit your photo or try the 3D designer only if you want to.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a
              href="#redesign"
              onClick={onStart}
              className="group inline-flex min-h-12 items-center gap-3 bg-brass px-8 py-4 text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-200 hover:bg-ink"
            >
              Plan My Room <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <a href="#styles" className="inline-flex min-h-12 items-center gap-1.5 text-sm font-medium underline decoration-ink/40 underline-offset-[6px] transition-colors hover:text-brass hover:decoration-brass">
              Explore design styles <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
            {onOpenDesigner && (
              <button type="button" onClick={onOpenDesigner} className="inline-flex min-h-12 items-center gap-1.5 text-sm font-medium underline decoration-ink/40 underline-offset-[6px] transition-colors hover:text-brass hover:decoration-brass">
                Try the 3D designer <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] tracking-[0.1em] text-ink/60">
            <span>Advice first</span>
            <span aria-hidden="true">·</span>
            <span>Your photo is never edited without approval</span>
          </p>
        </div>
      </div>
    </section>
  )
}
