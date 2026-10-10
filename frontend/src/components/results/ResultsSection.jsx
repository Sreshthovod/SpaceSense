import { useEffect, useRef } from 'react'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import Button from '../ui/Button'
import BeforeAfter from './BeforeAfter'
import FurniturePanel from './FurniturePanel'
import RoomAnalysisPanel from './RoomAnalysisPanel'

export default function ResultsSection({ form, imageUrl, result, onReset }) {
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const { analysis, design, products } = result

  return (
    <section aria-labelledby="results-heading" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <Button variant="ghost" onClick={onReset}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Start over</Button>
      <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="mt-3 font-display text-4xl font-semibold">
        Your {form.roomType.toLowerCase()} plan
      </h2>
      <p className="text-sm text-muted">{form.length} × {form.width} × {form.height} ft{form.vastu ? ' · Vastu on' : ''}</p>
      <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
        Prototype: the analysis is rule-based, the redesign is a mock (no image is generated), and products come from a small sample catalog.
      </div>
      <div className="mt-6"><BeforeAfter originalUrl={imageUrl} styleId={form.style} design={design} /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <FurniturePanel products={products} />
        <RoomAnalysisPanel analysis={analysis} />
      </div>
    </section>
  )
}
