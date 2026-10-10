/**
 * Pure placement maths for furniture on the floor. Room coordinates are in feet with the floor centre
 * at the origin: x across the width, z along the length (back wall at -length/2). A floor item's
 * (x, z) is the centre of its footprint and `rotation` is degrees about the vertical axis.
 */
import { floorItemSpec, wallItemSpec } from './catalog'
import { onWall, roomSize, wallDims, wallSpecs } from './design'
import { bounds as wallBounds } from './wallPlacement'

export const FLOOR_GRID = 0.25
export const WALL_SNAP = 0.5 // closer than 6 inches to a wall snaps flush against it
export const EDGE_SNAP = 0.2
export const ROTATE_STEP = 15
const EPS = 1e-3

const rad = (deg) => (deg * Math.PI) / 180
const clean = (v) => Math.round(v * 1000) / 1000
// Round towards the room centre, so rounding can never push an item into a wall.
const roundIn = (v) => Math.sign(v) * Math.floor(Math.abs(v) * 1000 + 1e-6) / 1000
const normalise = (deg) => ((Math.round(deg) % 360) + 360) % 360

/**
 * Footprint and height of a placed floor item, after scaling. A picked product with an unambiguous
 * listed size overrides the generic shape's typical size (`item.size`).
 */
export function footprint(item) {
  const size = item.size || floorItemSpec(item.catalogId).size
  const s = item.scale || 1
  return { w: size.w * s, d: size.d * s, h: size.h * s }
}

const CM_PER_FT = 30.48

/**
 * A retailer's listed size as width × depth × height in feet, only when it is written that way
 * ("78x50x190 cm"). Two-number sizes ("90x55 cm") are ambiguous (depth or height?), so they are
 * never used to size the 3D shape.
 */
export function parseListedSize(listed) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*cm\s*$/i.exec(listed || '')
  if (!m) return null
  const [w, d, h] = m.slice(1).map((v) => Math.round((Number(v) / CM_PER_FT) * 100) / 100)
  return w > 0 && d > 0 && h > 0 ? { w, d, h } : null
}

/** Vertical extent [bottom, top] of a floor item, counting what it stands on. */
export const heightRange = (item) => {
  const bottom = item.elevation || 0
  return [bottom, bottom + footprint(item).h]
}

/** Half extents of the footprint's axis-aligned box. */
export function floorHalfExtents(item) {
  const { w, d } = footprint(item)
  const c = Math.abs(Math.cos(rad(item.rotation)))
  const s = Math.abs(Math.sin(rad(item.rotation)))
  return { hx: (w * c + d * s) / 2, hz: (w * s + d * c) / 2 }
}

/** The footprint's four corners as [x, z], matching three.js rotation about y. */
export function corners(cx, cz, w, d, rotation) {
  const c = Math.cos(rad(rotation))
  const s = Math.sin(rad(rotation))
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
    .map(([lx, lz]) => [cx + lx * c + lz * s, cz - lx * s + lz * c])
}

export const itemCorners = (item) => {
  const { w, d } = footprint(item)
  return corners(item.x, item.z, w, d, item.rotation)
}

const ROUND_SIDES = 16

// Items are never changed in place (every edit makes a new object), so a shape is worked out once per item.
const polygonCache = new WeakMap()

/** A point given in an item's own frame (x right, z towards its front) turned into room space. */
function toRoom(item, [lx, lz]) {
  const c = Math.cos(rad(item.rotation))
  const s = Math.sin(rad(item.rotation))
  return [item.x + lx * c + lz * s, item.z - lx * s + lz * c]
}

export const isRound = (catalogId) => floorItemSpec(catalogId)?.shape === 'round'

/** The rectangles an item's footprint is made of, in its own frame: one for most pieces, two for an L. */
export function localParts(catalogId, w, d) {
  const shape = floorItemSpec(catalogId)?.shape
  if (shape?.parts) {
    return shape.parts.map((p) => ({ cx: ((p.x0 + p.x1) / 2) * w, cz: ((p.z0 + p.z1) / 2) * d, w: (p.x1 - p.x0) * w, d: (p.z1 - p.z0) * d }))
  }
  return [{ cx: 0, cz: 0, w, d }]
}

/**
 * The convex pieces of an item's real floor shape, as lists of [x, z] corners in room space: a rectangle for
 * most things, an inscribed polygon for round ones, two rectangles for the L-shaped sofa. This is what
 * collisions use, so an L doesn't claim its empty corner and a round table doesn't claim its square corners.
 */
export function footprintPolygons(item) {
  const cached = polygonCache.get(item)
  if (cached) return cached
  const { w, d } = footprint(item)
  const shape = floorItemSpec(item.catalogId)?.shape
  let polygons
  if (shape === 'round') {
    polygons = [Array.from({ length: ROUND_SIDES }, (_, i) => {
      const a = (i / ROUND_SIDES) * Math.PI * 2
      return toRoom(item, [(Math.cos(a) * w) / 2, (Math.sin(a) * d) / 2])
    })]
  } else if (shape?.parts) {
    polygons = localParts(item.catalogId, w, d).map((p) =>
      [[-p.w / 2, -p.d / 2], [p.w / 2, -p.d / 2], [p.w / 2, p.d / 2], [-p.w / 2, p.d / 2]].map(([x, z]) => toRoom(item, [p.cx + x, p.cz + z])))
  } else {
    polygons = [itemCorners(item)]
  }
  polygonCache.set(item, polygons)
  return polygons
}

/** The outline to draw for an item (one loop, concave for an L), as [x, z] corners in room space. */
export function footprintOutline(item) {
  const { w, d } = footprint(item)
  const outline = floorItemSpec(item.catalogId)?.shape?.outline
  return outline ? outline.map(([x, z]) => toRoom(item, [x * w, z * d])) : footprintPolygons(item)[0]
}

/** Separating-axis test for two convex polygons; touching edges don't count as overlapping. */
export function polygonsOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i]
      const [x2, z2] = poly[(i + 1) % poly.length]
      const axis = [z2 - z1, x1 - x2]
      const project = (p) => p.map(([x, z]) => x * axis[0] + z * axis[1])
      const pa = project(a)
      const pb = project(b)
      const len = Math.hypot(...axis)
      if (Math.min(...pa) >= Math.max(...pb) - EPS * len || Math.min(...pb) >= Math.max(...pa) - EPS * len) return false
    }
  }
  return true
}

/** True when two pieces' real shapes touch (not just their bounding rectangles). */
export function itemsOverlap(a, b) {
  const fa = footprint(a)
  const fb = footprint(b)
  // Pieces further apart than their circumscribed circles can't touch: skip the exact test.
  if (Math.hypot(a.x - b.x, a.z - b.z) > (Math.hypot(fa.w, fa.d) + Math.hypot(fb.w, fb.d)) / 2 + EPS) return false
  return footprintPolygons(a).some((pa) => footprintPolygons(b).some((pb) => polygonsOverlap(pa, pb)))
}

/** True when a piece's real shape touches a polygon, such as a door swing or a wall item's footprint. */
export const overlapsPolygon = (item, polygon) => footprintPolygons(item).some((p) => polygonsOverlap(p, polygon))

/** True when a point [x, z] lies on a piece's real shape. */
export const itemContains = (item, point) => footprintPolygons(item).some((p) => pointInPolygon(point, p))

/** Clamp rotation and scale, then keep the whole footprint inside the room. */
export function clampToRoom(item, size) {
  const spec = floorItemSpec(item.catalogId)
  const scale = spec.scale ? Math.min(spec.scale[1], Math.max(spec.scale[0], item.scale || 1)) : 1
  const next = { ...item, rotation: normalise(item.rotation || 0), scale: clean(scale) }
  const { hx, hz } = floorHalfExtents(next)
  const fit = (v, half, span) => (half * 2 >= span ? 0 : Math.min(span / 2 - half, Math.max(-span / 2 + half, v)))
  return { ...next, x: roundIn(fit(item.x, hx, size.width)), z: roundIn(fit(item.z, hz, size.length)) }
}

/**
 * Snap to walls (flush), then other items' edges and centres, otherwise the 3-inch grid. Returns the
 * snapped centre and alignment guides ({ axis: 'x' | 'z', at }) for the lines that were matched.
 */
export function snapFloor(item, others, size, { grid = FLOOR_GRID } = {}) {
  const { hx, hz } = floorHalfExtents(item)
  const guides = []
  const axis = (name, centre, half, span, targets) => {
    if (Math.abs(centre - half + span / 2) < WALL_SNAP) {
      guides.push({ axis: name, at: clean(-span / 2) })
      return -span / 2 + half
    }
    if (Math.abs(centre + half - span / 2) < WALL_SNAP) {
      guides.push({ axis: name, at: clean(span / 2) })
      return span / 2 - half
    }
    let best = null
    for (const offset of [-half, 0, half]) {
      for (const t of targets) {
        const delta = t - (centre + offset)
        if (Math.abs(delta) <= EDGE_SNAP && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: t }
      }
    }
    if (best) {
      guides.push({ axis: name, at: clean(best.at) })
      return centre + best.delta
    }
    return Math.round(centre / grid) * grid
  }
  const xs = [0]
  const zs = [0]
  for (const o of others) {
    const e = floorHalfExtents(o)
    xs.push(o.x - e.hx, o.x, o.x + e.hx)
    zs.push(o.z - e.hz, o.z, o.z + e.hz)
  }
  return { x: clean(axis('x', item.x, hx, size.width, xs)), z: clean(axis('z', item.z, hz, size.length, zs)), guides }
}

/** Turn an item to face into the room from its nearest wall and push it flush against that wall. */
export function alignToWall(item, size) {
  const { d } = footprint(item)
  const gaps = {
    back: item.z + size.length / 2,
    front: size.length / 2 - item.z,
    left: item.x + size.width / 2,
    right: size.width / 2 - item.x,
  }
  const wall = Object.keys(gaps).reduce((a, b) => (gaps[b] < gaps[a] ? b : a))
  const placed = {
    back: { rotation: 0, z: -size.length / 2 + d / 2 },
    front: { rotation: 180, z: size.length / 2 - d / 2 },
    left: { rotation: 90, x: -size.width / 2 + d / 2 },
    right: { rotation: 270, x: size.width / 2 - d / 2 },
  }[wall]
  return clampToRoom({ ...item, ...placed }, size)
}

function pointInPolygon([px, pz], poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** How high an item stands: on top of the highest table-like surface under its centre, else 0. */
export function surfaceElevation(item, others) {
  if (!floorItemSpec(item.catalogId)?.onSurface) return 0
  let top = 0
  for (const o of others) {
    if (o.uid === item.uid || o.wall || o.hidden || !floorItemSpec(o.catalogId)?.surface) continue
    if (itemContains(o, [item.x, item.z])) top = Math.max(top, heightRange(o)[1])
  }
  return Math.round(top * 1000) / 1000
}

/** Recomputes what every small item stands on (after any furniture change). Keeps unchanged items. */
export function settleItems(items) {
  const floor = items.filter((i) => !i.wall)
  let changed = false
  const next = items.map((i) => {
    if (i.wall || !floorItemSpec(i.catalogId)?.onSurface) return i
    const elevation = surfaceElevation(i, floor)
    if ((i.elevation || 0) === elevation) return i
    changed = true
    return { ...i, elevation }
  })
  return changed ? next : items
}

/** Wall-local (along, out) to room [x, z] for one wall. */
export function wallToRoom(spec, along, out) {
  const t = spec.rotationY
  const xAxis = [Math.cos(t), -Math.sin(t)]
  const [nx, , nz] = spec.normal
  const left = [spec.center[0] - (xAxis[0] * spec.span) / 2, spec.center[2] - (xAxis[1] * spec.span) / 2]
  return [left[0] + xAxis[0] * along + nx * out, left[1] + xAxis[1] * along + nz * out]
}

/** The floor area a door needs to swing open: as deep as the door is wide. */
export function doorSwing(door, spec) {
  const l = door.x - door.w / 2
  const r = door.x + door.w / 2
  return [wallToRoom(spec, l, 0), wallToRoom(spec, r, 0), wallToRoom(spec, r, door.w), wallToRoom(spec, l, door.w)]
}

/** Room-space box of a wall item: its footprint polygon on the floor plus its height range. */
function wallItemVolume(item, spec) {
  const b = wallBounds(item)
  const d = wallItemSpec(item.catalogId).size.d
  return {
    poly: [wallToRoom(spec, b.left, 0), wallToRoom(spec, b.right, 0), wallToRoom(spec, b.right, d), wallToRoom(spec, b.left, d)],
    bottom: b.bottom,
    top: b.top,
  }
}

const isRug = (item) => floorItemSpec(item.catalogId)?.layer === 'rug'
const nameOf = (item) => (floorItemSpec(item.catalogId) || wallItemSpec(item.catalogId))?.name || 'Item'

/**
 * Problems with the furniture: too big, overlapping, blocking a door, or hitting wall décor. Pass a
 * `uid` to get only the problems that involve that piece, which is much cheaper when checking one new piece.
 */
export function floorWarnings(design, only = null) {
  const size = roomSize(design)
  const floor = design.items.filter((i) => !i.wall && !i.hidden)
  const specs = wallSpecs(size)
  const warnings = []
  for (const item of floor) {
    if (only && item.uid !== only) continue
    const { hx, hz } = floorHalfExtents(item)
    if (hx * 2 > size.width + EPS || hz * 2 > size.length + EPS) {
      warnings.push({ kind: 'too-big', ids: [item.uid], message: `${nameOf(item)} is bigger than the room.` })
    }
  }
  for (let i = 0; i < floor.length; i++) {
    for (let j = i + 1; j < floor.length; j++) {
      const [a, b] = [floor[i], floor[j]]
      if (only && a.uid !== only && b.uid !== only) continue
      if (isRug(a) !== isRug(b)) continue // rugs sit under furniture
      const [ab, at] = heightRange(a)
      const [bb, bt] = heightRange(b)
      if (at <= bb + EPS || bt <= ab + EPS) continue // one stands on the other
      if (itemsOverlap(a, b)) {
        warnings.push({ kind: 'overlap', ids: [a.uid, b.uid], message: `${nameOf(a)} overlaps ${nameOf(b).toLowerCase()}.` })
      }
    }
  }
  for (const spec of specs) {
    for (const placed of onWall(design, spec.id)) {
      if (placed.catalogId === 'door') {
        const swing = doorSwing(placed, { ...spec, ...wallDims(size, spec.id) })
        for (const item of floor) {
          if (only && item.uid !== only) continue
          if (!isRug(item) && overlapsPolygon(item, swing)) {
            warnings.push({ kind: 'door', ids: [item.uid, placed.uid], message: `${nameOf(item)} blocks the door on the ${spec.id} wall.` })
          }
        }
      } else if (!wallItemSpec(placed.catalogId)?.opening) {
        const vol = wallItemVolume(placed, spec)
        for (const item of floor) {
          if (only && item.uid !== only) continue
          const [bottom, top] = heightRange(item)
          if (isRug(item) || top <= vol.bottom + EPS || bottom >= vol.top - EPS) continue
          if (overlapsPolygon(item, vol.poly)) {
            warnings.push({ kind: 'clash', ids: [item.uid, placed.uid], message: `${nameOf(item)} hits the ${nameOf(placed).toLowerCase()} on the ${spec.id} wall.` })
          }
        }
      }
    }
  }
  return warnings
}

/**
 * A starting spot for a new floor item: against the back wall for sofas, beds and storage, the room
 * centre otherwise; the nearest grid point that is free of other furniture and door swings.
 */
export function findFloorSpot(item, design) {
  const size = roomSize(design)
  const spec = floorItemSpec(item.catalogId)
  const base = clampToRoom(item, size)
  if (spec.onSurface) {
    // Lamps, small plants and vases go on a free table top when there is one.
    const floor = design.items.filter((o) => !o.wall && !o.hidden)
    const surface = floor.find((o) => floorItemSpec(o.catalogId)?.surface
      && !floor.some((s) => s.uid !== o.uid && floorItemSpec(s.catalogId)?.onSurface && itemContains(o, [s.x, s.z])))
    if (surface) return clampToRoom({ ...base, x: surface.x, z: surface.z }, size)
  }
  const { hz } = floorHalfExtents(base)
  const preferred = { x: 0, z: spec.againstWall ? -size.length / 2 + hz : 0 }
  const blockers = design.items.filter((o) => !o.wall && !o.hidden && isRug(o) === isRug(item)).flatMap(footprintPolygons)
  if (!isRug(item)) {
    for (const s of wallSpecs(size)) {
      for (const door of onWall(design, s.id).filter((o) => o.catalogId === 'door')) {
        blockers.push(doorSwing(door, { ...s, ...wallDims(size, s.id) }))
      }
    }
  }
  const step = 0.5
  const points = []
  for (let x = -size.width / 2; x <= size.width / 2; x += step) {
    for (let z = -size.length / 2; z <= size.length / 2; z += step) points.push([x, z])
  }
  points.sort((a, b) => Math.hypot(a[0] - preferred.x, a[1] - preferred.z) - Math.hypot(b[0] - preferred.x, b[1] - preferred.z))
  for (const [x, z] of [[preferred.x, preferred.z], ...points]) {
    const placed = clampToRoom({ ...base, x, z }, size)
    const polys = footprintPolygons(placed)
    if (!blockers.some((b) => polys.some((p) => polygonsOverlap(p, b)))) return placed
  }
  return clampToRoom({ ...base, ...preferred }, size)
}

export const snapRotationStep = (deg, step = ROTATE_STEP) => normalise(Math.round(deg / step) * step)

/**
 * The centre of a placed item in room space [x, y, z] and a radius that encloses it, for pointing
 * the camera at it.
 */
export function itemWorldCenter(design, item) {
  const size = roomSize(design)
  if (item.wall) {
    const spec = wallSpecs(size).find((s) => s.id === item.wall)
    const d = wallItemSpec(item.catalogId)?.size.d || 0.1
    const [x, z] = wallToRoom({ ...spec, ...wallDims(size, item.wall) }, item.x, d / 2)
    return { position: [x, item.y, z], radius: Math.max(item.w, item.h) / 2 + 0.5 }
  }
  const { w, d, h } = footprint(item)
  return { position: [item.x, (item.elevation || 0) + h / 2, item.z], radius: Math.hypot(w, d, h) / 2 + 0.5 }
}
