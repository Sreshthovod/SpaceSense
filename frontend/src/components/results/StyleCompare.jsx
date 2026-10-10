import { useState } from 'react'
import { STYLES } from '../../data/sampleData'
import { styleScene } from '../../utils/styles'

export default function StyleCompare({ primary, compareStyle, onCompare, moodClassName }) {
  const [pos, setPos] = useState(50)
  const other = STYLES.filter((s) => s.id !== primary)
  const left = styleScene(primary)
  const right = styleScene(compareStyle || other[0]?.id)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold">Compare styles</h3>
          <p className="text-xs text-muted">Slide between your look and a second style on the same scene.</p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-muted">Second style</span>
          <select
            value={compareStyle || ''}
            onChange={(e) => onCompare(e.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2"
          >
            <option value="">Choose…</option>
            {other.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
      {compareStyle ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-line">
          <img src={right} alt="" className={`absolute inset-0 h-full w-full object-cover ${moodClassName}`} />
          <img src={left} alt="" className={`absolute inset-0 h-full w-full object-cover ${moodClassName}`} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <span className="absolute top-3 left-3 rounded bg-cream/90 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-widest">Yours</span>
          <span className="absolute top-3 right-3 rounded bg-ink/90 px-2 py-1 text-[0.65rem] font-semibold tracking-widest text-cream uppercase">Alt</span>
          <input
            type="range"
            min="0"
            max="100"
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Compare two styles"
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pos}%` }} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-sm text-muted">Pick a second style to compare on the same photograph.</p>
      )}
    </div>
  )
}
