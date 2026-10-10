import { createContext, useContext } from 'react'

export const SIGNED_OUT = {
  user: null,
  loading: false,
  googleEnabled: false,
  emailEnabled: false,
  signup: async () => { throw new Error('AuthProvider is missing') },
  login: async () => { throw new Error('AuthProvider is missing') },
  logout: async () => {},
  refresh: async () => {},
}

// Components outside a provider (like the navbar in isolated tests) see a signed-out visitor.
export const AuthContext = createContext(SIGNED_OUT)

export const useAuth = () => useContext(AuthContext)
