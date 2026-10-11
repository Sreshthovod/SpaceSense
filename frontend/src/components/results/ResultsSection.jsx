import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Box, Info } from 'lucide-react'
import { STYLES } from '../../data/sampleData'
import { recommendProducts } from '../../services/api'
import { fileFromDataUrl } from '../../utils/dataUrlFile'
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
import useActiveSection from '../../hooks/useActiveSection'
import { STUDIO_LINKS } from './studioLinks'

const RoomDesigner = lazy(() => import('../../designer/RoomDesigner'))

const STUDIO_IDS = STUDIO_LINKS.map((l) => l.id)

export default function ResultsSection({
  form, photo, imageUrl, result, onReset, looks, onSaveLook, onCopyLook, onRestoreLook, restored,
}) {
  const activeSection = useActiveSection(STUDIO_IDS)
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
  // The edited photo, if the user generated one; the 3D designer prefers it over the original.
  const [editedUrl, setEditedUrl] = useState(null)
  const editedFile = useMemo(
    () => (editedUrl ? fileFromDataUrl(editedUrl, `edited-${(photo?.name || 'room').replace(/\.[^.]+$/, '')}`) : null),
    [editedUrl, photo],
  )
  const designerPhoto = editedFile || photo
  const designerPhotoUrl = editedFile ? editedUrl : imageUrl
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
      <nav aria-label="Studio sections" className="sticky top-16 z-30 -mx-5 mt-4 overflow-x-auto border-b border-line bg-cream/90 px-5 backdrop-blur-md sm:-mx-8 sm:px-8 lg:hidden">
        <ul className="flex gap-5 py-2 text-xs font-semibold uppercase tracking-[0.12em]">
          {STUDIO_LINKS.map((l) => (
            <li key={l.href}><a href={l.href} aria-current={activeSection === l.href ? 'true' : undefined} className="nav-link inline-block py-1.5 text-muted transition-colors hover:text-ink aria-[current=true]:text-ink">{l.label}</a></li>
          ))}
        </ul>
      </nav>

      <div id="advice" className="mt-6 scroll-mt-32"><RecommendationsPanel analysis={analysis} /></div>
      <div id="chat" className="mt-6 scroll-mt-32"><ChatPanel form={form} photo={photo} recommendations={analysis.recommendations} /></div>
      <div id="photo" className="mt-6 scroll-mt-32">
        <DesignStudio form={form} photo={photo} originalUrl={imageUrl} recommendations={analysis.recommendations} onEdited={setEditedUrl} />
      </div>
      <div id="shop" className="reveal mt-6 scroll-mt-32">
        <FurniturePanel products={products} error={productsError} onRetry={retryProducts} retrying={retrying} />
      </div>
      <Card id="designer-3d" className="reveal mt-6 scroll-mt-32">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="max-w-xl">
            <p className="eyebrow">Optional</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">Plan it in 3D</h2>
            <p className="mt-1 text-sm text-muted">
              Start from your {form.length} × {form.width} ft room, paint the walls, choose a floor and place every item yourself.
            </p>
            <Button ref={designerButtonRef} className="mt-4" onClick={() => setDesignerOpen(true)}>
              <Box aria-hidden="true" className="h-4 w-4" /> Open 3D Room Designer
            </Button>
          </div>
          <div className="w-full max-w-[16rem]">
            <FloorPlan length={form.length} width={form.width} height={form.height} />
          </div>
        </div>
      </Card>
      {designerOpen && (
        <Suspense fallback={<p role="status" className="fixed inset-0 z-[60] flex items-center justify-center bg-cream text-sm text-muted">Loading the 3D designer…</p>}>
          <RoomDesigner form={form} photo={designerPhoto} photoUrl={designerPhotoUrl} photoEdited={!!editedFile} onClose={closeDesigner} />
        </Suspense>
      )}

      <details id="inspiration" className="reveal group mt-8 scroll-mt-32 rounded-2xl border border-line bg-white/60 p-5">
        <summary className="cursor-pointer list-none">
          <span className="eyebrow">Inspiration · not your room</span>
          <span className="mt-2 block font-display text-2xl font-semibold">Explore the mood</span>
          <span className="mt-1 block text-sm text-muted">Palette, lighting and style comparisons using stock photography. These are ideas to react to, not an edit or a render of your room. Tap to open.</span>
        </summary>
        <div className="mt-6"><PaletteStrip colors={palette} /></div>
        <div className="mt-6"><MoodLighting mood={mood} lighting={lighting} onMood={setMood} onLighting={setLighting} /></div>
        <div className="mt-6"><BeforeAfter originalUrl={imageUrl} styleId={form.style} mood={mood} lighting={lighting} /></div>
        <div className="mt-8">
          <Card>
            <StyleCompare primary={form.style} compareStyle={compareStyle} onCompare={setCompareStyle} moodClassName={moodClass(mood, lighting)} />
          </Card>
        </div>
      </details>

      <div id="analysis" className="reveal mt-6 scroll-mt-32"><RoomAnalysisPanel analysis={analysis} /></div>
    </section>
  )
}
