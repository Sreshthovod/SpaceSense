import { useState } from 'react'
import { FLOOR_MATERIALS } from '../model/design'
import { FLOOR_ROTATIONS, FLOOR_SCALE, FLOOR_SHEENS, WALLPAPERS, WALL_PALETTES, WALL_SHEENS } from '../model/finishes'

function Chips({ legend, name, value, options, onPick }) {
  return (
    <fieldset>
      <legend className="mb-1 text-[11px] font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map(([id, label]) => (
          <label key={id} className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sage-dark ${value === id ? 'border-ink bg-ink text-cream' : 'border-line bg-white hover:bg-sand'}`}>
            <input type="radio" name={name} value={id} checked={value === id} onChange={() => onPick(id)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Swatches({ name, colors, value, onPick }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((c) => (
        <label key={c} className="cursor-pointer" title={c}>
          <input type="radio" name={name} checked={value === c} onChange={() => onPick(c)} className="peer sr-only" />
          <span className="block h-7 w-7 rounded-full border border-black/15 ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-sage-dark" style={{ background: c }} />
          <span className="sr-only">{c}</span>
        </label>
      ))}
    </div>
  )
}

/** Paint or wallpaper for one wall (an accent wall) or all walls at once. */
export function WallFinishPanel({ walls, wall, dispatch }) {
  const current = wall === 'all' ? walls.back : walls[wall]
  const mixed = wall === 'all' && new Set(Object.values(walls).map((w) => JSON.stringify(w))).size > 1
  const [palette, setPalette] = useState('neutral')
  const set = (changes, coalesce) => dispatch({ type: 'setWallFinish', wall, ...changes, ...(coalesce ? { coalesce } : {}) })
  const name = `wall-${wall}`
  return (
    <div className="space-y-3">
      {mixed && <p className="text-[11px] text-muted">Your walls have different finishes; choices here apply to all four. Open a wall to style it on its own.</p>}
      <Chips legend="Finish" name={`${name}-kind`} value={current.kind} options={[['paint', 'Paint'], ['wallpaper', 'Wallpaper']]} onPick={(kind) => set({ kind })} />
      <fieldset>
        <legend className="mb-1 text-[11px] font-semibold">{current.kind === 'wallpaper' ? 'Wallpaper colour' : 'Paint colour'}</legend>
        <div role="group" aria-label="Palette" className="mb-1.5 flex gap-1">
          {WALL_PALETTES.map((p) => (
            <button key={p.id} type="button" aria-pressed={palette === p.id} onClick={() => setPalette(p.id)} className={`rounded-full px-2 py-0.5 text-[11px] ${palette === p.id ? 'bg-sand font-semibold' : 'text-muted hover:text-ink'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <Swatches name={`${name}-colour`} colors={WALL_PALETTES.find((p) => p.id === palette).colors} value={current.color} onPick={(color) => set({ color }, `paint:${wall}`)} />
        <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          <input type="color" value={current.color} onChange={(e) => set({ color: e.target.value }, `paint:${wall}`)} className="h-7 w-7 cursor-pointer rounded border border-line bg-white p-0.5" />
          Any colour
        </label>
      </fieldset>
      {current.kind === 'wallpaper' ? (
        <Chips legend="Pattern" name={`${name}-pattern`} value={current.pattern} options={Object.entries(WALLPAPERS).map(([id, w]) => [id, w.label])} onPick={(pattern) => set({ pattern })} />
      ) : (
        <Chips legend="Sheen" name={`${name}-sheen`} value={current.sheen} options={Object.entries(WALL_SHEENS).map(([id, s]) => [id, s.label])} onPick={(sheen) => set({ sheen })} />
      )}
    </div>
  )
}

/** Floor material, colour, pattern direction and size, and finish. */
export function FloorFinishPanel({ floor, dispatch }) {
  const set = (changes, coalesce) => dispatch({ type: 'setFloor', ...changes, ...(coalesce ? { coalesce } : {}) })
  return (
    <div className="space-y-3">
      <Chips legend="Material" name="floor-material" value={floor.material} options={Object.entries(FLOOR_MATERIALS).map(([id, m]) => [id, m.label])} onPick={(material) => set({ material })} />
      <label className="flex items-center gap-1.5 text-[11px] text-muted">
        <input type="color" value={floor.color} onChange={(e) => set({ color: e.target.value }, 'floor-colour')} className="h-7 w-7 cursor-pointer rounded border border-line bg-white p-0.5" />
        Floor colour
      </label>
      <Chips legend="Pattern direction" name="floor-rotation" value={String(floor.rotation || 0)} options={FLOOR_ROTATIONS.map((r) => [String(r), `${r}°`])} onPick={(r) => set({ rotation: Number(r) })} />
      <label className="block text-[11px] font-semibold">
        Pattern size {Math.round((floor.scale || 1) * 100)}%
        <input
          type="range"
          min={FLOOR_SCALE[0] * 100}
          max={FLOOR_SCALE[1] * 100}
          step="10"
          value={Math.round((floor.scale || 1) * 100)}
          onChange={(e) => set({ scale: Number(e.target.value) / 100 }, 'floor-scale')}
          className="mt-1 block w-full accent-sage-dark"
        />
      </label>
      <Chips legend="Finish" name="floor-sheen" value={floor.sheen} options={Object.entries(FLOOR_SHEENS).map(([id, s]) => [id, s.label])} onPick={(sheen) => set({ sheen })} />
    </div>
  )
}
