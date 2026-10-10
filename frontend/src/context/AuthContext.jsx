import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../services/authApi'
import { AuthContext } from './auth'

const LOADED = (data) => ({ user: data.user, loading: false, googleEnabled: !!data.google_enabled, emailEnabled: !!data.email_enabled })

/** Knows who is signed in. The session lives in an httpOnly cookie, so this only ever holds the public profile. */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true, googleEnabled: false, emailEnabled: false })

  const refresh = useCallback(
    () => api.getSession().then((data) => setState(LOADED(data))).catch(() => {
      // Backend unreachable: browse as a visitor. The planner works without an account.
      setState((s) => ({ ...s, user: null, loading: false }))
    }),
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    api.getSession(controller.signal)
      .then((data) => setState(LOADED(data)))
      .catch(() => { if (!controller.signal.aborted) setState((s) => ({ ...s, user: null, loading: false })) })
    return () => controller.abort()
  }, [])

  const value = useMemo(() => ({
    ...state,
    refresh,
    async signup(body) {
      const data = await api.signup(body)
      setState((s) => ({ ...s, user: data.user }))
      return data
    },
    async login(body) {
      const data = await api.login(body)
      setState((s) => ({ ...s, user: data.user }))
      return data
    },
    async logout() {
      try { await api.logout() } finally { setState((s) => ({ ...s, user: null })) }
    },
  }), [state, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
