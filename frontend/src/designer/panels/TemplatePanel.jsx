import { useEffect, useState } from 'react'
import { LayoutTemplate, SquareDashed } from 'lucide-react'
import { STYLES } from '../../data/sampleData'
import { styleLabel } from '../model/design'
import { TEMPLATE_ROOM_TYPES, buildTemplate, emptyRoom } from '../model/templates'
import { newUid } from '../model/ids'
import ConfirmDialog from '../layout/ConfirmDialog'

const select = 'mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark'

/**
 * Start again from a furnished starter room (a layout for the room type in a style, sized to this
 * room) or from an empty room. Either replaces what's placed, so it asks first when the room isn't
 * empty; both can be undone.
 */
export default function TemplatePanel({ design, roomType, onApply, onDialog }) {
  const [type, setType] = useState(TEMPLATE_ROOM_TYPES.includes(roomType) ? roomType : TEMPLATE_ROOM_TYPES[0])
  const [style, setStyle] = useState(design.style)
  const [pending, setPending] = useState(null) // 'template' | 'empty' awaiting confirmation
  const [message, setMessage] = useState('')
  const hasContent = design.items.length + design.openings.length > 0

  useEffect(() => { onDialog?.(Boolean(pending)) }, [pending, onDialog])

  const apply = (kind) => {
    if (kind === 'empty') {
      onApply(emptyRoom(design))
      setMessage('Started an empty room. Undo brings your last design back.')
      return
    }
    const { design: next, placed, skipped } = buildTemplate(design, type, style, newUid)
    onApply(next)
    const name = `${type} — ${styleLabel(style, STYLES.find((s) => s.id === style)?.name)}`
    setMessage(`${name}: ${placed} piece${placed === 1 ? '' : 's'} placed.${skipped ? ` ${skipped} didn't fit this room and ${skipped === 1 ? 'was' : 'were'} left out.` : ''} Products aren't chosen for you: pick them in the inspector.`)
  }
  const request = (kind) => (hasContent ? setPending(kind) : apply(kind))

  return (
    <section aria-labelledby="templates-heading" className="rounded-xl border border-line bg-white p-3">
      <h3 id="templates-heading" className="flex items-center gap-2 font-display text-lg font-semibold">
        <LayoutTemplate aria-hidden="true" className="h-4 w-4 text-sage-dark" /> Start from a template
      </h3>
      <p className="mt-1 text-xs text-muted">A starter layout sized to this room, finished in a style. Move, swap or delete anything afterwards.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold">
          Room type
          <select value={type} onChange={(e) => setType(e.target.value)} className={select}>
            {TEMPLATE_ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold">
          Template style
          <select value={style} onChange={(e) => setStyle(e.target.value)} className={select}>
            {STYLES.map((s) => <option key={s.id} value={s.id}>{styleLabel(s.id, s.name)}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => request('template')} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-ink/90">
          <LayoutTemplate aria-hidden="true" className="h-3.5 w-3.5" /> Use template
        </button>
        <button type="button" onClick={() => request('empty')} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-sand">
          <SquareDashed aria-hidden="true" className="h-3.5 w-3.5" /> Empty room
        </button>
      </div>
      {message && <p role="status" className="mt-2 text-xs text-sage-dark">{message}</p>}
      {pending && (
        <ConfirmDialog
          title={pending === 'empty' ? 'Start with an empty room?' : `Replace this room with the ${type.toLowerCase()} template?`}
          message="Everything you've placed, painted and chosen will be replaced. You can undo this, or restore it later from the Designs menu."
          confirmLabel={pending === 'empty' ? 'Empty the room' : 'Use template'}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const kind = pending
            setPending(null)
            apply(kind)
          }}
        />
      )}
    </section>
  )
}
