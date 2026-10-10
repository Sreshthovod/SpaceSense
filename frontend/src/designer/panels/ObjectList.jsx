import { useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff, ListTree, Lock, Pencil, Trash2, Unlock } from 'lucide-react'
import { itemSpec } from '../model/catalog'
import { WALL_LABELS } from '../model/design'

const icon = 'rounded p-1 text-muted hover:bg-sand hover:text-ink disabled:cursor-not-allowed disabled:opacity-30'

/**
 * Everything in the room. Select a row to select the object; rename it locally, hide it from view
 * (it still counts in the budget), lock it against accidental edits, or delete it.
 */
export default function ObjectList({ design, selected, onSelect, dispatch }) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(null) // { uid, name }
  const rows = [...design.items, ...design.openings]

  return (
    <section aria-labelledby="objects-heading" className="rounded-xl border border-line bg-white">
      <h3 id="objects-heading">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
          <ListTree aria-hidden="true" className="h-4 w-4 text-sage-dark" />
          <span className="flex-1 font-display text-lg font-semibold">In this room <span className="text-sm font-normal text-muted">({rows.length})</span></span>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      {open && (
        <div className="px-2 pb-2">
          {rows.length === 0 ? (
            <p className="px-1 pb-1 text-xs text-muted">Nothing placed yet.</p>
          ) : (
            <ul className="max-h-72 space-y-0.5 overflow-y-auto">
              {rows.map((item) => {
                const spec = itemSpec(item.catalogId)
                const name = item.label || spec?.name || 'Item'
                const where = item.wall ? WALL_LABELS[item.wall] : 'Floor'
                return (
                  <li key={item.uid} className={`flex items-center gap-0.5 rounded-lg px-1 ${item.uid === selected ? 'bg-sage/15' : ''}`}>
                    {renaming?.uid === item.uid ? (
                      <form
                        className="flex flex-1 items-center gap-1 py-1"
                        onSubmit={(e) => {
                          e.preventDefault()
                          dispatch({ type: 'setItemFlags', uid: item.uid, label: renaming.name })
                          setRenaming(null)
                        }}
                      >
                        <label htmlFor={`rename-item-${item.uid}`} className="sr-only">New name for {name}</label>
                        <input id={`rename-item-${item.uid}`} autoFocus value={renaming.name} maxLength={80} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} className="min-w-0 flex-1 rounded border border-line px-1.5 py-0.5 text-xs" />
                        <button type="submit" aria-label="Save name" className={icon}><Check aria-hidden="true" className="h-3.5 w-3.5" /></button>
                      </form>
                    ) : (
                      <button type="button" onClick={() => onSelect(item)} aria-pressed={item.uid === selected} className={`min-w-0 flex-1 py-1 text-left ${item.hidden ? 'opacity-50' : ''}`}>
                        <span className="block truncate text-xs font-medium">{name}</span>
                        <span className="block text-[10px] text-muted">{where}{item.hidden ? ' · hidden' : ''}{item.locked ? ' · locked' : ''}</span>
                      </button>
                    )}
                    <button type="button" className={icon} aria-label={`Rename ${name}`} onClick={() => setRenaming({ uid: item.uid, name: item.label || '' })}>
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className={icon} aria-pressed={item.hidden} aria-label={`${item.hidden ? 'Show' : 'Hide'} ${name}`} onClick={() => dispatch({ type: 'setItemFlags', uid: item.uid, hidden: !item.hidden })}>
                      {item.hidden ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" className={icon} aria-pressed={item.locked} aria-label={`${item.locked ? 'Unlock' : 'Lock'} ${name}`} onClick={() => dispatch({ type: 'setItemFlags', uid: item.uid, locked: !item.locked })}>
                      {item.locked ? <Lock aria-hidden="true" className="h-3.5 w-3.5" /> : <Unlock aria-hidden="true" className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" className={icon} disabled={item.locked} aria-label={`Delete ${name}`} onClick={() => dispatch({ type: 'removePlaced', uid: item.uid })}>
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-1 px-1 text-[10px] text-muted">Hidden items stay in your budget. Locked items can't be moved or deleted until unlocked.</p>
        </div>
      )}
    </section>
  )
}
