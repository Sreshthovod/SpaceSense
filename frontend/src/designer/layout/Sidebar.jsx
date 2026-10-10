import { useRef } from 'react'

/**
 * The library sidebar: tabs (Furniture, Walls, Floor, Room) with arrow-key navigation. Panels stay
 * mounted so their state (search text, scroll) survives switching tabs.
 */
export default function Sidebar({ tabs, tab, setTab, idPrefix = 'lib' }) {
  const list = useRef(null)
  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.id === tab)
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const t = tabs[(next + tabs.length) % tabs.length]
    setTab(t.id)
    list.current?.querySelector(`#${idPrefix}-tab-${t.id}`)?.focus()
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={list} role="tablist" aria-label="Design library" onKeyDown={onKeyDown} className="flex shrink-0 gap-1 border-b border-line px-3 pt-2">
        {tabs.map((t) => {
          const Icon = t.icon
          const selected = t.id === tab
          return (
            <button
              key={t.id}
              id={`${idPrefix}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-2 pb-2 pt-1 text-xs font-semibold transition-colors duration-200 ${selected ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {t.label}
            </button>
          )
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${idPrefix}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-${t.id}`}
          hidden={t.id !== tab}
          className="anim-fade min-h-0 flex-1 overflow-y-auto p-4"
        >
          {t.content}
        </div>
      ))}
    </div>
  )
}
