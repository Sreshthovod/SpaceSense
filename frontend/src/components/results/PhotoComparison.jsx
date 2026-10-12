import { useState } from 'react'

/** Before = the user's original upload; after = the actual edited image returned by the API. */
export default function PhotoComparison({ originalUrl, editedUrl }) {
  const [pos, setPos] = useState(50)
  if (!editedUrl) {
    return (
      <figure>
        <img src={originalUrl} alt="Your original room photo" className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
        <figcaption className="mt-2 text-xs text-muted">Your original photo</figcaption>
      </figure>
    )
  }
  return (
    <figure>
      <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border border-line">
        <img src={editedUrl} alt="AI-edited version of your room photo" className="absolute inset-0 h-full w-full object-cover" />
        <img
          src={originalUrl} alt="Your original room photo"
          className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <span className="absolute left-3 top-3 bg-cream px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em]">Before</span>
        <span className="absolute right-3 top-3 bg-ink px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-cream">After</span>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pos}%` }} />
        <input
          type="range" min="0" max="100" value={pos} onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare original and edited photo" data-cursor="drag" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      <figcaption className="mt-2 text-xs text-muted">Drag to compare. AI edits can contain visual inaccuracies; check details before buying.</figcaption>
    </figure>
  )
}
