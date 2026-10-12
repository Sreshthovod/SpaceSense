import { useEffect, useState } from 'react'

export default function useNavCompact(threshold = 24) {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return compact
}

/** True while the reader is scrolling down past `after` px, so the header can tuck away; scrolling up brings it back. */
export function useNavTucked(after = 480) {
  const [tucked, setTucked] = useState(false)

  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const measure = () => {
      frame = 0
      const y = window.scrollY
      if (Math.abs(y - last) < 6) return
      setTucked(y > after && y > last)
      last = y
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [after])

  return tucked
}
