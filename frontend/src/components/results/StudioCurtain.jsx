import { useEffect, useState } from 'react'
import { STYLES } from '../../data/sampleData'

// What the server is doing while the request is in flight, shown in turn. Not a progress meter:
// nothing here claims a step is finished.
const NOTES = [
  'Looking at the light, layout and finishes in your photo.',
  'Weighing your room size against the pieces it can hold.',
  'Shaping advice around your style and budget.',
  'Checking product suggestions against verified listings.',
]

export default function StudioCurtain({ form, imageUrl }) {
  const style = STYLES.find((s) => s.id === form.style)
  const [note, setNote] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setNote((n) => (n + 1) % NOTES.length), 2600)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-cream/92 px-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="anim-up max-w-md text-center">
        {imageUrl && (
          <div className="relative mx-auto mb-6 h-28 w-40 overflow-hidden rounded-xl shadow-md">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            {/* A soft scan line passing over the photo. */}
            <span aria-hidden="true" className="skeleton absolute inset-0 rounded-none opacity-40 mix-blend-overlay" />
          </div>
        )}
        <p className="eyebrow justify-center">Analysing your photo</p>
        <h2 className="mt-3 font-display text-4xl font-medium">Reading your room.</h2>
        <div className="mt-6 flex justify-center gap-2">
          {(style?.swatch || []).map((c, i) => (
            <span key={c} className="anim-pop h-8 w-8 rounded-full border border-black/10" style={{ background: c, animationDelay: `${200 + i * 120}ms` }} />
          ))}
        </div>
        <p key={note} aria-hidden="true" className="anim-up mt-5 min-h-[2.5rem] text-sm text-ink/80">{NOTES[note]}</p>
        <p className="mt-2 text-xs text-muted">Your photo is being analysed for written advice. Nothing is edited yet; you decide that next.</p>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-line">
          <div className="indeterminate h-full w-full rounded-full" />
        </div>
      </div>
    </div>
  )
}
