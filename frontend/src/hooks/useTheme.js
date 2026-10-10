import { useCallback, useEffect, useSyncExternalStore } from 'react'

const KEY = 'spacesense-theme'
const listeners = new Set()

const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

function apply(theme) {
  document.documentElement.dataset.theme = theme
  listeners.forEach((notify) => notify())
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

/**
 * The light/dark theme. index.html sets `data-theme` before first paint (saved choice, else the system
 * setting); this hook reads it, lets the user flip it, remembers the choice, and keeps following the
 * system setting until the user has chosen.
 */
export default function useTheme() {
  const theme = useSyncExternalStore(subscribe, current, () => 'light')

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onSystem = () => { if (!savedTheme()) apply(query.matches ? 'dark' : 'light') }
    const onStorage = (e) => { if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) apply(e.newValue) }
    query?.addEventListener('change', onSystem)
    window.addEventListener('storage', onStorage) // another tab changed it
    return () => {
      query?.removeEventListener('change', onSystem)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setTheme = useCallback((next) => {
    apply(next)
    try { localStorage.setItem(KEY, next) } catch { /* see savedTheme */ }
  }, [])

  const toggle = useCallback(() => setTheme(current() === 'dark' ? 'light' : 'dark'), [setTheme])

  return { theme, setTheme, toggle }
}
