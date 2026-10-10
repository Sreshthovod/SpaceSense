import { lazy, Suspense, useEffect } from 'react'

const Palette = lazy(() => import('./CommandPaletteDialog'))

/**
 * Cmd/Ctrl+K quick actions. `commands` are `{ id, label, group, keywords?, icon?, hint?, run }`.
 * Arrow keys move, Enter runs, Esc closes; focus returns to where it was.
 */
export default function CommandPalette({ commands, open, onOpenChange, enabled = true }) {
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, open, onOpenChange])

  // Mounted only while open, so every opening starts with an empty search.
  return open ? <Suspense fallback={null}><Palette commands={commands} onClose={() => onOpenChange(false)} /></Suspense> : null
}
