import { useEffect, useRef } from 'react'
import { ArrowLeft, Info } from 'lucide-react'
import Button from '../ui/Button'
import ChatPanel from './ChatPanel'
import DesignStudio from './DesignStudio'
import FurniturePanel from './FurniturePanel'
import RecommendationsPanel from './RecommendationsPanel'
import RoomAnalysisPanel from './RoomAnalysisPanel'

export default function ResultsSection({ form, photo, imageUrl, result, onReset }) {
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const { analysis, products } = result
  const roomTypeName = form.roomType ? form.roomType.toLowerCase() : 'room'

  return (
    <section aria-labelledby="results-heading" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <Button variant="ghost" onClick={onReset} className="pl-3 pr-5">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Start over
      </Button>
      <h1 id="results-heading" ref={headingRef} tabIndex={-1} className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl focus:outline-none">
        Your {roomTypeName} plan
      </h1>
      <p className="mt-2 text-sm text-muted sm:text-base">{form.length} × {form.width} × {form.height} ft{form.vastu ? ' · Vastu on' : ''}</p>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-sand/60 p-3 text-sm">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sage-dark" />
        Review the recommendations first. Your photo is only edited if you approve, and products come from a small sample catalog.
      </div>
      <div className="mt-6"><RecommendationsPanel analysis={analysis} /></div>
      <div className="mt-6"><ChatPanel form={form} photo={photo} recommendations={analysis.recommendations} /></div>
      <div className="mt-6">
        <DesignStudio form={form} photo={photo} originalUrl={imageUrl} recommendations={analysis.recommendations} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <FurniturePanel products={products} />
        <RoomAnalysisPanel analysis={analysis} />
      </div>
    </section>
  )
}
