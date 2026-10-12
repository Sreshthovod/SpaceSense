import { useState } from 'react'
import { STYLES } from '../../data/sampleData'
import { moodClass, styleScene } from '../../utils/styles'

export default function BeforeAfter({ originalUrl, styleId, mood, lighting }) {
  const [pos, setPos] = useState(58)
  const style = STYLES.find((s) => s.id === styleId)
  const grade = moodClass(mood, lighting)

  return (
    <div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line">
        <img src={styleScene(styleId)} alt="" className={`shutter-in absolute inset-0 h-full w-full object-cover ${grade}`} />
        {originalUrl && (
          <img
            src={originalUrl}
            alt="Your original room"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
        )}
        <span className="absolute top-4 left-4 rounded bg-cream/90 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] uppercase">Your photo</span>
        <span className="absolute top-4 right-4 rounded bg-ink/90 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-cream uppercase">{style?.name || 'Look'} · stock photo</span>
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/85 px-3 py-1 text-[11px] font-semibold text-cream">Right side is a stock photo, not your room edited</span>
        <input
          type="range"
          min="0"
          max="100"
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare original photo with style concept"
          data-cursor="drag"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-md" style={{ left: `${pos}%` }}>
          <span className="handle-hint absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-ink/70 text-[0.7rem] font-semibold tracking-tight text-white backdrop-blur">‹ ›</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">The right side is illustrative stock photography of this style, not a version of your room. Mood and lighting are graded on the concept image; they do not rewrite your original file.</p>
    </div>
  )
}
