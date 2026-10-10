import { STYLES } from '../../data/sampleData'
import { formatINR } from '../../utils/format'
import FloorPlan from './FloorPlan'

export default function RoomBrief({ form, imageUrl }) {
  const style = STYLES.find((s) => s.id === form.style)
  const area = (Number(form.length) || 0) * (Number(form.width) || 0)
  const budget = Number(form.budget) || 0

  return (
    <aside className="rounded-2xl border border-line bg-white p-5 shadow-sm lg:sticky lg:top-20">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sage-dark">Live brief</p>
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-sand">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="aspect-[16/10] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center text-xs text-muted">Photo appears here</div>
        )}
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Room</dt>
          <dd className="font-medium">{form.roomType || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Area</dt>
          <dd className="font-medium">{area ? `${area.toLocaleString('en-IN')} sq ft` : '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Style</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            {style?.swatch.map((c) => (
              <span key={c} className="h-3 w-3 rounded-full border border-black/10" style={{ background: c }} />
            ))}
            {style?.name || '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Budget</dt>
          <dd className="font-medium">{budget ? formatINR(budget) : '—'}</dd>
        </div>
      </dl>
      <FloorPlan length={form.length} width={form.width} styleId={form.style} />
    </aside>
  )
}
