/**
 * Layout optimiser: moves and turns furniture to raise the layout score (layoutScore.js).
 *
 * It is a local search ("hill climbing"). For each piece, biggest first, it tries a set of candidate
 * moves, keeps the one that raises the score most, and repeats over all pieces until a full pass finds
 * nothing better (or the time budget runs out). Candidate moves are:
 *   - small nudges (½, 1 and 2 ft each way) and quarter turns;
 *   - every slot along every wall, flush and facing into the room (for wall-backed and tall pieces);
 *   - "where it belongs" spots: the coffee table in front of a sofa, armchairs at the coffee table's ends,
 *     bedside tables at the bed's head, chairs around their table, a bench at the bed's foot, lamps and
 *     plants beside the sofa or in the corners;
 *   - swapping two pieces of a similar size.
 * A move is only considered if the room still obeys every hard rule (inside the room, no overlaps, door
 * swings clear, nothing under wall cabinets), so the optimiser can never make a layout invalid. Lamps,
 * vases and small plants standing on a table travel with it. Locked and hidden pieces never move.
 * It is deterministic: the same design always gives the same result.
 */
import { floorItemSpec } from './catalog'
import { roomSize } from './design'
import { clampToRoom, floorHalfExtents, floorWarnings, footprint, settleItems } from './floorPlacement'
import { polishFloorEntries } from './layoutPolish'
import { scoreLayout } from './layoutScore'

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const spec = (i) => floorItemSpec(i.catalogId)
const isRug = (i) => spec(i)?.layer === 'rug'
const norm = (deg) => ((Math.round(deg) % 360) + 360) % 360
const turn90 = (deg) => norm(Math.round(deg / 90) * 90)
const front = (i) => {
  const r = (i.rotation * Math.PI) / 180
  return [Math.sin(r), Math.cos(r)]
}
const right = (i) => {
  const [fx, fz] = front(i)
  return [-fz, fx] // the piece's own right, seen from behind it
}
const faceTowards = (from, to) => turn90((Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI)
const MIN_GAIN = 0.05 // points out of 100

const SEAT_TARGETS = {
  armchair: ['coffee-table'], recliner: ['coffee-table', 'tv-unit'], 'bean-bag': ['coffee-table', 'tv-unit'],
  'dining-chair': ['dining-table', 'round-dining-table'], 'desk-chair': ['study-desk', 'dressing-table'], 'bar-stool': ['kitchen-island'],
}
const BEDS = ['bed', 'single-bed', 'bunk-bed', 'crib']
const CORNER_PIECES = ['plant', 'floor-lamp', 'aquarium', 'pooja-unit']
const TALL_TO_WALL = (i) => footprint(i).h > 4 && !['plant', 'floor-lamp', 'jhoola', 'room-divider'].includes(i.catalogId)

/** Small pieces standing on this one (they move with it). */
function ridersOf(host, items) {
  const { hx, hz } = floorHalfExtents(host)
  return items.filter((i) => i !== host && !i.wall && spec(i)?.onSurface && (i.elevation || 0) > 0
    && Math.abs(i.x - host.x) <= hx && Math.abs(i.z - host.z) <= hz)
}

/** The design with pieces moved (riders carried along), or null when that would break a hard rule. */
function applyMoves(design, size, moves) {
  const byUid = new Map(design.items.map((i) => [i.uid, i]))
  const changed = new Map()
  for (const { uid, patch } of moves) {
    const host = byUid.get(uid)
    const next = clampToRoom({ ...host, ...patch, rotation: norm(patch.rotation ?? host.rotation) }, size)
    changed.set(uid, next)
    const turn = ((next.rotation - host.rotation) * Math.PI) / 180
    for (const r of ridersOf(host, design.items)) {
      const ox = r.x - host.x
      const oz = r.z - host.z
      // Rotate the rider's offset with its host (rotation is clockwise seen from above: x→-z… in this frame).
      const rx = ox * Math.cos(turn) + oz * Math.sin(turn)
      const rz = -ox * Math.sin(turn) + oz * Math.cos(turn)
      changed.set(r.uid, { ...r, x: next.x + rx, z: next.z + rz, rotation: norm(r.rotation + (next.rotation - host.rotation)) })
    }
  }
  const items = settleItems(design.items.map((i) => changed.get(i.uid) || i))
  const trial = { ...design, items }
  for (const uid of changed.keys()) {
    const item = items.find((i) => i.uid === uid)
    if (spec(item).onSurface && !(item.elevation > 0)) return null // a rider fell off its table
    if (floorWarnings(trial, uid).length) return null
  }
  return trial
}

/** Flush against `wall` at `along` ft from the wall's left end (seen from inside), back to the wall. */
function wallSlot(item, size, wall, along) {
  const { d } = footprint(item)
  const W = size.width / 2
  const L = size.length / 2
  if (wall === 'back') return { x: -W + along, z: -L + d / 2, rotation: 0 }
  if (wall === 'front') return { x: W - along, z: L - d / 2, rotation: 180 }
  if (wall === 'left') return { x: -W + d / 2, z: L - along, rotation: 90 }
  return { x: W - d / 2, z: along - L, rotation: 270 }
}

function candidates(item, items, size) {
  const out = []
  const s = spec(item)
  const { w, d } = footprint(item)
  const round = s.shape === 'round'
  // Nudges.
  for (const step of [0.5, 1, 2]) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) out.push({ x: item.x + dx * step, z: item.z + dz * step })
  // Quarter turns for free-standing pieces.
  if (!round && !s.againstWall) for (const t of [90, 180, 270]) out.push({ rotation: item.rotation + t })
  // Every slot along every wall.
  if (s.againstWall || TALL_TO_WALL(item)) {
    for (const wall of ['back', 'right', 'front', 'left']) {
      const span = wall === 'back' || wall === 'front' ? size.width : size.length
      const free = span - w
      if (free < 0) continue
      const steps = Math.max(1, Math.min(12, Math.floor(free)))
      for (let k = 0; k <= steps; k++) out.push(wallSlot(item, size, wall, w / 2 + (free * k) / steps))
    }
  }
  const of = (ids) => items.filter((o) => o !== item && ids.includes(o.catalogId) && !o.hidden)
  // Loose seats may turn at an angle to face what they belong to (15° steps), not just quarter turns.
  if (SEAT_TARGETS[item.catalogId] && !round) {
    for (const t of of(SEAT_TARGETS[item.catalogId])) {
      out.push({ rotation: Math.round(((Math.atan2(t.x - item.x, t.z - item.z) * 180) / Math.PI) / 15) * 15 })
    }
  }
  // Where it belongs.
  if (item.catalogId === 'coffee-table') {
    for (const sofa of of(['sofa', 'l-sofa'])) {
      const [fx, fz] = front(sofa)
      const reach = footprint(sofa).d / 2 + 1.5 + d / 2
      out.push({ x: sofa.x + fx * reach, z: sofa.z + fz * reach, rotation: sofa.rotation })
    }
  }
  if (SEAT_TARGETS[item.catalogId]) {
    for (const t of of(SEAT_TARGETS[item.catalogId])) {
      const tf = footprint(t)
      const [rx, rz] = right(t)
      const [fx, fz] = front(t)
      if (t.catalogId === 'round-dining-table') {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2
          const r = tf.w / 2 + d / 2 - 0.2
          const p = { x: t.x + Math.sin(a) * r, z: t.z + Math.cos(a) * r }
          out.push({ ...p, rotation: faceTowards(p, t) })
        }
        continue
      }
      const spots = []
      if (item.catalogId === 'dining-chair') {
        // Along both long sides, spread over the table's width.
        for (const side of [-1, 1]) for (const along of [-0.3, 0, 0.3]) spots.push([along * tf.w, side * (tf.d / 2 + d / 2 - 0.2)])
      } else if (['desk-chair', 'bar-stool'].includes(item.catalogId)) {
        for (const along of [-0.25, 0, 0.25]) spots.push([along * tf.w, tf.d / 2 + d / 2 - 0.3])
      } else {
        // Lounge chairs at the coffee table's ends.
        for (const side of [-1, 1]) spots.push([side * (tf.w / 2 + 1.2 + d / 2), 0])
      }
      for (const [a, b] of spots) {
        const p = { x: t.x + rx * a + fx * b, z: t.z + rz * a + fz * b }
        out.push({ ...p, rotation: faceTowards(p, t) })
      }
    }
  }
  if (item.catalogId === 'bedside-table') {
    for (const bed of of(BEDS.slice(0, 3))) {
      const bf = footprint(bed)
      const [rx, rz] = right(bed)
      const [fx, fz] = front(bed)
      for (const side of [-1, 1]) {
        const a = side * (bf.w / 2 + w / 2 + 0.05)
        const b = -bf.d / 2 + d / 2 + 0.1
        out.push({ x: bed.x + rx * a + fx * b, z: bed.z + rz * a + fz * b, rotation: bed.rotation })
      }
    }
  }
  if (item.catalogId === 'bench') {
    for (const bed of of(BEDS.slice(0, 2))) {
      const [fx, fz] = front(bed)
      const reach = footprint(bed).d / 2 + d / 2 + 0.3
      out.push({ x: bed.x + fx * reach, z: bed.z + fz * reach, rotation: bed.rotation })
    }
  }
  if (['floor-lamp', 'plant', 'side-table'].includes(item.catalogId)) {
    for (const sofa of of(['sofa', 'l-sofa', 'armchair', 'recliner'])) {
      const [rx, rz] = right(sofa)
      for (const side of [-1, 1]) {
        const a = side * (footprint(sofa).w / 2 + w / 2 + 0.15)
        out.push({ x: sofa.x + rx * a, z: sofa.z + rz * a })
      }
    }
  }
  if (CORNER_PIECES.includes(item.catalogId)) {
    const ex = size.width / 2 - Math.max(w, d) / 2 - 0.05
    const ez = size.length / 2 - Math.max(w, d) / 2 - 0.05
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push({ x: sx * ex, z: sz * ez })
  }
  return out
}

/**
 * Improves a design's layout. Options: `roomType`, `vastu` (score and move for Vastu too), `budgetMs`
 * (stop after this long; default 1200), `maxRounds` (default 6).
 * Returns `{ design, before, after, moves }`; before/after are scoreLayout results.
 */
export function improveLayout(design, { roomType = '', vastu = false, budgetMs = 1200, maxRounds = 6 } = {}) {
  const opts = { roomType, vastu }
  const size = roomSize(design)
  const started = now()
  const before = scoreLayout(design, opts)
  let current = design
  let best = before.total
  let moves = 0
  const outOfTime = () => now() - started > budgetMs
  const score = (d) => scoreLayout(d, opts).total

  const movable = () => current.items
    .filter((i) => !i.wall && !i.hidden && !i.locked && spec(i) && !isRug(i) && !spec(i).onSurface)
    .sort((a, b) => footprint(b).w * footprint(b).d - footprint(a).w * footprint(a).d)

  for (let round = 0; round < maxRounds && !outOfTime(); round++) {
    let improved = false
    for (const { uid } of movable()) {
      if (outOfTime()) break
      const item = current.items.find((i) => i.uid === uid)
      let bestTrial = null
      let bestScore = best + MIN_GAIN
      const consider = (trial) => {
        if (!trial) return
        const s = score(trial)
        if (s > bestScore) { bestScore = s; bestTrial = trial }
      }
      for (const patch of candidates(item, current.items, size)) consider(applyMoves(current, size, [{ uid, patch }]))
      // Swap places with a piece of a similar size (each takes the other's spot and wall).
      const area = footprint(item).w * footprint(item).d
      for (const other of movable()) {
        if (other.uid === uid || other.catalogId === item.catalogId) continue
        const ratio = (footprint(other).w * footprint(other).d) / area
        if (ratio < 0.6 || ratio > 1.6 || Boolean(spec(other).againstWall) !== Boolean(spec(item).againstWall)) continue
        consider(applyMoves(current, size, [
          { uid, patch: { x: other.x, z: other.z, rotation: other.rotation } },
          { uid: other.uid, patch: { x: item.x, z: item.z, rotation: item.rotation } },
        ]))
      }
      if (bestTrial) {
        current = bestTrial
        best = bestScore
        moves += 1
        improved = true
      }
    }
    if (!improved) break
  }

  // Finally re-fit rugs under the group they belong to (the tidy-up rules know how), if that is allowed.
  const rugs = current.items.filter((i) => !i.wall && !i.hidden && !i.locked && isRug(i))
  if (rugs.length) {
    const entries = current.items.filter((i) => !i.wall && !i.hidden).map((i) => ({ id: i.catalogId, uid: i.uid, x: i.x, z: i.z, rotation: i.rotation, scale: i.scale }))
    const { entries: polished } = polishFloorEntries(entries, size)
    const rugMoves = polished.filter((e) => rugs.some((r) => r.uid === e.uid)).map((e) => ({ uid: e.uid, patch: { x: e.x, z: e.z, rotation: e.rotation, scale: e.scale } }))
    const trial = rugMoves.length ? applyMoves(current, size, rugMoves) : null
    if (trial && score(trial) >= best) { current = trial; best = score(trial) }
  }
  return { design: current, before, after: scoreLayout(current, opts), moves }
}
