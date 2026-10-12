import { useEffect, useState } from 'react'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

const KEY = 'spacesense-intro'

const seen = () => {
  try {
    return !!sessionStorage.getItem(KEY)
  } catch {
    return true // storage blocked: skip the intro rather than replay it on every load
  }
}

/** A brief wordmark curtain on the first visit of a session. Decorative; it never takes clicks. */
export default function IntroCurtain() {
  const reduced = usePrefersReducedMotion()
  const [show, setShow] = useState(() => !seen())
  useEffect(() => {
    try { sessionStorage.setItem(KEY, '1') } catch { /* blocked: nothing to remember */ }
  }, [])
  if (!show || reduced) return null
  return (
    <div
      aria-hidden="true"
      className="intro-curtain"
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) setShow(false) }}
    >
      <span className="intro-mark font-display">SpaceSense</span>
      <span className="intro-line" />
    </div>
  )
}
