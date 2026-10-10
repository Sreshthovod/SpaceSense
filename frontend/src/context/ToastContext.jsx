import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { ToastContext } from './toast'

const ICONS = { success: CheckCircle2, info: Info, error: TriangleAlert }
const TONE = { success: 'text-sage-dark', info: 'text-brass', error: 'text-red-700' }
const MAX = 4
const EXIT_MS = 160

let nextId = 0

function ToastItem({ item, onDismiss }) {
  const Icon = ICONS[item.tone] ?? Info
  const [paused, setPaused] = useState(false)
  const remaining = useRef(item.duration)
  const startX = useRef(null)
  const [dx, setDx] = useState(0)

  // Auto-dismiss, paused while hovered or focused so it can be read.
  useEffect(() => {
    if (paused || item.leaving || !item.duration) return undefined
    const started = Date.now()
    const timer = setTimeout(() => onDismiss(item.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - started
    }
  }, [paused, item.leaving, item.duration, item.id, onDismiss])

  return (
    <li
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-white p-3 pr-2 text-sm text-ink shadow-lg ${item.leaving ? 'anim-out-right' : 'anim-from-right'}`}
      style={dx ? { transform: `translateX(${dx}px)`, opacity: Math.max(0, 1 - dx / 160) } : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      // Swipe right to dismiss on touch screens.
      onPointerDown={(e) => { if (e.pointerType !== 'mouse') startX.current = e.clientX }}
      onPointerMove={(e) => { if (startX.current !== null) setDx(Math.max(0, e.clientX - startX.current)) }}
      onPointerUp={() => {
        if (startX.current === null) return
        startX.current = null
        if (dx > 80) onDismiss(item.id)
        else setDx(0)
      }}
    >
      <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[item.tone] ?? TONE.info}`} />
      <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
      {item.action && (
        <button
          type="button"
          onClick={() => { item.action.onClick(); onDismiss(item.id) }}
          className="press shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-sage-dark hover:bg-sand"
        >
          {item.action.label}
        </button>
      )}
      <button type="button" onClick={() => onDismiss(item.id)} aria-label="Dismiss notification" className="shrink-0 rounded-full p-1 text-muted hover:bg-sand hover:text-ink">
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

/**
 * Small notifications in the corner: stacked, auto-dismissing, swipe or Esc to close, read out politely
 * by screen readers. Used for confirmations ("Link copied") — not for errors that need a decision.
 */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const dismiss = useCallback((id) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), EXIT_MS)
  }, [])

  const toast = useCallback((message, { tone = 'success', action = null, duration = 3800 } = {}) => {
    const id = ++nextId
    setItems((list) => [...list.slice(-(MAX - 1)), { id, message, tone, action, duration, leaving: false }])
    return id
  }, [])

  useEffect(() => {
    if (!items.length) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && document.activeElement?.closest?.('[data-toasts]')) {
        const last = items.at(-1)
        if (last) dismiss(last.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, dismiss])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <ol
          data-toasts=""
          aria-live="polite"
          aria-label="Notifications"
          className="pointer-events-none fixed bottom-20 right-4 z-[90] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        >
          {items.map((t) => <ToastItem key={t.id} item={t} onDismiss={dismiss} />)}
        </ol>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
