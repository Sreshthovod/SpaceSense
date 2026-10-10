import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Info } from 'lucide-react'
import { recommendProducts } from '../../services/api'
import Button from '../ui/Button'
import ChatPanel from './ChatPanel'
import DesignStudio from './DesignStudio'
import FurniturePanel from './FurniturePanel'
import RecommendationsPanel from './RecommendationsPanel'
import RoomAnalysisPanel from './RoomAnalysisPanel'

export default function ResultsSection({ form, photo, imageUrl, result, onReset }) {
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const { analysis } = result
  const [products, setProducts] = useState(result.products)
  const [productsError, setProductsError] = useState(result.productsError || '')
  const [retrying, setRetrying] = useState(false)

  const retryProducts = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      setProducts(await recommendProducts(form, { recommendations: analysis.recommendations }))
      setProductsError('')
    } catch (err) {
      setProductsError(err.message || 'Product recommendations are unavailable right now.')
    } finally {
      setRetrying(false)
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
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-sand/60 p-3 text-sm">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sage-dark" />
        Review the recommendations first. Your photo is only edited if you approve. Product prices are retailer listings checked on the date shown; confirm them before you buy.
      </div>
      <div className="mt-6"><RecommendationsPanel analysis={analysis} /></div>
      <div className="mt-6"><ChatPanel form={form} photo={photo} recommendations={analysis.recommendations} /></div>
      <div className="mt-6">
        <DesignStudio form={form} photo={photo} originalUrl={imageUrl} recommendations={analysis.recommendations} />
      </div>
      <div className="mt-6">
        <FurniturePanel products={products} error={productsError} onRetry={retryProducts} retrying={retrying} />
      </div>
      <div className="mt-6"><RoomAnalysisPanel analysis={analysis} /></div>
    </section>
  )
}
