import { useEffect, useRef, useState } from 'react'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Hero from './components/landing/Hero'
import BeforeAfter from './components/landing/BeforeAfter'
import HowItWorks from './components/landing/HowItWorks'
import DesignStyles from './components/landing/DesignStyles'
import BudgetFirst from './components/landing/BudgetFirst'
import FinalCTA from './components/landing/FinalCTA'
import useReveal from './hooks/useReveal'
import usePrefersReducedMotion from './hooks/usePrefersReducedMotion'
import { fetchRoomPlan } from './services/api'
import RoomForm from './components/form/RoomForm'
import ResultsSection from './components/results/ResultsSection'
import StudioCurtain from './components/results/StudioCurtain'
import { loadLooks, lookFromSearch, lookUrl, saveLook } from './utils/looks'

const EMPTY_FORM = { roomType: '', length: '', width: '', height: '', style: '', budget: '', vastu: false, entryDirection: '' }

const scrollToForm = (reduced) => setTimeout(() => {
  document.getElementById('redesign')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
}, 50)

export default function App() {
  const reduced = usePrefersReducedMotion()
  // A shared link (?look=...) refills the brief; the photo and analysis aren't part of a look.
  const [initialLook] = useState(() => {
    const saved = lookFromSearch()
    return saved?.form ? saved : null
  })
  const [form, setForm] = useState(() => (initialLook ? { ...EMPTY_FORM, ...initialLook.form } : EMPTY_FORM))
  const [image, setImageState] = useState({ file: null, url: '' })
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState('landing') // landing | composing | studio
  const [result, setResult] = useState(null)
  const [apiError, setApiError] = useState('')
  const [looks, setLooks] = useState(() => loadLooks())
  // Mood, lighting and comparison choices from a saved or shared look, applied to the next studio.
  const [restored, setRestored] = useState(initialLook)
  const [studioKey, setStudioKey] = useState(0)

  // Revoke object URLs when replaced or on unmount.
  useEffect(() => () => { if (image.url) URL.revokeObjectURL(image.url) }, [image.url])
  useReveal(phase)

  const restoreLook = (look) => {
    setForm({ ...EMPTY_FORM, ...look.form })
    setRestored(look)
    setResult(null)
    setPhase('landing')
    scrollToForm(reduced)
  }

  useEffect(() => {
    if (initialLook) scrollToForm(reduced)
  }, [initialLook, reduced])

  const leaveResults = () => setPhase((p) => (p === 'composing' ? p : 'landing'))
  const studio = phase === 'studio' || phase === 'composing'

  const selectStyle = (id) => {
    setForm((f) => ({ ...f, style: id }))
    if (phase !== 'landing') setPhase('landing')
    scrollToForm(reduced)
  }

  const setImage = (file) => setImageState({ file, url: file ? URL.createObjectURL(file) : '' })

  // A ref, not state, so two clicks in the same tick can't both pass the guard.
  const inFlight = useRef(false)

  const submit = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setApiError('')
    setPhase('composing')
    try {
      setResult(await fetchRoomPlan(form, image.file))
      setStudioKey((k) => k + 1)
      setPhase('studio')
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
    } catch (err) {
      setApiError(err.message || 'Something went wrong. Please try again.')
      setPhase('landing')
      scrollToForm(reduced)
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  const reset = () => {
    setPhase('landing')
    setResult(null)
    setApiError('')
    setRestored(null)
    setForm(EMPTY_FORM)
    setImage(null)
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  const snapshot = (extra) => ({ form, ...extra })

  const onSaveLook = (extra) => setLooks(saveLook(snapshot(extra)))

  const onCopyLook = async (extra) => {
    try {
      await navigator.clipboard.writeText(lookUrl(snapshot(extra)))
      return true
    } catch {
      return false
    }
  }

  const onRestoreLook = (id) => {
    const found = looks.find((look) => look.id === id)
    if (found?.form) restoreLook(found)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar onHome={leaveResults} studio={studio} />
      {phase === 'composing' && <StudioCurtain form={form} imageUrl={image.url} />}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {phase === 'studio' && result ? (
          <ResultsSection
            key={studioKey}
            form={form}
            photo={image.file}
            imageUrl={image.url}
            result={result}
            onReset={reset}
            looks={looks}
            onSaveLook={onSaveLook}
            onCopyLook={onCopyLook}
            onRestoreLook={onRestoreLook}
            restored={restored}
          />
        ) : (
          <>
            <Hero onStart={leaveResults} />
            <BeforeAfter />
            <HowItWorks />
            <DesignStyles onSelectStyle={selectStyle} selected={form.style} />
            <BudgetFirst />
            <FinalCTA onStart={leaveResults} />
            <section id="redesign" aria-labelledby="form-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
              <p className="eyebrow">Design My Space</p>
              <h2 id="form-heading" className="mt-4 font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">Tell us about your room.</h2>
              <p className="mb-10 mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">Three short steps. All fields except Vastu are required. Your photo is sent to the SpaceSense server for analysis, which may use Google's Gemini. It is only edited if you approve.</p>
              {restored && !result && !image.file && (
                <p role="status" className="-mt-6 mb-8 max-w-xl rounded-xl border border-line bg-sand/60 p-3 text-sm">Saved look loaded. Add your room photo and generate again to see it.</p>
              )}
              <RoomForm form={form} setForm={setForm} image={image} setImage={setImage} onSubmit={submit} submitting={submitting} apiError={apiError} />
            </section>
          </>
        )}
      </main>
      <Footer onHome={leaveResults} />
    </div>
  )
}
