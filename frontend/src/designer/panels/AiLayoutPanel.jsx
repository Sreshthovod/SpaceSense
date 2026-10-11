import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { aiLayout, getImageProviders } from '../../services/api'
import { MAX_NOTE, buildFromLayout, catalogSummary } from '../model/aiLayout'
import { newUid } from '../model/ids'
import { TEMPLATE_ROOM_TYPES, exampleLayout } from '../model/templates'
import { roomSize } from '../model/design'
import ConfirmDialog from '../layout/ConfirmDialog'
import { vastuReport } from '../model/compass'
import { scoreLayout } from '../model/layoutScore'
import { improveLayout } from '../model/layoutOptimize'

const VARIANTS = 3 // layouts asked for in one request; the best is kept
import FacingPicker from './FacingPicker'

const select = 'mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark'

/**
 * Asks Gemini (a free text model) where to put furniture in this room, then places only what the
 * designer's own rules accept. It replaces what's placed, so it asks first when the room isn't empty,
 * and the whole thing can be undone. Your photo is sent only if you tick the box.
 */
export default function AiLayoutPanel({ design, roomType, photo, onApply, onDialog, vastuDefault = false, onFacing }) {
  const [type, setType] = useState(TEMPLATE_ROOM_TYPES.includes(roomType) ? roomType : TEMPLATE_ROOM_TYPES[0])
  // Vastu mode: the AI is told the Vastu guidelines in terms of this room's walls, then the result is checked.
  const [vastu, setVastu] = useState(Boolean(vastuDefault))
  const [notes, setNotes] = useState('')
  const [sharePhoto, setSharePhoto] = useState(false)
  const [available, setAvailable] = useState(null) // { gemini } once known; null while loading or unreachable
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [stage, setStage] = useState('') // what's happening while pending
  const [result, setResult] = useState(null) // { text } | { error }
  const inFlight = useRef(false)
  const abortRef = useRef(null)
  const hasContent = design.items.length + design.openings.length > 0
  const unavailable = available !== null && !available.gemini

  useEffect(() => {
    const controller = new AbortController()
    getImageProviders(controller.signal).then(setAvailable).catch(() => {}) // backend down: arranging will show the real error
    return () => controller.abort()
  }, [])
  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => { onDialog?.(confirming) }, [confirming, onDialog])

  const arrange = async () => {
    if (inFlight.current) return
    inFlight.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)
    setResult(null)
    try {
      const size = roomSize(design)
      const proposal = await aiLayout({
        room: {
          room_type: type, length_ft: size.length, width_ft: size.width, height_ft: size.height,
          style: design.style, budget_inr: design.budget, vastu,
        },
        options: {
          notes: notes.trim(), ...catalogSummary(), example: exampleLayout(type, size),
          ...(vastu ? { compass_back: design.facing } : {}),
          variants: VARIANTS,
        },
        photo: sharePhoto ? photo : null,
      }, controller.signal)
      // Every layout the AI sent is built with the normal placement rules, scored, and the best ones are
      // fine-tuned by the optimiser; the highest-scoring result is applied.
      const built = [proposal, ...(proposal.alternatives || [])]
        .map((p) => ({ p, r: buildFromLayout(design, p, newUid) }))
        .filter((b) => b.r.placed > 0)
      if (!built.length) {
        setResult({ error: "The AI's layout didn't fit this room, so nothing was changed. Try again, add a note, or use a template." })
        return
      }
      setStage('Scoring and fine-tuning…')
      await new Promise((resolve) => setTimeout(resolve, 0)) // let the status paint before the busy work
      const opts = { roomType: type, vastu }
      const most = Math.max(...built.map((b) => b.r.placed))
      // A layout that simply leaves pieces out shouldn't win by having fewer things to get wrong.
      const ranked = built
        .map((b) => ({ ...b, raw: scoreLayout(b.r.design, opts).total - 2 * (most - b.r.placed) }))
        .sort((a, b) => b.raw - a.raw)
      const tuned = ranked.slice(0, 2).map((b) => ({ ...b, opt: improveLayout(b.r.design, { ...opts, budgetMs: 700 }) }))
      const best = tuned.reduce((a, b) => (b.opt.after.total > a.opt.after.total ? b : a))
      const { p: chosen, r: { placed, moved, skipped, leftOut, addedOpenings } } = best
      const next = best.opt.design
      onApply(next)
      const dropped = skipped
        ? ` ${skipped} didn't fit and ${skipped === 1 ? 'was' : 'were'} left out (${[...new Set(leftOut)].slice(0, 4).join(', ')}${new Set(leftOut).size > 4 ? '…' : ''}).`
        : ''
      const opened = addedOpenings.length ? ` Added ${addedOpenings.map((o) => `a ${o}`).join(' and ')}.` : ''
      const nudged = moved ? ` ${moved} ${moved === 1 ? 'was' : 'were'} moved a little to fit.` : ''
      const report = vastu ? vastuReport(next, type, roomSize(next)) : null
      const vastuNote = report?.total ? ` Vastu check: ${report.followed} of ${report.total} guidelines followed.` : ''
      const picked = built.length > 1 ? ` Best of ${built.length} AI layouts.` : ''
      const scoreNote = ` Layout score ${Math.round(best.opt.before.total)} → ${Math.round(best.opt.after.total)}/100 after fine-tuning${best.opt.moves ? ` (${best.opt.moves} adjustment${best.opt.moves === 1 ? '' : 's'})` : ''}.`
      setResult({ text: `${chosen.summary ? `${chosen.summary} ` : ''}${placed} piece${placed === 1 ? '' : 's'} placed.${opened}${nudged}${dropped}${picked}${scoreNote}${vastuNote} Undo brings your last design back.` })
    } catch (err) {
      if (!controller.signal.aborted) setResult({ error: err.message || 'The AI could not arrange this room. Please try again.' })
    } finally {
      inFlight.current = false
      setPending(false)
      setStage('')
    }
  }
  const request = () => (hasContent ? setConfirming(true) : arrange())

  return (
    <section aria-labelledby="ai-layout-heading" className="rounded-xl border border-line bg-white p-3">
      <h3 id="ai-layout-heading" className="flex items-center gap-2 font-display text-lg font-semibold">
        <Sparkles aria-hidden="true" className="h-4 w-4 text-sage-dark" /> Arrange with AI
      </h3>
      <p className="mt-1 text-xs text-muted">
        Gemini suggests three layouts for this room. Each is checked by the designer's placement rules, scored, and the best is fine-tuned before it's placed. Anything that doesn't fit is left out. Products aren't chosen.
      </p>
      <label className="mt-3 block text-[11px] font-semibold">
        Room type
        <select value={type} onChange={(e) => setType(e.target.value)} className={select} disabled={pending}>
          {TEMPLATE_ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label htmlFor="ai-notes" className="mt-3 block text-[11px] font-semibold">
        Anything specific? <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id="ai-notes" rows={2} maxLength={MAX_NOTE} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={pending}
        placeholder="e.g. a cosy reading corner, keep the middle open"
        className="mt-1 w-full resize-y rounded-lg border border-line bg-white px-2 py-1.5 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark"
      />
      <label className="mt-3 flex items-start gap-2 text-[11px] leading-snug">
        <input type="checkbox" checked={vastu} onChange={(e) => setVastu(e.target.checked)} disabled={pending} className="mt-0.5 accent-sage-dark" />
        <span>
          <span className="font-semibold">Vastu mode</span>: arrange by common Vastu guidelines (heavy pieces south and west, the north-east kept clear, and so on), where the room allows.
        </span>
      </label>
      {vastu && !design.facing && (
        <div className="anim-up mt-2 rounded-lg border border-line bg-sand/50 p-2">
          <FacingPicker facing={design.facing} onChange={onFacing} compact />
          <p className="mt-1 text-[11px] text-clay">Vastu mode needs the room's direction.</p>
        </div>
      )}
      {photo && (
        <label className="mt-2 flex items-start gap-2 text-[11px] leading-snug">
          <input type="checkbox" checked={sharePhoto} onChange={(e) => setSharePhoto(e.target.checked)} disabled={pending} className="mt-0.5 accent-sage-dark" />
          <span>
            Also send my photo, so it can spot windows and doors. It goes to Google's Gemini; on the free tier Google may use it to improve its products.
          </span>
        </label>
      )}
      <button
        type="button" onClick={request} disabled={pending || unavailable || (vastu && !design.facing)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? <><Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> {stage || 'Arranging…'}</>
          : <><Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> Arrange with AI</>}
      </button>
      {unavailable && <p className="mt-2 text-xs text-clay">AI arrange needs a Gemini key on the server (GEMINI_API_KEY).</p>}
      {result?.text && <p role="status" className="mt-2 text-xs text-sage-dark">{result.text}</p>}
      {result?.error && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{result.error}</p>}
      {confirming && (
        <ConfirmDialog
          title="Replace this room with an AI layout?"
          message="Everything you've placed, painted and chosen will be replaced. You can undo this, or restore it later from the Designs menu."
          confirmLabel="Arrange with AI"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); arrange() }}
        />
      )}
    </section>
  )
}
