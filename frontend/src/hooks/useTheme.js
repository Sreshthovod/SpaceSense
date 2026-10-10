import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { prefersReducedMotion } from '../utils/motion'

const KEY = 'spacesense-theme'
const listeners = new Set()
const notifyAll = () => listeners.forEach((notify) => notify())

const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

// The address-bar / app-switcher colour follows the page colour.
const CHROME = { light: '#f7f5f0', dark: '#161713' }

function apply(theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[theme])
  notifyAll()
}

/**
 * Switches with an expanding circle from `origin` ({x, y} in viewport pixels) where View Transitions
 * exist; otherwise the body's colour transition does a plain fade. Instant with reduced motion.
 */
function applyAnimated(theme, origin) {
  const root = document.documentElement
  if (!origin || !document.startViewTransition || prefersReducedMotion() || theme === current()) {
    apply(theme)
    return
  }
  root.classList.add('theme-vt')
  let transition
  try {
    transition = document.startViewTransition(() => apply(theme))
  } catch {
    root.classList.remove('theme-vt')
    apply(theme)
    return
  }
  const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))
  transition.ready
    .then(() => root.animate(
      { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
      { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
    ))
    .catch(() => {})
  transition.finished.finally(() => root.classList.remove('theme-vt'))
}

const subscribe = (notify) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

function savedTheme() {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null // storage blocked (private window): the choice just lasts for this visit
  }
}

// 'light' | 'dark' | 'system' (nothing saved: follow the operating system).
const currentPreference = () => savedTheme() ?? 'system'

/**
 * The light/dark theme. index.html sets `data-theme` before first paint (saved choice, else the system
 * setting); this hook reads it, lets the user flip it or go back to following the system, remembers the
 * choice, and keeps following the system setting until the user has chosen.
 */
export default function useTheme() {
  const theme = useSyncExternalStore(subscribe, current, () => 'light')
  const preference = useSyncExternalStore(subscribe, currentPreference, () => 'system')

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onSystem = () => { if (!savedTheme()) apply(query.matches ? 'dark' : 'light') }
    const onStorage = (e) => {
      if (e.key !== KEY) return
      if (e.newValue === 'light' || e.newValue === 'dark') apply(e.newValue)
      else if (e.newValue === null) apply(systemTheme())
    }
    query?.addEventListener('change', onSystem)
    window.addEventListener('storage', onStorage) // another tab changed it
    return () => {
      query?.removeEventListener('change', onSystem)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  /** `next` is 'light', 'dark' or 'system'. `origin` (optional) is where the reveal circle starts. */
  const setTheme = useCallback((next, origin) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch { /* see savedTheme */ }
    applyAnimated(next === 'system' ? systemTheme() : next, origin)
    notifyAll() // the preference can change without the theme changing
  }, [])

  const toggle = useCallback((origin) => setTheme(current() === 'dark' ? 'light' : 'dark', origin), [setTheme])

  return { theme, preference, setTheme, toggle }
}
