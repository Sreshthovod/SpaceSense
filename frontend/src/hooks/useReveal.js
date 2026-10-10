import { useEffect } from 'react'

// Fades in every `.reveal` element once it scrolls into view.
export default function useReveal(dep) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('js')
    const els = document.querySelectorAll('.reveal:not(.is-visible)')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target) }
      })
    }, { threshold: 0.12 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [dep])
}
