import { useEffect, useState } from 'react'

export default function useActiveSection(ids, enabled = true) {
  const [active, setActive] = useState(ids[0] || '')

  useEffect(() => {
    if (!enabled) return undefined
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!els.length) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActive(`#${visible.target.id}`)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [enabled, ids])

  return active
}
