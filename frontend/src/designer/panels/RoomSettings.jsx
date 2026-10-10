import { useState } from 'react'
import { Ruler } from 'lucide-react'
import { DIMENSIONS, DIMENSION_LABELS, DIMENSION_LIMITS } from '../model/design'

export function SourceBadge({ source }) {
  return source === 'measured' ? (
    <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[11px] font-semibold text-sage-dark">Measured</span>
  ) : (
    <span className="rounded-full bg-[#f4e3d7] px-2 py-0.5 text-[11px] font-semibold text-clay">Estimated</span>
  )
}

function DimensionField({ id, dim, onValue, onSource }) {
  const [min, max] = DIMENSION_LIMITS[id]
  const [draft, setDraft] = useState(null) // text while typing; null shows the stored value
  const n = Number(draft)
  const error = draft !== null && (draft === '' || !Number.isFinite(n) || n < min || n > max)
    ? `Enter ${min}–${max} ft.`
    : ''

  const change = (text) => {
    setDraft(text)
    const v = Number(text)
    if (text !== '' && Number.isFinite(v) && v >= min && v <= max) onValue(v)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={`dim-${id}`} className="text-sm font-semibold">{DIMENSION_LABELS[id]}</label>
        <SourceBadge source={dim.source} />
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            id={`dim-${id}`}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step="0.5"
            value={draft ?? dim.value}
            onChange={(e) => change(e.target.value)}
            onBlur={() => setDraft(null)}
            aria-invalid={!!error}
            aria-describedby={error ? `dim-${id}-error` : undefined}
            className={`w-full rounded-xl border bg-white py-2 pl-3 pr-9 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark ${error ? 'border-red-400' : 'border-line'}`}
          />
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">ft</span>
        </div>
        <button
          type="button"
          onClick={() => onSource(dim.source === 'measured' ? 'estimated' : 'measured')}
          aria-label={`Mark ${DIMENSION_LABELS[id].toLowerCase()} as ${dim.source === 'measured' ? 'estimated' : 'measured'}`}
          className="shrink-0 rounded-full border border-line px-2.5 py-1.5 text-xs hover:bg-sand"
        >
          {dim.source === 'measured' ? 'Mark estimated' : 'Mark measured'}
        </button>
      </div>
      {error && <p id={`dim-${id}-error`} role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}

export default function RoomSettings({ design, dispatch, photoUrl }) {
  const { room } = design
  const area = room.width.value * room.length.value

  return (
    <div className="space-y-6">
      <section aria-labelledby="room-size-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <Ruler aria-hidden="true" className="h-4 w-4 text-sage-dark" />
          <h3 id="room-size-heading" className="font-display text-xl font-semibold">Room size</h3>
        </div>
        {DIMENSIONS.map((key) => (
          <DimensionField
            key={key}
            id={key}
            dim={room[key]}
            onValue={(value) => dispatch({ type: 'setDimension', key, value, coalesce: `dim:${key}` })}
            onSource={(source) => dispatch({ type: 'setDimensionSource', key, source })}
          />
        ))}
        <p className="text-xs text-muted">
          Floor area {area.toLocaleString('en-IN', { maximumFractionDigits: 1 })} sq ft. <strong className="font-semibold text-ink">Measured</strong> means you entered it;
          <strong className="font-semibold text-ink"> estimated</strong> values are placeholders to check with a tape measure.
        </p>
      </section>

      {!photoUrl && design.photo && (
        <p className="border-t border-line pt-5 text-xs text-muted">
          This design was made with your photo “{design.photo.name}”. Photos aren't stored with saved designs, so it isn't shown here.
        </p>
      )}
      {photoUrl && (
        <section aria-labelledby="photo-ref-heading" className="border-t border-line pt-5">
          <h3 id="photo-ref-heading" className="font-display text-xl font-semibold">Your photo</h3>
          <img src={photoUrl} alt="Your room photo, for reference" className="mt-3 aspect-[4/3] w-full rounded-xl border border-line object-cover" />
          <p className="mt-2 text-xs text-muted">For reference only. The 3D room is built from the dimensions above, not reconstructed from the photo.</p>
        </section>
      )}
    </div>
  )
}
