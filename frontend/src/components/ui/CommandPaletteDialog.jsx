import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { filterCommands, isMac } from '../../utils/fuzzy'

/** The quick-action dialog itself, loaded the first time the palette opens. */
export default function Palette({ commands, onClose }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [closing, setClosing] = useState(false)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const returnTo = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const listId = useId()

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const results = useMemo(() => filterCommands(commands, query), [commands, query])
  // Group headers only when browsing; a search shows one ranked list.
  const rows = useMemo(() => results.map((cmd, i) => ({
    cmd,
    header: !query.trim() && (i === 0 || results[i - 1].group !== cmd.group) ? cmd.group : null,
  })), [results, query])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  const close = (after) => {
    setClosing(true)
    setTimeout(() => {
      onClose()
      const target = returnTo.current
      if (after) after()
      else target?.focus?.()
    }, 120)
  }

  const run = (cmd) => close(() => cmd.run())

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (results.length ? (a + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) run(results[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      e.preventDefault() // the input is the only stop; arrows move through results
    }
  }

  const mod = isMac() ? '⌘' : 'Ctrl'

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <div aria-hidden="true" onClick={() => close()} className={`absolute inset-0 bg-ink/40 backdrop-blur-[2px] ${closing ? 'anim-fade-out' : 'anim-fade'}`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick actions"
        className={`relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-2xl ${closing ? 'anim-scale-out' : 'anim-scale'}`}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden="true" className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            placeholder="Search actions, sections, settings…"
            aria-label="Search actions"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-muted">Esc</kbd>
        </div>
        <ul ref={listRef} id={listId} role="listbox" aria-label="Actions" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Nothing matches “{query}”.</li>}
          {rows.map(({ cmd, header }, i) => {
            const Icon = cmd.icon
            const selected = i === active
            return [
              header && <li key={`g-${header}`} role="presentation" className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{header}</li>,
              <li
                key={cmd.id}
                id={`${listId}-${cmd.id}`}
                role="option"
                aria-selected={selected}
                onMouseMove={() => setActive(i)}
                onClick={() => run(cmd)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${selected ? 'bg-sand text-ink' : 'text-ink/85'}`}
              >
                {Icon && <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 transition-colors ${selected ? 'text-sage-dark' : 'text-muted'}`} />}
                <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                {cmd.hint && <span className="text-xs text-muted">{cmd.hint}</span>}
                {selected && <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5 text-muted" />}
              </li>,
            ]
          })}
        </ul>
        <p className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span><kbd className="font-semibold">↑↓</kbd> move</span>
          <span><kbd className="font-semibold">Enter</kbd> run</span>
          <span className="ml-auto"><kbd className="font-semibold">{mod}+K</kbd> to open anywhere</span>
        </p>
      </div>
    </div>,
    document.body,
  )
}
