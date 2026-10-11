import { useState } from 'react'
import { CircleAlert, CircleCheck, CircleMinus, Compass } from 'lucide-react'
import { TEMPLATE_ROOM_TYPES } from '../model/templates'
import { roomSize } from '../model/design'
import { vastuReport } from '../model/compass'
import FacingPicker from './FacingPicker'

const select = 'mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark'
const ICON = { ok: CircleCheck, warn: CircleAlert, na: CircleMinus }
const TONE = { ok: 'text-sage-dark', warn: 'text-clay', na: 'text-muted' }
const SAY = { ok: 'followed', warn: 'not followed', na: 'nothing to check' }

/**
 * Vastu check: compares what's placed with common Vastu guidelines for the room type, using the room's
 * compass direction. Read-only: it never moves anything. Clicking a row selects the piece it's about.
 */
export default function VastuPanel({ design, roomType, onFacing, onFocus }) {
  const [type, setType] = useState(TEMPLATE_ROOM_TYPES.includes(roomType) ? roomType : TEMPLATE_ROOM_TYPES[0])
  const report = vastuReport(design, type, roomSize(design))

  return (
    <section aria-labelledby="vastu-heading" className="rounded-xl border border-line bg-white p-3">
      <h3 id="vastu-heading" className="flex items-center gap-2 font-display text-lg font-semibold">
        <Compass aria-hidden="true" className="h-4 w-4 text-sage-dark" /> Vastu check
      </h3>
      <p className="mt-1 text-xs text-muted">
        Compares your layout with widely quoted Vastu guidelines for the room. A general guide, not a professional consultation.
      </p>
      <label className="mt-3 block text-[11px] font-semibold">
        Room type
        <select value={type} onChange={(e) => setType(e.target.value)} className={select}>
          {TEMPLATE_ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <div className="mt-3">
        <FacingPicker facing={design.facing} onChange={onFacing} />
      </div>
      {!report ? (
        <p className="mt-3 rounded-lg bg-sand/60 p-2 text-xs">Set the room's direction above (or with the compass in the 3D view) to check the layout.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2" aria-live="polite">
            <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full origin-left rounded-full bg-sage-dark transition-transform duration-500 ease-[var(--ease-out)]"
                style={{ transform: `scaleX(${report.total ? report.followed / report.total : 0})` }}
              />
            </div>
            <p className="text-xs font-semibold" data-testid="vastu-score">
              {report.total ? `${report.followed} of ${report.total} followed` : 'Nothing to check yet'}
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {report.checks.map((c) => {
              const Icon = ICON[c.status]
              const row = (
                <>
                  <Icon aria-hidden="true" className={`mt-px h-3.5 w-3.5 shrink-0 ${TONE[c.status]}`} />
                  <span className={c.status === 'na' ? 'text-muted' : ''}>{c.text}</span>
                  <span className="sr-only">: {SAY[c.status]}</span>
                </>
              )
              return (
                <li key={c.id}>
                  {c.uids.length ? (
                    <button type="button" onClick={() => onFocus(c.uids[0])} className="flex w-full items-start gap-1.5 rounded-md px-1 py-0.5 text-left text-xs transition-colors hover:bg-sand">
                      {row}
                    </button>
                  ) : (
                    <p className="flex items-start gap-1.5 px-1 py-0.5 text-xs">{row}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
