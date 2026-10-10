import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Box, Info } from 'lucide-react'
import { STYLES } from '../../data/sampleData'
import { recommendProducts } from '../../services/api'
import { samplePalette } from '../../utils/palette'
import { moodClass } from '../../utils/styles'
import Button from '../ui/Button'
import Card from '../ui/Card'
import FloorPlan from '../form/FloorPlan'
import BeforeAfter from './BeforeAfter'
import ChatPanel from './ChatPanel'
import DesignStudio from './DesignStudio'
import FurniturePanel from './FurniturePanel'
import MoodLighting from './MoodLighting'
import PaletteStrip from './PaletteStrip'
import RecommendationsPanel from './RecommendationsPanel'
import RoomAnalysisPanel from './RoomAnalysisPanel'
import ShareLooks from './ShareLooks'
import StyleCompare from './StyleCompare'

const RoomDesigner = lazy(() => import('../../designer/RoomDesigner'))

export default function ResultsSection({
  form, photo, imageUrl, result, onReset, looks, onSaveLook, onCopyLook, onRestoreLook, restored,
}) {
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const { analysis } = result
  const [products, setProducts] = useState(result.products)
  const [productsError, setProductsError] = useState(result.productsError || '')
  const [retrying, setRetrying] = useState(false)
  const [mood, setMood] = useState(restored?.mood || 'warm')
  const [lighting, setLighting] = useState(restored?.lighting || 'day')
  const [compareStyle, setCompareStyle] = useState(restored?.compareStyle || '')
  const [designerOpen, setDesignerOpen] = useState(false)
  const designerButtonRef = useRef(null)
  const [palette, setPalette] = useState(STYLES.find((s) => s.id === form.style)?.swatch || [])

  useEffect(() => {
    samplePalette(imageUrl, STYLES.find((s) => s.id === form.style)?.swatch || []).then(setPalette)
  }, [imageUrl, form.style])

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
  const look = () => ({ compareStyle, mood, lighting })
  const closeDesigner = () => {
    setDesignerOpen(false)
    // Wait for the page to stop being inert before moving focus back.
    setTimeout(() => designerButtonRef.current?.focus(), 0)
  }

  return (
    <section id="studio" aria-labelledby="results-heading" className="studio-stagger mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-16">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onReset} className="pl-3 pr-5">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Start over
        </Button>
        <ShareLooks looks={looks} onSave={() => onSaveLook(look())} onCopy={() => onCopyLook(look())} onRestore={onRestoreLook} />
      </div>
      <h1 id="results-heading" ref={headingRef} tabIndex={-1} className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl lg:text-6xl focus:outline-none">
        Your {roomTypeName} studio
      </h1>
      <p className="mt-2 text-sm text-muted sm:text-base">
        {form.length} × {form.width} × {form.height} ft{form.vastu ? ' · Vastu guidance enabled' : ''}
      </p>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-sand/60 p-3 text-sm">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sage-dark" />
        Review the recommendations first. Your photo is only edited if you approve. Product prices are retailer listings checked on the date shown; confirm them before you buy.
      </div>
      <div className="mt-6"><RecommendationsPanel analysis={analysis} /></div>
      <div className="mt-6"><ChatPanel form={form} photo={photo} recommendations={analysis.recommendations} /></div>
      <div className="mt-6">
        <DesignStudio form={form} photo={photo} originalUrl={imageUrl} recommendations={analysis.recommendations} />
      </div>
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl font-semibold">Build your dream room in 3D</h2>
          <p className="mt-1 text-sm text-muted">
            Start from your {form.length} × {form.width} ft room, paint the walls, choose a floor and place every item yourself.
          </p>
        </div>
        <Button ref={designerButtonRef} onClick={() => setDesignerOpen(true)}>
          <Box aria-hidden="true" className="h-4 w-4" /> Open 3D Room Designer
        </Button>
      </Card>
      {designerOpen && (
        <Suspense fallback={<p role="status" className="fixed inset-0 z-[60] flex items-center justify-center bg-cream text-sm text-muted">Loading the 3D designer…</p>}>
          <RoomDesigner form={form} photo={photo} photoUrl={imageUrl} onClose={closeDesigner} />
        </Suspense>
      )}
      <div className="mt-6">
        <FurniturePanel products={products} error={productsError} onRetry={retryProducts} retrying={retrying} />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-3xl font-semibold">Explore the mood</h2>
        <p className="mt-1 text-sm text-muted">Inspiration only: these use illustrative style photography, not an edit of your room.</p>
        <div className="mt-6"><PaletteStrip colors={palette} /></div>
        <div className="mt-6"><MoodLighting mood={mood} lighting={lighting} onMood={setMood} onLighting={setLighting} /></div>
        <div className="mt-6"><BeforeAfter originalUrl={imageUrl} styleId={form.style} mood={mood} lighting={lighting} /></div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <StyleCompare primary={form.style} compareStyle={compareStyle} onCompare={setCompareStyle} moodClassName={moodClass(mood, lighting)} />
          </Card>
          <Card>
            <h3 className="font-display text-xl font-semibold">Room outline</h3>
            <FloorPlan length={form.length} width={form.width} styleId={form.style} />
          </Card>
        </div>
      </div>

      <div className="mt-6"><RoomAnalysisPanel analysis={analysis} /></div>
    </section>
  )
}
