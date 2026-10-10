import { useState } from 'react'
import { AlignVerticalJustifyStart, Copy, Lock, RotateCcw, Trash2, Unlock, X } from 'lucide-react'
import { FLOOR_CATEGORIES, floorItemSpec } from '../model/catalog'
import { roomSize } from '../model/design'
import { floorHalfExtents, footprint } from '../model/floorPlacement'
import { formatFeet } from '../model/wallPlacement'
import ProductPicker from './ProductPicker'

const tool = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40'

function Field({ id, label, value, onCommit, suffix = 'ft', step = 0.25, disabled }) {
  const [draft, setDraft] = useState(null)
  const commit = (text) => {
    const v = Number(text)
    if (text !== '' && Number.isFinite(v)) onCommit(v)
    setDraft(null)
  }
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-semibold">{label}</label>
      <div className="relative mt-0.5">
        <input
          id={id}
          type="number"
          step={step}
          disabled={disabled}
          value={draft ?? Math.round(value * 100) / 100}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget.value) }}
          className="w-full rounded-lg border border-line bg-white py-1 pl-2 pr-7 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark disabled:bg-sand disabled:text-muted"
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">{suffix}</span>
      </div>
    </div>
  )
}

function NameField({ item, placeholder, dispatch }) {
  const [draft, setDraft] = useState(null)
  const commit = () => {
    if (draft !== null) dispatch({ type: 'setItemFlags', uid: item.uid, label: draft })
    setDraft(null)
  }
  return (
    <div>
      <label htmlFor={`name-${item.uid}`} className="sr-only">Name</label>
      <input
        id={`name-${item.uid}`}
        value={draft ?? (item.label || '')}
        placeholder={placeholder}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold hover:border-line focus:border-sage-dark focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-dark"
      />
    </div>
  )
}

/**
 * The selected floor item. Only the controls the item supports are shown: a size slider for
 * resizable pieces, colours for upholstered or woven ones. Locked items show their settings but
 * can't be changed until unlocked.
 */
export default function Inspector({ item, design, mode, dispatch, onDuplicate, onDelete, onDeselect, catalog, catalogError }) {
  const spec = floorItemSpec(item.catalogId)
  const size = roomSize(design)
  const dims = footprint(item)
  const { hx, hz } = floorHalfExtents(item)
  const locked = item.locked
  const update = (changes, coalesce) => dispatch({ type: 'updatePlaced', uid: item.uid, changes, ...(coalesce ? { coalesce } : {}) })
  const category = FLOOR_CATEGORIES.find((c) => c.id === spec.category)?.label

  return (
    <section aria-labelledby="inspector-title" className="rounded-xl border border-sage bg-white p-3">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <h3 id="inspector-title" className="sr-only">{item.label || spec.name}</h3>
          <NameField item={item} placeholder={spec.name} dispatch={dispatch} />
          <p className="px-1 text-[11px] text-muted">{category}{item.label ? ` · ${spec.name}` : ''}</p>
        </div>
        <button type="button" onClick={onDeselect} aria-label="Deselect" className="rounded-full p-1 hover:bg-sand">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {locked && <p className="mt-2 rounded-lg bg-sand px-2 py-1 text-[11px]">Locked: unlock it to move or change it.</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field id={`left-${item.uid}`} label="From left wall" value={item.x + size.width / 2 - hx} disabled={locked} onCommit={(v) => update({ x: v - size.width / 2 + hx })} />
        <Field id={`back-${item.uid}`} label="From back wall" value={item.z + size.length / 2 - hz} disabled={locked} onCommit={(v) => update({ z: v - size.length / 2 + hz })} />
      </div>

      <div className={`mt-3 rounded-lg ${mode === 'rotate' ? 'bg-sage/10 p-2' : ''}`}>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-[11px] font-semibold">
            Rotation
            <input
              type="range"
              min="0"
              max="345"
              step="15"
              value={Math.round(item.rotation / 15) * 15 % 360}
              disabled={locked}
              onChange={(e) => update({ rotation: Number(e.target.value) }, `rotate:${item.uid}`)}
              className="mt-1 block w-full accent-sage-dark"
              aria-valuetext={`${item.rotation} degrees`}
            />
          </label>
          <div className="w-20"><Field id={`rot-${item.uid}`} label="Degrees" suffix="°" step={15} value={item.rotation} disabled={locked} onCommit={(v) => update({ rotation: v })} /></div>
        </div>
        <button type="button" className={`${tool} mt-2`} disabled={locked || item.rotation === 0} onClick={() => update({ rotation: 0 })}>
          <RotateCcw aria-hidden="true" className="h-3 w-3" /> Reset rotation
        </button>
      </div>

      <p className="mt-3 text-[11px] text-muted">
        Size {formatFeet(dims.w)} wide × {formatFeet(dims.d)} deep{dims.h >= 1 / 12 ? ` × ${formatFeet(dims.h)} high` : ''}
        {item.elevation ? ` · on a surface ${formatFeet(item.elevation)} up` : ''}
      </p>
      {spec.scale && (
        <label className="mt-1 block text-[11px] font-semibold">
          Scale {Math.round((item.scale || 1) * 100)}%
          <input
            type="range"
            min={spec.scale[0] * 100}
            max={spec.scale[1] * 100}
            step="5"
            value={Math.round((item.scale || 1) * 100)}
            disabled={locked}
            onChange={(e) => update({ scale: Number(e.target.value) / 100 }, `scale:${item.uid}`)}
            className="mt-1 block w-full accent-sage-dark"
          />
        </label>
      )}

      {spec.colors && (
        <fieldset className="mt-3" disabled={locked}>
          <legend className="text-[11px] font-semibold">Colour</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {spec.colors.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name={`colour-${item.uid}`} checked={(item.color || spec.color) === c} onChange={() => dispatch({ type: 'setItemColor', uid: item.uid, color: c })} className="peer sr-only" />
                <span className="block h-6 w-6 rounded-full border border-black/15 ring-offset-1 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-sage-dark" style={{ background: c }} />
                <span className="sr-only">{c}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted">Colours the 3D shape only; a product's real colour is in its listing.</p>
        </fieldset>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <ProductPicker item={item} catalog={catalog} catalogError={catalogError} dispatch={dispatch} disabled={locked} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        <button type="button" className={tool} disabled={locked} onClick={() => dispatch({ type: 'alignToWall', uid: item.uid })}>
          <AlignVerticalJustifyStart aria-hidden="true" className="h-3 w-3" /> Align to wall
        </button>
        <button type="button" className={tool} onClick={onDuplicate}><Copy aria-hidden="true" className="h-3 w-3" /> Duplicate</button>
        <button
          type="button"
          className={tool}
          aria-pressed={locked}
          onClick={() => dispatch({ type: 'setItemFlags', uid: item.uid, locked: !locked })}
        >
          {locked ? <Unlock aria-hidden="true" className="h-3 w-3" /> : <Lock aria-hidden="true" className="h-3 w-3" />} {locked ? 'Unlock' : 'Lock'}
        </button>
        <button type="button" className={tool} disabled={locked} onClick={onDelete}><Trash2 aria-hidden="true" className="h-3 w-3" /> Delete</button>
      </div>
      <p className="mt-2 text-[10px] text-muted">
        {mode === 'move' ? 'Drag it in the view to move it.' : mode === 'rotate' ? 'Drag left or right in the view to turn it.' : 'Press M to move it by dragging, E to turn it.'} Arrow keys nudge (Shift for 1 ft).
      </p>
    </section>
  )
}
