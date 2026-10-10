import { useEffect, useState } from 'react'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Hero from './components/landing/Hero'
import BeforeAfter from './components/landing/BeforeAfter'
import HowItWorks from './components/landing/HowItWorks'
import DesignStyles from './components/landing/DesignStyles'
import BudgetFirst from './components/landing/BudgetFirst'
import FinalCTA from './components/landing/FinalCTA'
import useReveal from './hooks/useReveal'
import { fetchRoomPlan } from './services/api'
import RoomForm from './components/form/RoomForm'
import ResultsSection from './components/results/ResultsSection'

const EMPTY_FORM = { roomType: '', length: '', width: '', height: '', style: '', budget: '', vastu: false }

export default function App() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [image, setImageState] = useState({ file: null, url: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [result, setResult] = useState(null)
  const [apiError, setApiError] = useState('')

  // Revoke object URLs when replaced or on unmount.
  useEffect(() => () => { if (image.url) URL.revokeObjectURL(image.url) }, [image.url])

  useReveal(showResults)

  const leaveResults = () => setShowResults(false)

  const selectStyle = (id) => {
    setForm((f) => ({ ...f, style: id }))
    document.getElementById('redesign')?.scrollIntoView({ behavior: 'smooth' })
  }

  const setImage = (file) => setImageState({ file, url: file ? URL.createObjectURL(file) : '' })

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setApiError('')
    try {
      setResult(await fetchRoomPlan(form))
      setShowResults(true)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setApiError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setShowResults(false)
    setResult(null)
    setApiError('')
    setForm(EMPTY_FORM)
    setImage(null)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar onHome={leaveResults} />
      <main className="flex-1">
        {showResults && result ? (
          <ResultsSection form={form} imageUrl={image.url} result={result} onReset={reset} />
        ) : (
          <>
            <Hero onStart={leaveResults} />
            <BeforeAfter />
            <HowItWorks />
            <DesignStyles onSelectStyle={selectStyle} />
            <BudgetFirst />
            <FinalCTA onStart={leaveResults} />
            <section id="redesign" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
              <p className="eyebrow">Design My Space</p>
              <h2 className="mt-4 font-display text-5xl font-medium leading-none sm:text-6xl">Tell us about your room.</h2>
              <p className="mb-10 mt-4 max-w-xl text-muted">All fields except Vastu are required. Your photo stays in your browser; nothing is uploaded anywhere yet.</p>
              <RoomForm form={form} setForm={setForm} image={image} setImage={setImage} onSubmit={submit} submitting={submitting} apiError={apiError} />
            </section>
          </>
        )}
      </main>
      <Footer onHome={leaveResults} />
    </div>
  )
}
