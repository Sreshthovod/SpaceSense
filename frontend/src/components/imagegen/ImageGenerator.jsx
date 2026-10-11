import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, Download, Expand, ImagePlus, Loader2, RefreshCw, Shuffle, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { editImage, generateImage, getImageProviders } from '../../services/api'
import { LAB_CHIPS, LAB_PROMPTS } from './labPrompts'

const MAX_PROMPT = 2048
const MAX_UPLOAD_MB = 5
const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function validateUpload(file) {
  if (!UPLOAD_TYPES.includes(file.type)) return 'Use a PNG, JPEG or WebP image.'
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Image must be ${MAX_UPLOAD_MB} MB or smaller.`
  return ''
}

const PROVIDERS = [
  { id: 'cloudflare', name: 'Cloudflare', note: 'FLUX, free daily allowance. Uploads are shrunk to a small size first.' },
  { id: 'gemini', name: 'Gemini', note: 'Google AI. Uses your uploaded image at full quality.' },
]

const extensionOf = (dataUrl) => (dataUrl.startsWith('data:image/png') ? 'png' : dataUrl.startsWith('data:image/webp') ? 'webp' : 'jpg')

/** A fine-line room in perspective for the empty canvas. Each stroke draws in once the panel is shown. */
function RoomSketch() {
  const lines = [
    'M150 70 H450 V250 H150 Z', // back wall
    'M0 0 L150 70', 'M600 0 L450 70', 'M0 340 L150 250', 'M600 340 L450 250', // ceiling and floor edges
    'M168 92 H232 V160 H168 Z', 'M200 92 V160', 'M168 126 H232', // window, up and left so the words stay clear
    'M372 250 V214 H442 V250', 'M366 230 H448', // sofa
    'M370 70 V96', 'M356 96 H384 L378 108 H362 Z', // pendant
    'M220 296 L380 296 L410 318 L190 318 Z', // rug
  ]
  return (
    <svg viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice" className="lab-draw absolute inset-0 h-full w-full stroke-line" fill="none" strokeWidth="1.25" aria-hidden="true">
      {lines.map((d, i) => <path key={d} d={d} pathLength="1" style={{ '--i': i }} />)}
    </svg>
  )
}

/** The generated image, full screen. Esc or the close button returns to the page. */
function Lightbox({ src, alt, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label="Generated image, full size" className="anim-fade fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 sm:p-10" onClick={onClose}>
      <img src={src} alt={alt} className="anim-scale max-h-full max-w-full rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <button
        ref={closeRef} type="button" onClick={onClose} aria-label="Close full-size image"
        className="press absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  )
}

const toolButton = 'press inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-xs font-semibold text-ink transition-colors hover:border-sage hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark'

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [resultPrompt, setResultPrompt] = useState('') // the prompt the shown image was made from
  const [provider, setProvider] = useState('cloudflare')
  const [available, setAvailable] = useState(null) // { cloudflare, gemini } once known; null while loading or unreachable
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [replacing, setReplacing] = useState(null) // a suggestion waiting for "replace your prompt?"
  const [enlarged, setEnlarged] = useState(false)
  const inFlight = useRef(false)
  const abortRef = useRef(null)
  const inputRef = useRef(null)
  const promptRef = useRef(null)
  const expandRef = useRef(null)
  const advancedId = useId()

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    getImageProviders(controller.signal)
      .then((status) => {
        setAvailable(status)
        // Start on a provider that is actually set up.
        setProvider((current) => (status[current] ? current : PROVIDERS.find((p) => status[p.id])?.id ?? current))
      })
      .catch(() => {}) // the backend may be down; generating will then show the real error
    return () => controller.abort()
  }, [])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const choose = (picked) => {
    if (!picked) return
    const problem = validateUpload(picked)
    setUploadError(problem)
    if (problem) return
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
  }

  const clearFile = () => {
    setFile(null)
    setPreviewUrl('')
    setUploadError('')
  }

  // A suggestion fills an empty prompt straight away; a prompt you've written is only replaced if you say so.
  const suggest = (s) => {
    if (pending) return
    if (!prompt.trim() || prompt === s.text) {
      setPrompt(s.text)
      setReplacing(null)
      promptRef.current?.focus()
    } else {
      setReplacing(s)
    }
  }
  const inspire = () => {
    const others = LAB_PROMPTS.filter((s) => s.text !== prompt)
    suggest(others[Math.floor(Math.random() * others.length)])
  }
  const confirmReplace = () => {
    setPrompt(replacing.text)
    setReplacing(null)
    promptRef.current?.focus()
  }

  const run = async (text) => {
    if (!text || inFlight.current) return
    inFlight.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)
    setError('')
    try {
      const data = file
        ? await editImage({ prompt: text, file, provider }, controller.signal)
        : await generateImage({ prompt: text, provider }, controller.signal)
      setResult(data.image)
      setResultPrompt(text)
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'Could not generate the image. Please try again.')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }
  const submit = (e) => {
    e.preventDefault()
    run(prompt.trim())
  }

  const closeLightbox = useCallback(() => {
    setEnlarged(false)
    setTimeout(() => expandRef.current?.focus(), 0)
  }, [])

  const providerName = PROVIDERS.find((p) => p.id === provider)?.name
  const canGenerate = !pending && prompt.trim().length > 0

  return (
    <section id="image-lab" aria-labelledby="image-lab-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <div className="reveal flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Image Lab · optional playground</p>
          <h2 id="image-lab-heading" className="mt-4 flex items-start gap-3 font-display text-4xl font-semibold leading-none tracking-[-0.01em] sm:text-5xl lg:text-6xl">
            Just for fun.
            <Sparkles aria-hidden="true" strokeWidth={1.5} className="lab-twinkle mt-1 h-6 w-6 shrink-0 text-sage-dark sm:h-7 sm:w-7" />
          </h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted sm:text-base">
          A sandbox, separate from your room plan above: describe any scene and get an AI picture, or add an image to build on. It does not use your room details, and nothing here changes your photo or your advice.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 lg:mt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        {/* Prompt studio */}
        <div className="reveal rounded-xl border border-line bg-white p-5 sm:p-7">
          <form onSubmit={submit} className="space-y-6">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label htmlFor="image-prompt" className="text-sm font-semibold">Prompt</label>
                <span className="text-xs tabular-nums text-muted" aria-live="off">{prompt.length} / {MAX_PROMPT}</span>
              </div>
              <textarea
                ref={promptRef} id="image-prompt" rows={5} maxLength={MAX_PROMPT} value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setReplacing(null) }}
                placeholder="Describe a sunlit Japandi living room with natural oak, linen textures and soft morning light…"
                className="lab-field w-full resize-y rounded-lg border border-line bg-cream px-3.5 py-3 text-sm leading-relaxed placeholder:text-muted focus:outline-none"
              />

              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <p id="lab-ideas" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Need an idea?</p>
                  <button type="button" onClick={inspire} disabled={pending} className="lab-link inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-sage-dark disabled:opacity-50">
                    <Shuffle aria-hidden="true" className="h-3.5 w-3.5" /> Inspire me
                  </button>
                </div>
                <ul aria-labelledby="lab-ideas" className="mt-2 flex flex-wrap gap-1.5">
                  {LAB_CHIPS.map((s) => {
                    const on = prompt === s.text
                    return (
                      <li key={s.id}>
                        <button
                          type="button" onClick={() => suggest(s)} disabled={pending} aria-pressed={on}
                          className={`lab-chip min-h-[34px] rounded-full border px-3 text-xs font-medium disabled:opacity-50 ${on ? 'border-sage-dark bg-sage-dark text-cream' : 'border-line text-ink hover:border-sage hover:bg-sand'}`}
                        >
                          {s.label}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {replacing && (
                  <div role="status" className="anim-up mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-sand/60 px-3 py-2 text-xs">
                    <span className="min-w-0 flex-1">Replace your prompt with “{replacing.label}”?</span>
                    <button type="button" onClick={confirmReplace} className="rounded-full bg-ink px-3 py-1.5 font-semibold text-cream hover:bg-sage-dark">Replace</button>
                    <button type="button" onClick={() => setReplacing(null)} className="rounded-full px-2 py-1.5 font-semibold text-muted hover:text-ink">Keep mine</button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <span id="image-upload-label" className="mb-2 block text-sm font-semibold">
                Starting image <span className="font-normal text-muted">(optional)</span>
              </span>
              {previewUrl ? (
                <div className="anim-scale flex items-center gap-3 rounded-lg border border-line bg-cream p-2.5">
                  <img src={previewUrl} alt="Your uploaded starting image" className="h-16 w-16 rounded-md object-cover" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{file?.name}</span>
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-sage-dark disabled:opacity-50">
                    Replace
                  </button>
                  <button
                    type="button" onClick={clearFile} disabled={pending}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-clay transition-colors hover:bg-warn-bg focus-visible:outline-2 focus-visible:outline-clay disabled:opacity-50"
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button" aria-labelledby="image-upload-label image-upload-action" onClick={() => inputRef.current?.click()} disabled={pending}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]) }}
                  className={`lab-drop group flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-3.5 text-left disabled:opacity-50 ${dragging ? 'is-dragging border-sage-dark bg-sand' : 'border-line hover:border-sage hover:bg-sand/60'}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-sage-dark transition-transform group-hover:-translate-y-0.5">
                    {dragging ? <Upload aria-hidden="true" className="h-4.5 w-4.5" /> : <ImagePlus aria-hidden="true" className="h-4.5 w-4.5" />}
                  </span>
                  <span className="min-w-0">
                    <span id="image-upload-action" className="block text-sm font-semibold">{dragging ? 'Drop to use this image' : 'Upload image'}</span>
                    <span className="block text-xs text-muted">Click to choose, or drop one here</span>
                  </span>
                </button>
              )}
              <input
                ref={inputRef} type="file" accept={UPLOAD_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true"
                onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }}
              />
              <p className="mt-2 text-xs leading-relaxed text-muted">PNG, JPEG or WebP, up to {MAX_UPLOAD_MB} MB. Cloudflare shrinks large photos first; Gemini does not.</p>
              {uploadError && <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-700"><AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />{uploadError}</p>}
            </div>

            <div className="rounded-lg border border-line">
              <button
                type="button" aria-expanded={advancedOpen} aria-controls={advancedId} onClick={() => setAdvancedOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark"
              >
                <span className="font-semibold">Advanced: AI provider <span className="font-normal text-muted">({providerName})</span></span>
                <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
              <div id={advancedId} className="lab-collapse" data-open={advancedOpen} inert={!advancedOpen}>
                <div className="min-h-0 overflow-hidden">
                  <fieldset className="px-3.5 pb-3.5">
                    <legend className="sr-only">AI provider</legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      {PROVIDERS.map((p) => {
                        const missing = available !== null && !available[p.id]
                        const on = provider === p.id && !missing
                        return (
                          <label
                            key={p.id}
                            className={`rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sage-dark ${
                              missing ? 'cursor-not-allowed border-line bg-sand/40 text-muted' : 'cursor-pointer hover:border-sage'
                            } ${on ? 'border-sage-dark bg-sand/60' : 'border-line bg-white'}`}
                          >
                            <input
                              type="radio" name="image-provider" value={p.id} className="sr-only"
                              checked={provider === p.id} disabled={missing || pending}
                              onChange={() => setProvider(p.id)}
                            />
                            <span className="flex items-center gap-1.5 font-semibold">
                              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${on ? 'bg-sage-dark' : 'border border-muted'}`} />
                              {p.name}{missing && <span className="text-xs font-normal">(not set up)</span>}
                            </span>
                            <span className="mt-1 block text-xs text-muted">{p.note}</span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                </div>
              </div>
            </div>

            <button
              type="submit" disabled={!canGenerate}
              className="lab-go inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-sage-dark px-6 text-sm font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {pending
                ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Creating your image…</>
                : <><Sparkles aria-hidden="true" className="h-4 w-4" /> Generate</>}
            </button>
          </form>
        </div>

        {/* Canvas */}
        <div className="reveal lab-canvas flex flex-col rounded-xl border border-line bg-white p-3 sm:p-4" style={{ transitionDelay: '120ms' }}>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-cream lg:aspect-auto lg:min-h-[26rem] lg:flex-1">
            {pending ? (
              <div role="status" className="absolute inset-0">
                <div aria-hidden="true" className="skeleton absolute inset-0 rounded-none" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-sage-dark" />
                  </span>
                  <p className="font-display text-2xl font-semibold">Rendering your scene</p>
                  <p className="text-sm text-muted">With {providerName}. This can take up to a minute.</p>
                </div>
              </div>
            ) : error ? (
              <div role="alert" className="anim-fade absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-bg text-clay">
                  <AlertCircle aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="font-display text-2xl font-semibold">That didn't work</p>
                <p className="max-w-sm text-sm text-muted">{error}</p>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => run(prompt.trim())} disabled={!prompt.trim()} className={toolButton}>
                    <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Try again
                  </button>
                  {result && <button type="button" onClick={() => setError('')} className={toolButton}>Show my last image</button>}
                </div>
              </div>
            ) : result ? (
              <img key={result} src={result} alt={`AI-generated image for: ${resultPrompt || 'your prompt'}`} className="lab-develop absolute inset-0 h-full w-full object-contain" />
            ) : (
              <div className="absolute inset-0">
                <div aria-hidden="true" className="lab-glow absolute inset-0" />
                <RoomSketch />
                <div className="lab-empty absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-sage-dark shadow-sm">
                    <ImagePlus aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" />
                  </span>
                  <p className="mt-4 font-display text-2xl font-semibold sm:text-3xl">Your next idea starts here.</p>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">Describe a scene or choose a prompt to bring your vision to life.</p>
                  <p className="mt-3 text-xs text-muted">Optionally, add a starting image to build on.</p>
                </div>
              </div>
            )}
          </div>

          {result && !pending && !error && (
            <div className="anim-up mt-3 flex flex-wrap items-center gap-2 px-1">
              <p className="min-w-0 basis-full truncate text-xs text-muted sm:basis-0 sm:flex-1" title={resultPrompt}>{resultPrompt}</p>
              <button ref={expandRef} type="button" onClick={() => setEnlarged(true)} className={toolButton}>
                <Expand aria-hidden="true" className="h-3.5 w-3.5" /> View larger
              </button>
              <button type="button" onClick={() => run(prompt.trim())} disabled={!prompt.trim()} className={`${toolButton} disabled:opacity-50`}>
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Another version
              </button>
              <a href={result} download={`spacesense-image.${extensionOf(result)}`} className={toolButton}>
                <Download aria-hidden="true" className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          )}
        </div>
      </div>
      {enlarged && result && <Lightbox src={result} alt={`AI-generated image for: ${resultPrompt || 'your prompt'}`} onClose={closeLightbox} />}
    </section>
  )
}
