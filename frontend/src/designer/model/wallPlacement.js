/**
 * Pure placement maths for items on a wall. Wall coordinates are in feet, seen from inside the room
 * facing the wall: x from the wall's left corner, y up from the floor. An item's (x, y) is its centre.
 */
import { wallItemSpec } from './catalog'

export const GRID = 0.25 // 3 inches
export const SNAP_DISTANCE = 0.2
export const MIN_GAP = 0.25 // closer than 3 inches reads as cramped
export const ROTATION_STEP = 15

const round = (v, step) => Math.round(v / step) * step
const clean = (v) => Math.round(v * 1000) / 1000

/** Half extents of the item's axis-aligned box, accounting for in-plane rotation. */
export function halfExtents({ w, h, rotation = 0 }) {
  const r = (rotation * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  return { hw: (w * c + h * s) / 2, hh: (w * s + h * c) / 2 }
}

export function bounds(item) {
  const { hw, hh } = halfExtents(item)
  return { left: item.x - hw, right: item.x + hw, bottom: item.y - hh, top: item.y + hh }
}

/** Distances from the item to the wall edges. */
export function measurements(item, wall) {
  const b = bounds(item)
  return {
    fromLeft: clean(b.left),
    fromRight: clean(wall.span - b.right),
    fromFloor: clean(b.bottom),
    fromCeiling: clean(wall.height - b.top),
    width: clean(b.right - b.left),
    height: clean(b.top - b.bottom),
  }
}

/** Clamp size to the catalog limits and the wall, then keep the whole item on the wall. */
export function clampToWall(item, wall) {
  const spec = wallItemSpec(item.catalogId)
  let { w, h } = item
  if (spec) {
    w = Math.min(spec.max.w, Math.max(spec.min.w, w))
    h = Math.min(spec.max.h, Math.max(spec.min.h, h))
  }
  // Never larger than the wall itself.
  const fit = Math.min(1, wall.span / w, wall.height / h)
  if (fit < 1 && spec?.lockAspect) {
    w *= fit
    h *= fit
  } else {
    w = Math.min(w, wall.span)
    h = Math.min(h, wall.height)
  }
  let rotation = ((Math.round(item.rotation || 0) % 360) + 360) % 360
  if (spec && !spec.rotatable) rotation = 0
  const sized = { ...item, w: clean(w), h: clean(h), rotation }
  let { hw, hh } = halfExtents(sized)
  if (hw * 2 > wall.span || hh * 2 > wall.height) {
    // A rotated item that no longer fits goes back upright.
    sized.rotation = 0
    ;({ hw, hh } = halfExtents(sized))
  }
  const x = Math.min(wall.span - hw, Math.max(hw, item.x))
  let y = Math.min(wall.height - hh, Math.max(hh, item.y))
  if (spec?.floorLocked) y = hh
  // Round towards the middle of the wall, so rounding can never push an item past an edge.
  const roundIn = (v, mid) => mid + Math.sign(v - mid) * Math.floor(Math.abs(v - mid) * 1000 + 1e-6) / 1000
  return { ...sized, x: roundIn(x, wall.span / 2), y: spec?.floorLocked ? y : roundIn(y, wall.height / 2) }
}

/**
 * Snap a dragged position to nearby edges and centres of other items and the wall, otherwise to the
 * grid. Returns the snapped centre and the guide lines to draw.
 */
export function snapPosition(item, others, wall, { grid = GRID, threshold = SNAP_DISTANCE } = {}) {
  const { hw, hh } = halfExtents(item)
  const xTargets = [0, wall.span / 2, wall.span]
  const yTargets = [0, wall.height / 2, wall.height]
  for (const o of others) {
    const b = bounds(o)
    xTargets.push(b.left, o.x, b.right)
    yTargets.push(b.bottom, o.y, b.top)
  }
  const axis = (centre, half, targets) => {
    let best = null
    for (const offset of [-half, 0, half]) {
      for (const t of targets) {
        const delta = t - (centre + offset)
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: t }
      }
    }
    return best ? { value: centre + best.delta, guide: best.at } : { value: round(centre, grid), guide: null }
  }
  const sx = axis(item.x, hw, xTargets)
  const sy = axis(item.y, hh, yTargets)
  const guides = []
  if (sx.guide !== null) guides.push({ axis: 'x', at: clean(sx.guide) })
  if (sy.guide !== null) guides.push({ axis: 'y', at: clean(sy.guide) })
  return { x: clean(sx.value), y: clean(sy.value), guides }
}

const gap = (a, b) => {
  const A = bounds(a)
  const B = bounds(b)
  const dx = Math.max(B.left - A.right, A.left - B.right)
  const dy = Math.max(B.bottom - A.top, A.bottom - B.top)
  return { dx, dy, overlap: dx < -1e-6 && dy < -1e-6 }
}

/** Overlaps and cramped spacing between items on one wall. */
export function wallWarnings(items) {
  const warnings = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      const { dx, dy, overlap } = gap(a, b)
      const names = [wallItemSpec(a.catalogId)?.name, wallItemSpec(b.catalogId)?.name]
      const ids = [a.uid, b.uid]
      if (overlap) warnings.push({ kind: 'overlap', ids, message: `${names[0]} overlaps ${names[1].toLowerCase()}.` })
      else if (Math.max(dx, dy) < MIN_GAP) warnings.push({ kind: 'tight', ids, message: `${names[0]} and ${names[1].toLowerCase()} are less than 3 inches apart.` })
    }
  }
  return warnings
}

/**
 * A spot for a new item at its default height, as central as possible: first with a 3-inch gap to
 * everything else, then merely not overlapping, otherwise the centre (the overlap warning will show).
 */
export function findFreeSpot(item, others, wall) {
  const base = clampToWall({ ...item, x: wall.span / 2 }, wall)
  const { hw } = halfExtents(base)
  const candidates = [base.x]
  for (let d = 0.25; d <= wall.span; d += 0.25) candidates.push(base.x - d, base.x + d)
  const fits = candidates
    .filter((x) => x - hw >= -1e-6 && x + hw <= wall.span + 1e-6)
    .map((x) => clampToWall({ ...base, x }, wall))
  const spaced = fits.find((p) => others.every((o) => { const g = gap(p, o); return Math.max(g.dx, g.dy) >= MIN_GAP - 1e-6 }))
  return spaced || fits.find((p) => !others.some((o) => gap(p, o).overlap)) || base
}

/** Convert a pointer position to wall feet, for an SVG with this viewBox scaled with "meet". */
export function clientToWall(rect, [vx, vy, vw, vh], clientX, clientY, wallHeight) {
  const scale = Math.min(rect.width / vw, rect.height / vh)
  const ox = rect.left + (rect.width - vw * scale) / 2
  const oy = rect.top + (rect.height - vh * scale) / 2
  const svgX = vx + (clientX - ox) / scale
  const svgY = vy + (clientY - oy) / scale
  return { x: svgX, y: wallHeight - svgY }
}

/** Feet as 4′ 6″. */
export function formatFeet(v) {
  const inches = Math.round(Math.max(0, v) * 12)
  const ft = Math.floor(inches / 12)
  const inch = inches % 12
  return inch ? `${ft}′ ${inch}″` : `${ft}′`
}

export const snapRotation = (deg) => ((round(deg, ROTATION_STEP) % 360) + 360) % 360

/** What a screen reader hears for an item on the wall. */
export function describeItem(item, wall) {
  const m = measurements(item, wall)
  return `${wallItemSpec(item.catalogId)?.name || 'Item'}, ${formatFeet(m.width)} wide, ${formatFeet(m.fromFloor)} from the floor, ${formatFeet(m.fromLeft)} from the left corner`
}
