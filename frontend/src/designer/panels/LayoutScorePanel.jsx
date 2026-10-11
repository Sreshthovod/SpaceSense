import { useMemo, useState } from 'react'
import { Gauge, Loader2, Wand2 } from 'lucide-react'
import { TEMPLATE_ROOM_TYPES } from '../model/templates'
import { scoreLayout } from '../model/layoutScore'
import { improveLayout } from '../model/layoutOptimize'

const select = 'mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark'
const RING = 2 * Math.PI * 22
const tone = (v) => (v >= 80 ? 'var(--color-sage-dark)' : v >= 60 ? 'var(--color-brass)' : 'var(--color-clay)')

/**
 * The layout score with its breakdown, and a button that lets the optimiser rearrange the room to
 * raise it. Read-only until the button is pressed; the improvement is one undoable change.
 */
export default function LayoutScorePanel({ design, roomType, onApply, onFocus, vastuDefault = false }) {
  const [type, setType] = useState(TEMPLATE_ROOM_TYPES.includes(roomType) ? roomType : TEMPLATE_ROOM_TYPES[0])
  const [vastu, setVastu] = useState(Boolean(vastuDefault))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const useVastu = vastu && Boolean(design.facing)
  const score = useMemo(() => scoreLayout(design, { roomType: type, vastu: useVastu }), [design, type, useVastu])
  const furnished = design.items.some((i) => !i.wall)

  const improve = () => {
    setBusy(true)
    setMessage('')
    // Let the button show it's working before the search runs.
    setTimeout(() => {
      const r = improveLayout(design, { roomType: type, vastu: useVastu, budgetMs: 1500 })
      setBusy(false)
      if (!r.moves) {
        setMessage('Nothing to improve: no move the rules allow would raise the score.')
        return
      }
      onApply(r.design)
      setMessage(`Score ${Math.round(r.before.total)} → ${Math.round(r.after.total)} with ${r.moves} adjustment${r.moves === 1 ? '' : 's'}. Undo brings the old layout back.`)
    }, 30)
  }

  return (
    <section aria-labelledby="score-heading" className="rounded-xl border border-line bg-white p-3">
      <h3 id="score-heading" className="flex items-center gap-2 font-display text-lg font-semibold">
        <Gauge aria-hidden="true" className="h-4 w-4 text-sage-dark" /> Layout score
      </h3>
      <p className="mt-1 text-xs text-muted">How well the room is arranged, from walkways to which way the seats face. Hover a line to see why.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold">
          Room type
          <select value={type} onChange={(e) => setType(e.target.value)} className={select}>
            {TEMPLATE_ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="mt-5 flex items-start gap-1.5 text-[11px] leading-snug" title={design.facing ? '' : "Set the room's direction with the compass first"}>
          <input type="checkbox" checked={vastu} onChange={(e) => setVastu(e.target.checked)} disabled={!design.facing} className="mt-0.5 accent-sage-dark" />
          <span>Include Vastu{design.facing ? '' : ' (set the direction first)'}</span>
        </label>
      </div>

      {!furnished ? (
        <p className="mt-3 rounded-lg bg-sand/60 p-2 text-xs">Place some furniture (or use a template) to see a score.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 50 50" aria-hidden="true" className="h-full w-full -rotate-90">
                <circle cx="25" cy="25" r="22" fill="none" stroke="var(--color-line)" strokeWidth="4" />
                <circle
                  cx="25" cy="25" r="22" fill="none" stroke={tone(score.total)} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={RING} strokeDashoffset={RING * (1 - score.total / 100)}
                  className="transition-[stroke-dashoffset] duration-700 ease-[var(--ease-out)]"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold tabular-nums" data-testid="layout-score">
                {Math.round(score.total)}
              </span>
            </div>
            <button
              type="button" onClick={improve} disabled={busy}
              className="press inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-ink/90 disabled:opacity-60"
            >
              {busy ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Wand2 aria-hidden="true" className="h-3.5 w-3.5" />}
              {busy ? 'Improving…' : 'Improve layout'}
            </button>
          </div>
          <ul className="mt-3 space-y-1.5" aria-label="Score breakdown">
            {score.terms.map((t) => {
              const pct = Math.round(t.score * 100)
              const row = (
                <>
                  <span className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-medium">{t.label}</span>
                    <span className="tabular-nums text-muted">{pct}%</span>
                  </span>
                  <span aria-hidden="true" className="mt-0.5 block h-1 overflow-hidden rounded-full bg-line">
                    <span className="block h-full origin-left rounded-full transition-transform duration-500 ease-[var(--ease-out)]" style={{ transform: `scaleX(${t.score})`, background: tone(pct) }} />
                  </span>
                  {t.note && <span className="mt-0.5 block text-[10px] leading-snug text-muted">{t.note}</span>}
                </>
              )
              return (
                <li key={t.id}>
                  {t.uids.length ? (
                    <button type="button" onClick={() => onFocus(t.uids[0])} title="Select the piece this is about" className="block w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-sand">{row}</button>
                  ) : (
                    <div className="px-1 py-0.5">{row}</div>
                  )}
                </li>
              )
            })}
          </ul>
          {message && <p role="status" className="anim-up mt-2 text-xs text-sage-dark">{message}</p>}
        </>
      )}
    </section>
  )
}
