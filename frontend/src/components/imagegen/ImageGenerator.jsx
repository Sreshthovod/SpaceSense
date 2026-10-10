import { useEffect, useRef, useState } from 'react'
import { Download, ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { editImage, generateImage, getImageProviders } from '../../services/api'
import Button from '../ui/Button'
import Card from '../ui/Card'

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

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [provider, setProvider] = useState('cloudflare')
  const [available, setAvailable] = useState(null) // { cloudflare, gemini } once known; null while loading or unreachable
  const inFlight = useRef(false)
  const abortRef = useRef(null)
  const inputRef = useRef(null)

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

  const submit = async (e) => {
    e.preventDefault()
    const text = prompt.trim()
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
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'Could not generate the image. Please try again.')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <section id="image-lab" aria-labelledby="image-lab-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <p className="eyebrow">Image Lab</p>
      <h2 id="image-lab-heading" className="mt-4 font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">Imagine a space.</h2>
      <p className="mb-10 mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
        Describe a room and get an AI-generated picture. Add a photo to generate on top of it. Pick Cloudflare or Gemini; either way the image is made by the SpaceSense server.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="image-prompt" className="mb-2 block text-sm font-semibold">Prompt</label>
              <textarea
                id="image-prompt" rows={5} maxLength={MAX_PROMPT} value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A sunlit Scandinavian living room with a linen sofa and a jute rug"
                className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-right text-xs text-muted">{prompt.length} / {MAX_PROMPT}</p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">AI provider</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROVIDERS.map((p) => {
                  const missing = available !== null && !available[p.id]
                  return (
                    <label
                      key={p.id}
                      className={`rounded-xl border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sage-dark ${
                        missing ? 'cursor-not-allowed border-line bg-sand/40 text-muted' : 'cursor-pointer'
                      } ${provider === p.id && !missing ? 'border-ink bg-sand/60' : 'border-line bg-white'}`}
                    >
                      <input
                        type="radio" name="image-provider" value={p.id} className="sr-only"
                        checked={provider === p.id} disabled={missing || pending}
                        onChange={() => setProvider(p.id)}
                      />
                      <span className="block font-semibold">{p.name}{missing && <span className="ml-1 text-xs font-normal">(not set up)</span>}</span>
                      <span className="mt-0.5 block text-xs text-muted">{p.note}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div>
              <span id="image-upload-label" className="mb-2 block text-sm font-semibold">
                Starting image <span className="font-normal text-muted">(optional)</span>
              </span>
              {previewUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-cream p-2">
                  <img src={previewUrl} alt="Your uploaded starting image" className="h-16 w-16 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{file?.name}</span>
                  <button
                    type="button" onClick={clearFile}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-clay hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              ) : (
                <Button variant="secondary" aria-labelledby="image-upload-label" onClick={() => inputRef.current?.click()}>
                  <ImagePlus aria-hidden="true" className="h-4 w-4" /> Upload image
                </Button>
              )}
              <input
                ref={inputRef} type="file" accept={UPLOAD_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true"
                onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }}
              />
              <p className="mt-1 text-xs text-muted">PNG, JPEG or WebP, up to {MAX_UPLOAD_MB} MB. Cloudflare shrinks large photos first; Gemini does not.</p>
              {uploadError && <p role="alert" className="mt-1 text-xs text-red-700">{uploadError}</p>}
            </div>

            <Button type="submit" disabled={pending || !prompt.trim()}>
              {pending
                ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Generating…</>
                : <><Sparkles aria-hidden="true" className="h-4 w-4" /> Generate</>}
            </Button>
          </form>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        </Card>

        <Card className="flex min-h-[18rem] flex-col items-center justify-center">
          {pending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Creating your image. This can take up to a minute.
            </p>
          ) : result ? (
            <div className="w-full">
              <img src={result} alt={`AI-generated image for: ${prompt.trim() || 'your prompt'}`} className="w-full rounded-xl border border-line" />
              <div className="mt-4 flex justify-end">
                <Button as="a" variant="secondary" href={result} download={`spacesense-image.${extensionOf(result)}`}>
                  <Download aria-hidden="true" className="h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted">Your image will appear here.</p>
          )}
        </Card>
      </div>
    </section>
  )
}
