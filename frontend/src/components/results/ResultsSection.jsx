import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { generateDesign, toRoomPayload } from '../../services/api'
import Button from '../ui/Button'
import BeforeAfter from './BeforeAfter'
import FurniturePanel from './FurniturePanel'
import RoomAnalysisPanel from './RoomAnalysisPanel'

export default function ResultsSection({ form, imageUrl, result, onReset }) {
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const { analysis, products } = result
  const [design, setDesign] = useState({ status: 'idle', data: null, error: '' })
  const abortRef = useRef(null)
  const inFlight = useRef(false)
  useEffect(() => () => abortRef.current?.abort(), [])

  const requestDesign = async () => {
    if (inFlight.current) return
    inFlight.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setDesign({ status: 'loading', data: null, error: '' })
    try {
      const data = await generateDesign(toRoomPayload(form), controller.signal)
      setDesign({ status: 'done', data, error: '' })
    } catch (err) {
      if (!controller.signal.aborted) setDesign({ status: 'error', data: null, error: err.message })
    } finally {
      inFlight.current = false
    }
  }

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
      <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
        Prototype: the analysis is rule-based, the redesign is a mock (no image is generated), and products come from a small sample catalog.
      </div>
      <div className="mt-6"><BeforeAfter originalUrl={imageUrl} styleId={form.style} design={design} onGenerate={requestDesign} /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <FurniturePanel products={products} />
        <RoomAnalysisPanel analysis={analysis} />
      </div>
    </section>
  )
}
