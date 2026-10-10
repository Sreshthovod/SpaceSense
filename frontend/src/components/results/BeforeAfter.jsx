import { ImageOff, Loader2, RotateCcw, Wand2 } from 'lucide-react'
import { STYLES } from '../../data/sampleData'
import Button from '../ui/Button'

function RedesignPanel({ design, onGenerate }) {
  const { status, data, error } = design

  if (status === 'loading') {
    return (
      <div role="status" className="flex flex-col items-center gap-2">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-sage-dark" />
        <p className="font-semibold">Requesting redesign…</p>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3">
        <p role="alert" className="max-w-xs text-sm text-red-800">{error}</p>
        <Button variant="secondary" onClick={onGenerate}><RotateCcw aria-hidden="true" className="h-4 w-4" /> Try again</Button>
      </div>
    )
  }
  if (status === 'done') {
    return (
      <div role="status" className="flex flex-col items-center gap-2">
        <ImageOff aria-hidden="true" className="h-8 w-8 text-muted" />
        <p className="font-semibold">No image generated</p>
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-clay">{data.status}</span>
        <p className="max-w-xs text-xs text-muted">{data.message}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="max-w-xs text-sm text-muted">Request a redesign in your chosen style. Image generation is not connected yet, so this currently returns a mock response.</p>
      <Button onClick={onGenerate}><Wand2 aria-hidden="true" className="h-4 w-4" /> Generate redesign</Button>
    </div>
  )
}

export default function BeforeAfter({ originalUrl, styleId, design, onGenerate }) {
  const style = STYLES.find((s) => s.id === styleId)
  // Only a real (non-mock) provider response may carry an image.
  const imageUrl = design.status === 'done' && design.data.status !== 'mock' ? design.data.image_url : null
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <figure>
        <figcaption className="mb-2 text-sm font-semibold">Original</figcaption>
        <img src={originalUrl} alt="Your original room" className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
      </figure>
      <figure>
        <figcaption className="mb-2 text-sm font-semibold">Redesign ({style?.name})</figcaption>
        {imageUrl ? (
          <img src={imageUrl} alt={`Redesigned room in the ${style?.name} style`} className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
        ) : (
          <div
            aria-live="polite"
            className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-line p-4 text-center"
            style={{ background: `linear-gradient(135deg, ${style?.swatch[0]}55, ${style?.swatch[2]}55)` }}
          >
            <RedesignPanel design={design} onGenerate={onGenerate} />
          </div>
        )}
      </figure>
    </div>
  )
}
