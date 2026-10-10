import { useRef, useState } from 'react'
import { Box, Copy, RotateCcw, Trash2, TriangleAlert } from 'lucide-react'
import { WALL_LABELS, onWall, roomSize, wallDims } from '../model/design'
import { wallItemSpec } from '../model/catalog'
import {
  clampToWall, clientToWall, describeItem, formatFeet, halfExtents, measurements, snapPosition, snapRotation, wallWarnings,
} from '../model/wallPlacement'
import WallShape from './WallShape'

const MARGIN = 1.4 // feet of space around the wall for labels
const HANDLE = 0.22

const rotate = ([x, y], deg) => {
  const r = (deg * Math.PI) / 180
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]
}

function Measure({ x1, y1, x2, y2, label, vertical }) {
  if (Math.hypot(x2 - x1, y2 - y1) < 0.05) return null
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g className="pointer-events-none" stroke="#a65f3c" strokeWidth="0.03">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="0.08 0.06" />
      <g transform={`translate(${mx} ${my})`}>
        <rect x={vertical ? 0.08 : -0.55} y={vertical ? -0.2 : -0.46} width="1.1" height="0.4" rx="0.1" fill="#fff" stroke="none" />
        <text x={vertical ? 0.63 : 0} y={vertical ? 0.1 : -0.16} fontSize="0.28" textAnchor="middle" fill="#a65f3c" stroke="none">{label}</text>
      </g>
    </g>
  )
}

/**
 * Front-facing, orthographic view of one wall. Drags are previewed locally and committed on release,
 * so one drag is one edit.
 */
export default function WallEditor({ design, wallId, selected, onSelect, dispatch, onDone, newUid, snap = true }) {
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null) // { mode, uid, start, origin, draft, guides }
  const [confirmReset, setConfirmReset] = useState(false)
  const wall = wallDims(roomSize(design), wallId)
  const color = design.walls[wallId].color
  const placed = onWall(design, wallId).map((i) => (drag?.uid === i.uid ? drag.draft : i))
  const selectedItem = placed.find((i) => i.uid === selected)
  const warnings = wallWarnings(placed)
  const flagged = new Set(warnings.flatMap((w) => w.ids))
  const viewBox = [-MARGIN, -MARGIN, wall.span + MARGIN * 2, wall.height + MARGIN * 2]
  const sy = (y) => wall.height - y // wall feet (y up) -> SVG (y down)

  const pointer = (e) => clientToWall(svgRef.current.getBoundingClientRect(), viewBox, e.clientX, e.clientY, wall.height)

  const begin = (mode, item) => (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    onSelect(item.uid)
    svgRef.current.setPointerCapture?.(e.pointerId)
    setDrag({ mode, uid: item.uid, start: pointer(e), origin: item, draft: item, guides: [] })
  }

  const move = (e) => {
    if (!drag) return
    const p = pointer(e)
    const { origin } = drag
    const others = onWall(design, wallId).filter((i) => i.uid !== drag.uid)
    let next = origin
    let guides = []
    if (drag.mode === 'move') {
      const moved = { ...origin, x: origin.x + p.x - drag.start.x, y: origin.y + p.y - drag.start.y }
      const snapped = e.altKey || !snap ? { x: moved.x, y: moved.y, guides: [] } : snapPosition(moved, others, wall)
      next = clampToWall({ ...moved, x: snapped.x, y: snapped.y }, wall)
      // Only show a guide if clamping didn't pull the item off it.
      guides = snapped.guides.filter((g) => (g.axis === 'x' ? next.x === snapped.x : next.y === snapped.y))
    } else if (drag.mode === 'resize') {
      const spec = wallItemSpec(origin.catalogId)
      const [lx, ly] = rotate([p.x - origin.x, p.y - origin.y], -origin.rotation)
      let w = Math.max(0.1, Math.abs(lx) * 2)
      let h = Math.max(0.1, Math.abs(ly) * 2)
      if (spec.lockAspect) {
        const k = Math.max(w / origin.w, h / origin.h)
        w = origin.w * k
        h = origin.h * k
      }
      if (spec.resize === 'width') h = origin.h
      const round = (v) => (e.altKey || !snap ? v : Math.round(v * 4) / 4)
      next = clampToWall({ ...origin, w: round(w), h: spec.lockAspect ? round(w) * (origin.h / origin.w) : round(h) }, wall)
    } else if (drag.mode === 'rotate') {
      const deg = (Math.atan2(-(p.x - origin.x), p.y - origin.y) * 180) / Math.PI
      next = clampToWall({ ...origin, rotation: e.altKey ? Math.round(deg) : snapRotation(deg) }, wall)
    }
    setDrag({ ...drag, draft: next, guides })
  }

  const end = () => {
    if (!drag) return
    const { x, y, w, h, rotation } = drag.draft
    dispatch({ type: 'updatePlaced', uid: drag.uid, changes: { x, y, w, h, rotation } })
    setDrag(null)
  }

  const resetWall = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    setConfirmReset(false)
    onSelect(null)
    dispatch({ type: 'resetWall', wall: wallId })
  }

  const m = selectedItem && measurements(selectedItem, wall)
  const toolButton = 'inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex h-full min-h-0 flex-col bg-sand/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-cream px-3 py-2">
        <h3 className="font-display text-xl font-semibold">{WALL_LABELS[wallId]} <span className="text-sm font-normal text-muted">{formatFeet(wall.span)} × {formatFeet(wall.height)}</span></h3>
        <div role="toolbar" aria-label="Wall item tools" className="flex flex-wrap gap-1.5">
          <button type="button" className={toolButton} disabled={!selectedItem} onClick={() => {
            const uid = newUid()
            dispatch({ type: 'duplicatePlaced', uid: selected, newUid: uid })
            onSelect(uid)
          }}>
            <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button type="button" className={toolButton} disabled={!selectedItem} onClick={() => {
            dispatch({ type: 'removePlaced', uid: selected })
            onSelect(null)
          }}>
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Delete
          </button>
          <button type="button" className={`${toolButton} ${confirmReset ? 'border-clay text-clay' : ''}`} onClick={resetWall}>
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" /> {confirmReset ? 'Click again to clear this wall' : 'Reset wall'}
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-ink/90" onClick={onDone}>
            <Box aria-hidden="true" className="h-3.5 w-3.5" /> Back to 3D room
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 p-2">
        <svg
          ref={svgRef}
          viewBox={viewBox.join(' ')}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full select-none"
          style={{ touchAction: 'none' }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerDown={() => onSelect(null)}
          role="group"
          aria-label={`${WALL_LABELS[wallId]}, ${formatFeet(wall.span)} wide and ${formatFeet(wall.height)} high, seen from inside the room`}
        >
          <rect x={0} y={0} width={wall.span} height={wall.height} fill={color} stroke="#5c5f55" strokeWidth="0.04" />
          <g stroke="#242620" strokeOpacity="0.08" strokeWidth="0.015" className="pointer-events-none">
            {Array.from({ length: Math.floor(wall.span) }, (_, i) => <line key={`gx${i}`} x1={i + 1} y1={0} x2={i + 1} y2={wall.height} />)}
            {Array.from({ length: Math.floor(wall.height) }, (_, i) => <line key={`gy${i}`} x1={0} y1={sy(i + 1)} x2={wall.span} y2={sy(i + 1)} />)}
          </g>
          <line x1={-0.3} y1={wall.height} x2={wall.span + 0.3} y2={wall.height} stroke="#242620" strokeWidth="0.06" />
          <g fontSize="0.32" fill="#5c5f55" className="pointer-events-none">
            <text x={wall.span / 2} y={-0.45} textAnchor="middle">{formatFeet(wall.span)}</text>
            <text x={-0.45} y={wall.height / 2} textAnchor="middle" transform={`rotate(-90 ${-0.45} ${wall.height / 2})`}>{formatFeet(wall.height)}</text>
            <text x={0} y={wall.height + 0.45}>Left corner</text>
            <text x={wall.span} y={wall.height + 0.45} textAnchor="end">Right corner</text>
          </g>

          {placed.map((item) => {
            const spec = wallItemSpec(item.catalogId)
            const isSelected = item.uid === selected
            const { hw, hh } = halfExtents(item)
            return (
              <g key={item.uid}>
                <g
                  transform={`translate(${item.x} ${sy(item.y)}) rotate(${-item.rotation})`}
                  onPointerDown={begin('move', item)}
                  onFocus={() => onSelect(item.uid)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={describeItem(item, wall)}
                  className="cursor-move outline-none"
                  data-uid={item.uid}
                >
                  <WallShape catalogId={item.catalogId} w={item.w} h={item.h} color={spec.color} />
                  {isSelected && (
                    <rect x={-item.w / 2 - 0.06} y={-item.h / 2 - 0.06} width={item.w + 0.12} height={item.h + 0.12} fill="none" stroke="#242620" strokeWidth="0.04" strokeDasharray="0.12 0.08" />
                  )}
                </g>
                {flagged.has(item.uid) && (
                  <rect x={item.x - hw} y={sy(item.y + hh)} width={hw * 2} height={hh * 2} fill="none" stroke="#c0392b" strokeWidth="0.05" className="pointer-events-none" />
                )}
                {isSelected && spec.resize !== 'none' && (() => {
                  const [hx, hy] = rotate([item.w / 2, -item.h / 2], item.rotation)
                  return (
                    <rect
                      x={item.x + hx - HANDLE / 2} y={sy(item.y + hy) - HANDLE / 2} width={HANDLE} height={HANDLE}
                      fill="#fff" stroke="#242620" strokeWidth="0.04" className="cursor-nwse-resize"
                      onPointerDown={begin('resize', item)} aria-hidden="true" data-handle="resize"
                    />
                  )
                })()}
                {isSelected && spec.rotatable && (() => {
                  const [rx, ry] = rotate([0, item.h / 2 + 0.45], item.rotation)
                  return (
                    <g aria-hidden="true">
                      <line x1={item.x} y1={sy(item.y)} x2={item.x + rx} y2={sy(item.y + ry)} stroke="#242620" strokeWidth="0.025" className="pointer-events-none" />
                      <circle cx={item.x + rx} cy={sy(item.y + ry)} r={HANDLE / 1.6} fill="#fff" stroke="#242620" strokeWidth="0.04" className="cursor-grab" onPointerDown={begin('rotate', item)} data-handle="rotate" />
                    </g>
                  )
                })()}
              </g>
            )
          })}

          {drag?.guides.map((g) => (g.axis === 'x'
            ? <line key={`x${g.at}`} x1={g.at} y1={-0.3} x2={g.at} y2={wall.height + 0.3} stroke="#5b6650" strokeWidth="0.03" strokeDasharray="0.1 0.08" className="pointer-events-none" />
            : <line key={`y${g.at}`} x1={-0.3} y1={sy(g.at)} x2={wall.span + 0.3} y2={sy(g.at)} stroke="#5b6650" strokeWidth="0.03" strokeDasharray="0.1 0.08" className="pointer-events-none" />))}

          {m && (
            <>
              <Measure x1={selectedItem.x} y1={wall.height} x2={selectedItem.x} y2={sy(m.fromFloor)} label={formatFeet(m.fromFloor)} vertical />
              <Measure x1={0} y1={sy(selectedItem.y)} x2={m.fromLeft} y2={sy(selectedItem.y)} label={formatFeet(m.fromLeft)} />
              <Measure x1={wall.span - m.fromRight} y1={sy(selectedItem.y)} x2={wall.span} y2={sy(selectedItem.y)} label={formatFeet(m.fromRight)} />
            </>
          )}
        </svg>
        {placed.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-muted">Add a painting, mirror, shelf, lamp, door or window from the panel.</p>
        )}
      </div>

      <div aria-live="polite" className="border-t border-line bg-cream px-3 py-2 text-xs">
        {warnings.length > 0 ? (
          <ul className="space-y-0.5">
            {warnings.map((w) => (
              <li key={`${w.kind}-${w.ids.join('-')}`} className={`flex items-center gap-1.5 ${w.kind === 'overlap' ? 'text-red-700' : 'text-clay'}`}>
                <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> {w.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Drag to move, corner handle to resize, round handle to rotate. Snaps to a 3-inch grid and nearby edges; hold Alt (Option) to place freely. Arrow keys nudge the selected item.</p>
        )}
      </div>
    </div>
  )
}
