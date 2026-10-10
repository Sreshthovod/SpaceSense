import { useEffect, useRef } from 'react'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { SAMPLE_FURNITURE } from '../../data/sampleData'
import Button from '../ui/Button'
import BeforeAfter from './BeforeAfter'
import ConstraintChecks from './ConstraintChecks'
import FurniturePanel from './FurniturePanel'

function pickItems(budget) {
  const picked = []
  let total = 0
  for (const item of [...SAMPLE_FURNITURE].sort((a, b) => a.priority - b.priority)) {
    if (total + item.price <= budget) { picked.push(item); total += item.price }
  }
  return picked
}

export default function ResultsSection({ form, imageUrl, onReset }) {
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const budget = Number(form.budget)
  const items = pickItems(budget)
  const spent = items.reduce((s, i) => s + i.price, 0)

  return (
    <section aria-labelledby="results-heading" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Button variant="ghost" onClick={onReset}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Start over</Button>
      <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="mt-3 font-display text-3xl font-semibold">
        Your {form.roomType.toLowerCase()} redesign plan
      </h2>
      <p className="text-sm text-muted">{form.length} × {form.width} × {form.height} ft{form.vastu ? ' · Vastu on' : ''}</p>
      <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
        Prototype results: the redesign image, furniture and prices below are placeholders. AI redesign and real product recommendations are not integrated yet.
      </div>
      <div className="mt-6"><BeforeAfter originalUrl={imageUrl} styleId={form.style} /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <FurniturePanel items={items} budget={budget} />
        <ConstraintChecks form={form} spent={spent} />
      </div>
    </section>
  )
}
