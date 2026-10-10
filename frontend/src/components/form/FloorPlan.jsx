import { STYLES } from '../../data/sampleData'

export default function FloorPlan({ length, width, items = [], styleId, compact = false }) {
  const l = Number(length) || 0
  const w = Number(width) || 0
  const ready = l >= 4 && w >= 4
  const ratio = ready ? l / w : 1.2
  const style = STYLES.find((s) => s.id === styleId)
  const pad = 18
  const boxW = 280
  const boxH = Math.max(120, Math.min(200, boxW / ratio))
  const innerW = boxW - pad * 2
  const innerH = boxH - pad * 2

  const chips = items.slice(0, 6).map((item, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    return {
      ...item,
      x: pad + 8 + col * (innerW / 3),
      y: pad + 10 + row * (innerH / 2.4),
      w: innerW / 3.6,
      h: innerH / 4.2,
    }
  })

  return (
    <figure className={compact ? '' : 'mt-4'}>
      {!compact && <figcaption className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Floor plan</figcaption>}
      <svg viewBox={`0 0 ${boxW} ${boxH}`} className="w-full rounded-xl border border-line bg-sand/70" role="img" aria-label={ready ? `Plan of a ${l} by ${w} foot room` : 'Enter dimensions to see a plan'}>
        <rect x="8" y="8" width={boxW - 16} height={boxH - 16} fill="none" style={{ stroke: style?.swatch[2] || 'var(--color-sage-dark)' }} strokeWidth="2" />
        {ready ? (
          <>
            <text x={boxW / 2} y={16} textAnchor="middle" fontSize="9" className="fill-muted">{l} ft</text>
            <text x="12" y={boxH / 2} fontSize="9" className="fill-muted" transform={`rotate(-90 12 ${boxH / 2})`}>{w} ft</text>
            {chips.map((chip) => (
              <g key={chip.id}>
                <rect className="anim-fade" x={chip.x} y={chip.y} width={chip.w} height={chip.h} rx="2" fill={chip.tone || style?.swatch[0] || '#c9b9a6'} opacity="0.85" />
              </g>
            ))}
          </>
        ) : (
          <text x={boxW / 2} y={boxH / 2} textAnchor="middle" fontSize="11" className="fill-muted">Add length and width</text>
        )}
      </svg>
    </figure>
  )
}
