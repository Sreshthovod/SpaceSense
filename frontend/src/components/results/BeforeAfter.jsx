import { ImageOff } from 'lucide-react'
import { STYLES } from '../../data/sampleData'

export default function BeforeAfter({ originalUrl, styleId }) {
  const style = STYLES.find((s) => s.id === styleId)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <figure>
        <figcaption className="mb-2 text-sm font-semibold">Original</figcaption>
        <img src={originalUrl} alt="Your original room" className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
      </figure>
      <figure>
        <figcaption className="mb-2 text-sm font-semibold">Redesign ({style?.name})</figcaption>
        <div
          role="img"
          aria-label="Placeholder for the AI redesign, which is not yet generated"
          className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-line p-4 text-center"
          style={{ background: `linear-gradient(135deg, ${style?.swatch[0]}55, ${style?.swatch[2]}55)` }}
        >
          <ImageOff aria-hidden="true" className="h-8 w-8 text-muted" />
          <p className="font-semibold">Redesign preview not available yet</p>
          <p className="max-w-xs text-xs text-muted">AI image generation is not connected. This placeholder only reflects your chosen style palette.</p>
        </div>
      </figure>
    </div>
  )
}
