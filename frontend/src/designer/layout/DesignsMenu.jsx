import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, FolderOpen, Pencil, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react'
import { deleteDesign, duplicateDesign, listDesigns, loadDesign, readLastCleared, renameDesign, saveDesign } from '../model/storage'
import ConfirmDialog from './ConfirmDialog'

const time = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const dateTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Saved versions of the room, kept in this browser: save, save as copy, open, rename, duplicate,
 * delete, reset and restore. Loading and resetting are ordinary edits, so Undo brings the previous
 * design back too.
 */
export default function DesignsMenu({ design, current, setCurrent, suggestedName, saveStatus, onLoad, onReset, onDialog }) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(() => listDesigns())
  const [name, setName] = useState(current.name || suggestedName)
  const [renaming, setRenaming] = useState(null) // { id, name }
  const [confirm, setConfirm] = useState(null) // { kind: 'delete' | 'reset', entry? }
  const [message, setMessage] = useState({ text: '', error: false })
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => { onDialog?.(Boolean(confirm)) }, [confirm, onDialog])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target) && !confirm) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, confirm])

  const run = (fn, success) => {
    try {
      fn()
      setList(listDesigns())
      setMessage({ text: success, error: false })
    } catch (err) {
      setMessage({ text: err.message, error: true })
    }
  }

  const save = (asCopy) => run(() => {
    const entry = saveDesign({ id: asCopy ? undefined : current.id, name, design })
    setCurrent({ id: entry.id, name: entry.name })
  }, asCopy ? `Saved a copy as “${name.trim() || 'Untitled design'}”.` : 'Saved.')

  const openDesign = (entry) => {
    const record = loadDesign(entry.id)
    if (!record || record.error) {
      setMessage({ text: record?.error || 'That design could not be found.', error: true })
      return
    }
    onLoad(record.design, entry)
    setName(entry.name)
    setMessage({ text: record.notices.length ? `Opened “${entry.name}”. ${record.notices.join(' ')}` : `Opened “${entry.name}”. Undo goes back to what you had.`, error: false })
  }

  const cleared = open ? readLastCleared() : null
  const status = saveStatus.error
    ? saveStatus.error
    : saveStatus.savedAt ? `Draft saved ${time(saveStatus.savedAt)}` : 'Draft saves automatically'

  return (
    <div className="sm:relative" onKeyDown={(e) => { if (e.key === 'Escape' && open && !confirm) { e.stopPropagation(); setOpen(false); buttonRef.current?.focus() } }}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="designs-panel"
        onClick={() => { setOpen((o) => !o); setList(listDesigns()); setMessage({ text: '', error: false }) }}
        className="flex max-w-[14rem] items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs hover:bg-sand"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{current.name || 'Unsaved design'}</span>
          <span className={`block truncate text-[10px] ${saveStatus.error ? 'text-clay' : 'text-muted'}`} data-testid="save-status">{status}</span>
        </span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      </button>

      {open && (
        <div ref={panelRef} id="designs-panel" role="region" aria-label="Your designs" className="absolute inset-x-4 top-full z-20 mt-2 rounded-2xl border border-line bg-white p-3 text-sm shadow-xl sm:inset-x-auto sm:right-0 sm:w-80">
          <label htmlFor="design-name" className="block text-xs font-semibold">Design name</label>
          <input
            id="design-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => save(false)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-ink/90">
              <Save aria-hidden="true" className="h-3.5 w-3.5" /> {current.id ? 'Save' : 'Save design'}
            </button>
            {current.id && (
              <button type="button" onClick={() => save(true)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-sand">
                <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Save as copy
              </button>
            )}
          </div>
          {message.text && <p role="status" className={`mt-2 text-xs ${message.error ? 'text-clay' : 'text-sage-dark'}`}>{message.text}</p>}

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Saved in this browser</p>
          {list.length === 0 ? (
            <p className="mt-1 text-xs text-muted">No saved designs yet. Save versions like “Living room — Minimal” to compare them.</p>
          ) : (
            <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto">
              {list.map((entry) => (
                <li key={entry.id} className={`rounded-lg border px-2 py-1.5 ${entry.id === current.id ? 'border-sage bg-sage/10' : 'border-line'}`}>
                  {renaming?.id === entry.id ? (
                    <form
                      className="flex gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        run(() => {
                          const updated = renameDesign(entry.id, renaming.name)
                          if (entry.id === current.id && updated) {
                            setCurrent({ id: updated.id, name: updated.name })
                            setName(updated.name)
                          }
                        }, 'Renamed.')
                        setRenaming(null)
                      }}
                    >
                      <label htmlFor={`rename-${entry.id}`} className="sr-only">New name for {entry.name}</label>
                      <input id={`rename-${entry.id}`} autoFocus value={renaming.name} maxLength={60} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} className="min-w-0 flex-1 rounded border border-line px-1.5 py-0.5 text-xs" />
                      <button type="submit" aria-label="Save name" className="rounded p-1 hover:bg-sand"><Check aria-hidden="true" className="h-3.5 w-3.5" /></button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openDesign(entry)} className="min-w-0 flex-1 text-left" aria-label={`Open ${entry.name}`}>
                        <span className="block truncate text-xs font-medium">{entry.name}</span>
                        <span className="block text-[10px] text-muted">{dateTime(entry.savedAt)}</span>
                      </button>
                      <button type="button" onClick={() => openDesign(entry)} aria-label={`Open ${entry.name}`} className="rounded p-1 text-muted hover:bg-sand hover:text-ink"><FolderOpen aria-hidden="true" className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setRenaming({ id: entry.id, name: entry.name })} aria-label={`Rename ${entry.name}`} className="rounded p-1 text-muted hover:bg-sand hover:text-ink"><Pencil aria-hidden="true" className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => run(() => duplicateDesign(entry.id, `${entry.name} (copy)`), 'Duplicated.')} aria-label={`Duplicate ${entry.name}`} className="rounded p-1 text-muted hover:bg-sand hover:text-ink"><Copy aria-hidden="true" className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setConfirm({ kind: 'delete', entry })} aria-label={`Delete ${entry.name}`} className="rounded p-1 text-muted hover:bg-sand hover:text-clay"><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            <button type="button" onClick={() => setConfirm({ kind: 'reset' })} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:border-clay hover:text-clay">
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" /> Reset design…
            </button>
            {cleared?.design && (
              <button type="button" onClick={() => { onLoad(cleared.design, null); setMessage({ text: 'Restored the cleared design.', error: false }) }} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-sand">
                <Undo2 aria-hidden="true" className="h-3.5 w-3.5" /> Restore cleared design
              </button>
            )}
          </div>
        </div>
      )}

      {confirm?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete this design?"
          message={`“${confirm.entry.name}” will be removed from this browser. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { entry } = confirm
            setConfirm(null)
            run(() => {
              deleteDesign(entry.id)
              if (entry.id === current.id) setCurrent({ id: null, name: null })
            }, `Deleted “${entry.name}”.`)
          }}
        />
      )}
      {confirm?.kind === 'reset' && (
        <ConfirmDialog
          title="Clear the room?"
          message="Everything you've placed, painted and chosen will be removed. You can undo this, or restore it later from this menu."
          confirmLabel="Clear room"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            run(onReset, 'Room cleared. Undo or “Restore cleared design” brings it back.')
          }}
        />
      )}
    </div>
  )
}
