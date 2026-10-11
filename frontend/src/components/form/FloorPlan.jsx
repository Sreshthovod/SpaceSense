import { useId } from 'react'
import { LIMITS } from '../../utils/validation'

const W = 300
const H = 190
const PAD_X = 36
const PAD_Y = 34
const CX = W / 2
const CY = H / 2 + 4

const inRange = (v, [lo, hi]) => v >= lo && v <= hi
const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1))

/**
 * A top-down outline of the room in its real proportions (length across, width down), with dimension
 * lines. It only shows proportions: it is not a measured drawing. The outline is one unit square scaled
 * by CSS transforms, so changing a dimension glides the shape instead of redrawing it.
 */
export default function FloorPlan({ length, width, height }) {
  const dots = `plan-dots-${useId().replace(/:/g, '')}`
  const l = Number(length) || 0
  const w = Number(width) || 0
  const h = Number(height) || 0
  const ready = inRange(l, LIMITS.length) && inRange(w, LIMITS.width)
  const s = ready ? Math.min((W - PAD_X * 2) / l, (H - PAD_Y * 2) / w) : 0
  const rw = ready ? l * s : 150
  const rh = ready ? w * s : 96
  const top = CY - rh / 2
  const left = CX - rw / 2
  const t = (x, y, sx = 1, sy = 1) => ({ transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})` })

  return (
    <figure className="mt-5">
      <figcaption className="mb-2 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-semibold uppercase tracking-[0.16em] text-muted">Floor plan</span>
        <span className="text-muted">{ready ? `Proportions only${inRange(h, LIMITS.height) ? ` · ${fmt(h)} ft ceiling` : ''}` : ''}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl border border-line bg-cream"
        role="img"
        aria-label={ready ? `Approximate plan of a ${fmt(l)} by ${fmt(w)} foot room` : 'Enter length and width to see the room shape'}
      >
        <defs>
          <pattern id={dots} width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" className="fill-line" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={`url(#${dots})`} />
        {/* The room: a unit square centred on the origin, scaled to the room's proportions. */}
        <rect
          x="-0.5" y="-0.5" width="1" height="1"
          vectorEffect="non-scaling-stroke"
          className={`plan-shape ${ready ? 'fill-sage/10 stroke-sage-dark' : 'fill-none stroke-muted/60'}`}
          strokeWidth={ready ? 1.75 : 1.25}
          strokeDasharray={ready ? undefined : '5 5'}
          style={t(CX, CY, rw, rh)}
        />
        {ready ? (
          <g className="anim-fade">
            {/* Length, above the room */}
            <path d="M-0.5 0 H0.5 M-0.5 -3.5 V3.5 M0.5 -3.5 V3.5" vectorEffect="non-scaling-stroke" className="plan-shape stroke-muted" strokeWidth="1" style={t(CX, top - 11, rw, 1)} />
            <g className="plan-shape" style={t(CX, top - 17)}>
              <text textAnchor="middle" fontSize="10" fontWeight="600" className="fill-ink">{fmt(l)} ft</text>
            </g>
            {/* Width, left of the room */}
            <path d="M0 -0.5 V0.5 M-3.5 -0.5 H3.5 M-3.5 0.5 H3.5" vectorEffect="non-scaling-stroke" className="plan-shape stroke-muted" strokeWidth="1" style={t(left - 11, CY, 1, rh)} />
            <g className="plan-shape" style={t(left - 17, CY)}>
              <text textAnchor="middle" fontSize="10" fontWeight="600" className="fill-ink" transform="rotate(-90)">{fmt(w)} ft</text>
            </g>
            <g className="plan-shape" style={t(CX, CY + 4)}>
              <text textAnchor="middle" fontSize="11" fontWeight="600" className="fill-sage-dark">{(l * w).toLocaleString('en-IN', { maximumFractionDigits: 1 })} sq ft</text>
            </g>
          </g>
        ) : (
          <text x={CX} y={CY + 4} textAnchor="middle" fontSize="11" className="fill-muted">Add length and width</text>
        )}
      </svg>
    </figure>
  )
}
