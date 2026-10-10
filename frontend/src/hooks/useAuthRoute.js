import { useEffect, useState } from 'react'

export const AUTH_ROUTES = ['login', 'signup', 'forgot-password', 'reset-password', 'verify-email', 'account']

/**
 * Parses the URL hash. Account pages live at `#/login`, `#/reset-password?token=...` and so on, so the
 * existing `#redesign`-style section links keep working and no server rewrite rules are needed.
 */
export function parseAuthHash(hash) {
  const match = /^#\/([a-z-]+)(?:\?(.*))?$/.exec(hash || '')
  if (!match || !AUTH_ROUTES.includes(match[1])) return null
  return { name: match[1], params: Object.fromEntries(new URLSearchParams(match[2] || '')) }
}

export const goTo = (name) => { window.location.hash = `#/${name}` }
export const leaveAuth = () => {
  // Drop the hash without leaving a "#" entry, then show the landing page.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export default function useAuthRoute() {
  const [route, setRoute] = useState(() => parseAuthHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseAuthHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
