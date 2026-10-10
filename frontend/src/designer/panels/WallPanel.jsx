import { useState } from 'react'
import { AppWindow, DoorOpen, Frame, Lamp, Plus, Rows3, Circle, PanelsTopLeft } from 'lucide-react'
import { PAINTS, WALL_LABELS, findPlaced, roomSize, wallDims } from '../model/design'
import { OPENING_IDS, WALL_DECOR_IDS, WALL_ITEMS } from '../model/catalog'
import { formatFeet, halfExtents, measurements } from '../model/wallPlacement'

const ICONS = { painting: Frame, mirror: Circle, shelf: Rows3, sconce: Lamp, panel: PanelsTopLeft, door: DoorOpen, window: AppWindow }

function NumberInput({ id, label, value, onCommit, step = 0.25, min, max, suffix = 'ft', disabled }) {
  const [draft, setDraft] = useState(null)
  const commit = (text) => {
    const v = Number(text)
    if (text !== '' && Number.isFinite(v)) onCommit(v)
    setDraft(null)
  }
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold">{label}</label>
      <div className="relative mt-1">
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          value={draft ?? Math.round(value * 100) / 100}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget.value) }}
          className="w-full rounded-lg border border-line bg-white py-1.5 pl-2.5 pr-8 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark disabled:bg-sand disabled:text-muted"
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted">{suffix}</span>
      </div>
    </div>
  )
}

function AddButtons({ title, ids, onAdd }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {ids.map((id) => {
          const Icon = ICONS[id] || Plus
          return (
            <button key={id} type="button" onClick={() => onAdd(id)} className="flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-2 text-left text-xs font-medium hover:border-sage hover:bg-sand/50">
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-sage-dark" />
              <span>Add {WALL_ITEMS[id].name.toLowerCase()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Inspector({ item, wall, dispatch }) {
  const spec = WALL_ITEMS[item.catalogId]
  const m = measurements(item, wall)
  const { hw, hh } = halfExtents(item)
  const update = (changes) => dispatch({ type: 'updatePlaced', uid: item.uid, changes })
  return (
    <section aria-labelledby="inspector-heading" className="rounded-xl border border-line bg-white p-3">
      <h4 id="inspector-heading" className="text-sm font-semibold">{spec.name}</h4>
      <p className="mt-0.5 text-[11px] text-muted">
        {formatFeet(m.fromLeft)} from the left corner · {formatFeet(m.fromRight)} from the right · {formatFeet(m.fromFloor)} above the floor · {formatFeet(m.fromCeiling)} below the ceiling
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberInput id="wi-left" label="From left corner" value={m.fromLeft} onCommit={(v) => update({ x: v + hw })} />
        <NumberInput id="wi-floor" label="Above floor" value={m.fromFloor} onCommit={(v) => update({ y: v + hh })} disabled={spec.floorLocked} />
        <NumberInput id="wi-width" label="Width" value={item.w} onCommit={(v) => update(spec.lockAspect ? { w: v, h: v * (item.h / item.w) } : { w: v })} disabled={spec.resize === 'none'} min={spec.min.w} max={spec.max.w} />
        <NumberInput id="wi-height" label="Height" value={item.h} onCommit={(v) => update(spec.lockAspect ? { h: v, w: v * (item.w / item.h) } : { h: v })} disabled={spec.resize !== 'both'} min={spec.min.h} max={spec.max.h} />
        {spec.rotatable && (
          <NumberInput id="wi-rotation" label="Rotation" value={item.rotation} onCommit={(v) => update({ rotation: v })} step={15} suffix="°" />
        )}
      </div>
      {spec.floorLocked && <p className="mt-2 text-[11px] text-muted">Doors always stand on the floor.</p>}
    </section>
  )
}

export default function WallPanel({ design, wallId, selected, dispatch, onAdd }) {
  const wall = wallDims(roomSize(design), wallId)
  const found = selected ? findPlaced(design, selected) : null
  const item = found?.item.wall === wallId ? found.item : null
  const color = design.walls[wallId].color

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Decorating</p>
        <h3 className="mt-1 font-display text-2xl font-semibold">{WALL_LABELS[wallId]}</h3>
      </div>
      {item ? <Inspector item={item} wall={wall} dispatch={dispatch} /> : (
        <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">Select an item on the wall to set its exact position and size.</p>
      )}
      <AddButtons title="Wall décor" ids={WALL_DECOR_IDS} onAdd={onAdd} />
      <AddButtons title="Doors and windows" ids={OPENING_IDS} onAdd={onAdd} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Paint this wall</legend>
        <div className="flex flex-wrap items-center gap-2">
          {PAINTS.map((p) => (
            <label key={p.id} title={p.label} className="cursor-pointer">
              <input type="radio" name="this-wall-paint" value={p.color} checked={color === p.color} onChange={() => dispatch({ type: 'setWallColor', wall: wallId, color: p.color })} className="peer sr-only" />
              <span className="block h-7 w-7 rounded-full border border-black/15 ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-sage-dark" style={{ background: p.color }} />
              <span className="sr-only">{p.label}</span>
            </label>
          ))}
          <label className="ml-1 flex items-center gap-1.5 text-xs text-muted">
            <input type="color" value={color} onChange={(e) => dispatch({ type: 'setWallColor', wall: wallId, color: e.target.value })} className="h-7 w-7 cursor-pointer rounded border border-line bg-white p-0.5" />
            Custom
          </label>
        </div>
      </fieldset>
    </div>
  )
}
