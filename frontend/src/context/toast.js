import { createContext, useContext } from 'react'

// Outside a provider (isolated component tests) toasts are simply dropped.
export const ToastContext = createContext({ toast: () => {}, dismiss: () => {} })

/** `toast(message, { tone: 'success' | 'info' | 'error', action: { label, onClick }, duration })` */
export const useToast = () => useContext(ToastContext)
