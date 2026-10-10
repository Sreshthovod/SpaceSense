import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

/** How far down the page the reader is, 0–1. One rAF-throttled passive listener for both widgets. */
function useScrollProgress() {
  const [progress, setProgress] = useState(0)
  const frame = useRef(0)
  useEffect(() => {
    const measure = () => {
      frame.current = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
    }
    const onScroll = () => { if (!frame.current) frame.current = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return progress
}

const RING = 2 * Math.PI * 20

/** A thin reading-progress bar under the navbar and a back-to-top button with a progress ring. */
export default function ScrollExtras() {
  const progress = useScrollProgress()
  const reduced = usePrefersReducedMotion()
  const show = progress > 0.12

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
        <div className="h-full origin-left bg-gradient-to-r from-sage to-brass" style={{ transform: `scaleX(${progress})` }} />
      </div>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
        aria-label="Back to top"
        tabIndex={show ? 0 : -1}
        aria-hidden={!show}
        className={`press fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white/90 text-ink shadow-lg backdrop-blur transition-all duration-300 ease-[var(--ease-out)] hover:bg-sand ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" />
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-sage-dark)" strokeWidth="2" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - progress)} />
        </svg>
        <ArrowUp aria-hidden="true" className="h-4 w-4" />
      </button>
    </>
  )
}
