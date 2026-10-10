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
        <span className="absolute top-4 left-4 rounded bg-cream/90 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] uppercase">Original</span>
        <span className="absolute top-4 right-4 rounded bg-ink/90 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-cream uppercase">{style?.name || 'Look'}</span>
        <input
          type="range"
          min="0"
          max="100"
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare original photo with style concept"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-md" style={{ left: `${pos}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">Style photography is illustrative. Mood and lighting are graded on the concept image; they do not rewrite your original file.</p>
    </div>
  )
}
