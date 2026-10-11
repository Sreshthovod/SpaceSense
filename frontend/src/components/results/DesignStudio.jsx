import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Pencil, RotateCcw, Wand2 } from 'lucide-react'
import { editRoomPhoto, getImageProviders } from '../../services/api'
import { toApprovableItems } from '../../utils/recommendations'
import Button from '../ui/Button'
import Card from '../ui/Card'
import PhotoComparison from './PhotoComparison'

const EDITORS = [
  { id: 'gemini', name: 'Gemini', note: 'Google AI. Works from your full-quality photo and keeps the room closest to the original.' },
  { id: 'cloudflare', name: 'Cloudflare', note: 'FLUX on Cloudflare, free daily allowance. Works from a small copy of your photo, so details can differ more.' },
]

export const APPROVAL_QUESTION = 'Would you like me to apply these changes to your original room photo?'

/**
 * Consult-first flow: shows the original photo and asks for explicit approval.
 * The photo is only sent for editing from the "Yes, edit my photo" action.
 */
export default function DesignStudio({ form, photo, originalUrl, recommendations, onEdited }) {
  const items = useMemo(() => toApprovableItems(recommendations), [recommendations])
  const [phase, setPhase] = useState('ask') // ask | customize | later | editing | done | error
  const [selected, setSelected] = useState(() => new Set(items.map((i) => i.id)))
  const [notes, setNotes] = useState('')
  const [draft, setDraft] = useState(null) // { selected, notes } while customizing
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [provider, setProvider] = useState('gemini')
  const [available, setAvailable] = useState(null) // { cloudflare, gemini } once known
  const inFlight = useRef(false)
  const abortRef = useRef(null)
  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    getImageProviders(controller.signal)
      .then((status) => {
        setAvailable(status)
        setProvider((current) => (status[current] ? current : EDITORS.find((e) => status[e.id])?.id ?? current))
      })
      .catch(() => {}) // backend unreachable: editing will show the real error
    return () => controller.abort()
  }, [])

  const approvedItems = items.filter((i) => selected.has(i.id))
  // Only a real edit carries an image; the original upload is never replaced.
  const editedUrl = result?.status === 'edited' ? result.image_url : null
  // Let the results page know, so the 3D designer can use the edited photo instead of the original.
  useEffect(() => { onEdited?.(editedUrl) }, [editedUrl, onEdited])

  const applyEdits = async () => {
    if (inFlight.current || approvedItems.length === 0) return
    inFlight.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('editing')
    setError('')
    try {
      const data = await editRoomPhoto(
        { form, photo, items: approvedItems.map((i) => i.instruction), notes: notes.trim(), provider },
        controller.signal,
      )
      setResult(data)
      setPhase('done')
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err.message || 'The photo could not be edited.')
      setPhase('error')
    } finally {
      inFlight.current = false
    }
  }

  const startCustomize = () => {
    setDraft({ selected: new Set(selected), notes })
    setPhase('customize')
  }
  const toggle = (id) => setDraft((d) => {
    const next = new Set(d.selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { ...d, selected: next }
  })
  const saveCustomize = () => {
    setSelected(draft.selected)
    setNotes(draft.notes)
    setDraft(null)
    setPhase('ask')
  }

  const groups = [...new Set(items.map((i) => i.section))]

  return (
    <Card className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <PhotoComparison originalUrl={originalUrl} editedUrl={editedUrl} />

      <div aria-live="polite" className="flex flex-col justify-center">
        {phase === 'ask' && (
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight">{APPROVAL_QUESTION}</h2>
            <p className="mt-3 text-sm text-muted">
              {approvedItems.length} of {items.length} recommended changes selected{notes.trim() ? ', plus your notes' : ''}.
              Your room's walls, doors, windows and camera angle are kept; only the selected changes are applied.
            </p>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-semibold">Edit my photo with</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {EDITORS.map((e) => {
                  const missing = available !== null && !available[e.id]
                  return (
                    <label
                      key={e.id}
                      className={`rounded-xl border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sage-dark ${
                        missing ? 'cursor-not-allowed border-line bg-sand/40 text-muted' : 'cursor-pointer'
                      } ${provider === e.id && !missing ? 'border-ink bg-sand/60' : 'border-line bg-white'}`}
                    >
                      <input
                        type="radio" name="photo-editor" value={e.id} className="sr-only"
                        checked={provider === e.id} disabled={missing} onChange={() => setProvider(e.id)}
                      />
                      <span className="block font-semibold">{e.name}{missing && <span className="ml-1 text-xs font-normal">(not set up)</span>}</span>
                      <span className="mt-0.5 block text-xs text-muted">{e.note}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button onClick={applyEdits} disabled={approvedItems.length === 0}>
                <Wand2 aria-hidden="true" className="h-4 w-4" /> Yes, edit my photo
              </Button>
              <Button variant="secondary" onClick={startCustomize}>
                <Pencil aria-hidden="true" className="h-4 w-4" /> Change recommendations
              </Button>
              <Button variant="ghost" onClick={() => setPhase('later')}>Not now</Button>
            </div>
            {approvedItems.length === 0 && <p className="mt-3 text-xs text-clay">Select at least one change to edit your photo.</p>}
          </div>
        )}

        {phase === 'customize' && draft && (
          <div>
            <h2 className="font-display text-2xl font-semibold">Choose the changes to apply</h2>
            <div className="mt-4 max-h-80 space-y-4 overflow-y-auto pr-1">
              {groups.map((g) => (
                <fieldset key={g}>
                  <legend className="eyebrow">{g}</legend>
                  {items.filter((i) => i.section === g).map((i) => (
                    <label key={i.id} className="mt-2 flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={draft.selected.has(i.id)} onChange={() => toggle(i.id)} className="mt-1 accent-sage-dark" />
                      <span>{i.text}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <label htmlFor="edit-notes" className="mt-4 block text-sm font-semibold">Anything else to change or keep?</label>
            <textarea
              id="edit-notes" rows={3} maxLength={1000} value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
              placeholder="e.g. keep my bookshelf, use a navy sofa instead"
            />
            <div className="mt-4 flex gap-3">
              <Button onClick={saveCustomize}><Check aria-hidden="true" className="h-4 w-4" /> Save changes</Button>
              <Button variant="ghost" onClick={() => { setDraft(null); setPhase('ask') }}>Cancel</Button>
            </div>
          </div>
        )}

        {phase === 'later' && (
          <div>
            <p className="font-semibold">No problem. Your original photo is unchanged.</p>
            <p className="mt-1 text-sm text-muted">You can apply the recommendations whenever you're ready.</p>
            <Button variant="secondary" className="mt-4" onClick={() => setPhase('ask')}>Review and apply changes</Button>
          </div>
        )}

        {phase === 'editing' && (
          <div role="status" className="flex items-center gap-3">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-sage-dark" />
            <div>
              <p className="font-semibold">Editing your original photo…</p>
              <p className="text-sm text-muted">This can take up to a minute.</p>
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div>
            {editedUrl ? (
              <>
                <p className="font-display text-2xl font-semibold">Here's your edited room.</p>
                <p className="mt-2 text-sm text-muted">{result.message}</p>
                {result.preservation && (
                  <p className={`mt-2 rounded-xl p-2 text-xs ${result.preservation.preserved ? 'bg-sand text-muted' : 'border border-clay/40 text-clay'}`}>
                    {result.preservation.note}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold">No edited photo was created.</p>
                <p className="mt-1 text-sm text-muted">{result.message}</p>
              </>
            )}
            <Button variant="secondary" className="mt-4" onClick={startCustomize}>
              <Pencil aria-hidden="true" className="h-4 w-4" /> Try different changes
            </Button>
          </div>
        )}

        {phase === 'error' && (
          <div>
            <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>
            <p className="mt-2 text-sm text-muted">Your original photo is unchanged.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={applyEdits}><RotateCcw aria-hidden="true" className="h-4 w-4" /> Try again</Button>
              <Button variant="secondary" onClick={startCustomize}>Change recommendations</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
