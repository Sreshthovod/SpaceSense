import { ImageIcon } from 'lucide-react'
import { STYLES } from '../../data/sampleData'
import { formatINR } from '../../utils/format'
import { LIMITS } from '../../utils/validation'
import FloorPlan from './FloorPlan'

const inRange = (v, [lo, hi]) => v >= lo && v <= hi

/** One summary line. The value re-mounts when it changes, so it fades in afresh. */
function Row({ label, value, placeholder, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm">
        {value ? (
          <span key={value} className="brief-value inline-flex items-center gap-1.5 font-semibold text-ink">{children ?? value}</span>
        ) : (
          <span className="text-muted/80">{placeholder}</span>
        )}
      </dd>
    </div>
  )
}

/** A fine-line room for the empty photo frame. */
function FrameSketch() {
  return (
    <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full stroke-line" fill="none" strokeWidth="1" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <path d="M34 16 H126 V76 H34 Z M0 0 L34 16 M160 0 L126 16 M0 100 L34 76 M160 100 L126 76" />
    </svg>
  )
}

/** The brief as it stands, read straight from the form: nothing here is filled in for you. */
export default function RoomBrief({ form, imageUrl }) {
  const style = STYLES.find((s) => s.id === form.style)
  const l = Number(form.length) || 0
  const w = Number(form.width) || 0
  const h = Number(form.height) || 0
  const area = l * w
  const budget = Number(form.budget) || 0
  const sized = inRange(l, LIMITS.length) && inRange(w, LIMITS.width) && inRange(h, LIMITS.height)
  const checks = [!!imageUrl, !!form.roomType, sized, !!style, inRange(budget, LIMITS.budget)]
  const ready = checks.filter(Boolean).length

  return (
    <aside aria-label="Live brief" className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-sage-dark">Live brief</p>
        <p className="flex items-center gap-2 text-xs text-muted">
          <span aria-hidden="true" className="flex gap-1">
            {checks.map((ok, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${ok ? 'bg-sage-dark' : 'bg-line'}`} />)}
          </span>
          <span className="tabular-nums">{ready} of {checks.length} ready</span>
        </p>
      </div>

      <div className="relative mt-4 aspect-[16/10] overflow-hidden rounded-xl border border-line bg-cream">
        {imageUrl ? (
          <img key={imageUrl} src={imageUrl} alt="" className="photo-reveal absolute inset-0 h-full w-full bg-sand object-contain" />
        ) : (
          <>
            <FrameSketch />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sage-dark">
                <ImageIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="text-xs text-muted">Your room photo appears here</span>
            </div>
          </>
        )}
      </div>

      <dl className="mt-4">
        <Row label="Room" value={form.roomType} placeholder="Choose a room type" />
        <Row
          label="Area"
          value={area ? `${area.toLocaleString('en-IN', { maximumFractionDigits: 1 })} sq ft` : ''}
          placeholder="Add length and width"
        >
          {area.toLocaleString('en-IN', { maximumFractionDigits: 1 })} sq ft
          {h > 0 && <span className="font-normal text-muted">· {h} ft high</span>}
        </Row>
        <Row label="Style" value={style?.name} placeholder="Pick in step 2">
          <span aria-hidden="true" className="flex -space-x-1">
            {style?.swatch.map((c) => <span key={c} className="h-3.5 w-3.5 rounded-full border border-line shadow-sm" style={{ background: c }} />)}
          </span>
          {style?.name}
        </Row>
        <Row label="Budget" value={budget ? formatINR(budget) : ''} placeholder="Set in step 2" />
      </dl>

      <FloorPlan length={form.length} width={form.width} height={form.height} />
    </aside>
  )
}
