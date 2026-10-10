import { useEffect, useState } from 'react'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import RoomForm from './components/form/RoomForm'
import ResultsSection from './components/results/ResultsSection'

const EMPTY_FORM = { roomType: '', length: '', width: '', height: '', style: '', budget: '', vastu: false }

export default function App() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [image, setImageState] = useState({ file: null, url: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Revoke object URLs when replaced or on unmount.
  useEffect(() => () => { if (image.url) URL.revokeObjectURL(image.url) }, [image.url])

  const setImage = (file) => setImageState({ file, url: file ? URL.createObjectURL(file) : '' })

  const submit = () => {
    setSubmitting(true)
    setTimeout(() => { setSubmitting(false); setShowResults(true); window.scrollTo({ top: 0 }) }, 900)
  }

  const reset = () => {
    setShowResults(false)
    setForm(EMPTY_FORM)
    setImage(null)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar onHome={() => showResults && setShowResults(false)} />
      <main className="flex-1">
        {showResults ? (
          <ResultsSection form={form} imageUrl={image.url} onReset={reset} />
        ) : (
          <>
            <Hero />
            <HowItWorks />
            <section id="redesign" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
              <h2 className="font-display text-3xl font-semibold">Tell us about your room</h2>
              <p className="mb-8 mt-2 text-muted">All fields except Vastu are required. Nothing is uploaded anywhere; your photo stays in your browser.</p>
              <RoomForm form={form} setForm={setForm} image={image} setImage={setImage} onSubmit={submit} submitting={submitting} />
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
