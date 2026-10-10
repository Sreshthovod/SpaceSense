import { useEffect, useRef } from 'react'

/**
 * A small modal confirmation. Focus moves to the safe choice (Cancel), Tab stays inside, Esc cancels,
 * and focus returns to whatever opened it.
 */
export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, danger = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.querySelector('[data-cancel]')?.focus()
    return () => opener?.focus?.()
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const buttons = [...ref.current.querySelectorAll('button')]
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onKeyDown={onKeyDown}
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-xl"
      >
        <h2 id="confirm-title" className="font-display text-xl font-semibold">{title}</h2>
        <p id="confirm-message" className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" data-cancel onClick={onCancel} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-sand">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-cream ${danger ? 'bg-clay hover:bg-clay/90' : 'bg-ink hover:bg-ink/90'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
