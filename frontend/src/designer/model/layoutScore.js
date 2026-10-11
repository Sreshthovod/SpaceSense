/**
 * Layout score: how well a furnished room is arranged, from 0 to 100, with the reasons.
 *
 * Hard rules (inside the room, no overlaps, doors clear, nothing under wall cabinets) are not scored:
 * the placement rules enforce them, so every layout scored here already obeys them. The score
 * measures the softer things that make a room feel designed, each as a term from 0 (bad) to 1 (good):
 *
 *   walls        wall-backed pieces (sofa, bed, wardrobe…) flush against a wall with their back to it
 *   facing       seats turned towards what they belong to (chairs to the table, sofa to the TV…)
 *   spacing      comfortable distances: coffee table ~1.5 ft from the sofa, TV 6–12 ft away, bedside
 *                tables beside the bed's head, chairs pulled up to their table
 *   circulation  a walkable path (about 1.5 ft or wider) from the door to every seat, bed and cupboard front
 *   open centre  tall pieces kept out of the middle of the room
 *   windows      tall pieces not standing in front of windows
 *   balance      the room's visual weight spread around its centre, not piled on one side
 *   gaps         no awkward slivers of dead space (a few inches to a foot) between big pieces or walls
 *   vastu        (Vastu mode only) how many pieces follow the Vastu guidelines for the room
 *
 * The total is the weighted average of the terms that apply. The optimiser (layoutOptimize.js) moves
 * pieces to raise it; the panel shows the breakdown so the number is never a black box.
 */
import { floorItemSpec } from './catalog'
import { roomSize, wallDims } from './design'
import { floorHalfExtents, footprint } from './floorPlacement'
import { angleBetween, vastuReport } from './compass'

export const WEIGHTS = { walls: 14, facing: 14, spacing: 14, circulation: 18, centre: 8, windows: 6, balance: 8, gaps: 8, vastu: 34 }
export const LABELS = {
  walls: 'Against the walls',
  facing: 'Seats face the right way',
  spacing: 'Comfortable distances',
  circulation: 'Room to walk',
  centre: 'Open middle',
  windows: 'Windows kept clear',
  balance: 'Balanced room',
  gaps: 'No awkward gaps',
  vastu: 'Vastu guidelines',
}

const SEATS = {
  sofa: ['tv-unit', 'coffee-table'],
  'l-sofa': ['tv-unit', 'coffee-table'],
  armchair: ['coffee-table', 'sofa', 'l-sofa', 'tv-unit'],
  recliner: ['tv-unit', 'coffee-table'],
  'bean-bag': ['tv-unit', 'coffee-table'],
  'tv-unit': ['sofa', 'l-sofa', 'recliner', 'armchair'],
  'dining-chair': ['dining-table', 'round-dining-table'],
  'desk-chair': ['study-desk', 'dressing-table'],
  'bar-stool': ['kitchen-island'],
}
const REACH = { 'dining-chair': 4.5, 'desk-chair': 4.5, 'bar-stool': 4.5 } // other seats: 13 ft
const BEDS = ['bed', 'single-bed', 'bunk-bed', 'crib']
const CENTRE_OK = ['coffee-table', 'dining-table', 'round-dining-table', 'kitchen-island', 'rug', 'pouf', 'bench', 'room-divider', 'jhoola']
const SMALL = (i) => {
  const { w, d } = footprint(i)
  return w * d < 2.5
}

const spec = (i) => floorItemSpec(i.catalogId)
const isRug = (i) => spec(i)?.layer === 'rug'
const front = (i) => {
  const r = (i.rotation * Math.PI) / 180
  return [Math.sin(r), Math.cos(r)]
}
// Angle between a piece's front and the direction to a point, 0–180.
const aimError = (i, x, z) => {
  const [fx, fz] = front(i)
  const a = (Math.atan2(fx, fz) * 180) / Math.PI
  const b = (Math.atan2(x - i.x, z - i.z) * 180) / Math.PI
  return angleBetween(a, b)
}
/** A falloff: 1 inside [lo, hi], down to 0 at `soft` beyond either end. */
const band = (v, lo, hi, soft) => (v >= lo && v <= hi ? 1 : Math.max(0, 1 - (v < lo ? lo - v : v - hi) / soft))
const box = (i) => {
  const { hx, hz } = floorHalfExtents(i)
  return { x0: i.x - hx, x1: i.x + hx, z0: i.z - hz, z1: i.z + hz }
}
/** Where `other` sits seen from `piece`: how far ahead of it (along its front) and how far to the side. */
function relative(piece, other) {
  const [fx, fz] = front(piece)
  const dx = other.x - piece.x
  const dz = other.z - piece.z
  return { ahead: dx * fx + dz * fz, aside: Math.abs(dx * fz - dz * fx) }
}
/** A piece's extent measured along another piece's front direction. */
function depthAlong(piece, ref) {
  const { hx, hz } = floorHalfExtents(piece)
  const [fx, fz] = front(ref)
  return 2 * (Math.abs(fx) * hx + Math.abs(fz) * hz)
}
/** Edge-to-edge gap between two pieces' boxes (0 when touching or overlapping). */
const boxGap = (a, b) => {
  const A = box(a)
  const B = box(b)
  const dx = Math.max(0, Math.max(A.x0, B.x0) - Math.min(A.x1, B.x1))
  const dz = Math.max(0, Math.max(A.z0, B.z0) - Math.min(A.z1, B.z1))
  return Math.hypot(dx, dz)
}
const WALL_ROTATION = { back: 0, front: 180, left: 90, right: 270 }
/** The nearest wall and how far the piece's edge is from it. */
function nearestWall(i, size) {
  const b = box(i)
  const gaps = { back: b.z0 + size.length / 2, front: size.length / 2 - b.z1, left: b.x0 + size.width / 2, right: size.width / 2 - b.x1 }
  const wall = Object.keys(gaps).reduce((a, c) => (gaps[c] < gaps[a] ? c : a))
  return { wall, gap: Math.max(0, gaps[wall]) }
}
const nearestOf = (i, list, ids, within) => {
  let best = null
  for (const id of ids) {
    for (const o of list) {
      if (o === i || o.catalogId !== id) continue
      const d = Math.hypot(o.x - i.x, o.z - i.z)
      if (d <= within && (!best || d < best.d)) best = { o, d }
    }
    if (best) return best.o // the first kind in the list wins (a TV beats a closer coffee table)
  }
  return null
}

// ---- circulation: a coarse walkability grid --------------------------------------------------------

const CELL = 0.5

function walkGrid(design, size, floor) {
  const nx = Math.max(1, Math.round(size.width / CELL))
  const nz = Math.max(1, Math.round(size.length / CELL))
  const blocked = new Uint8Array(nx * nz)
  const cx = (ix) => -size.width / 2 + (ix + 0.5) * CELL
  const cz = (iz) => -size.length / 2 + (iz + 0.5) * CELL
  for (const i of floor) {
    if (isRug(i) || (i.elevation || 0) > 0) continue
    const b = box(i)
    const round = spec(i)?.shape === 'round'
    const ix0 = Math.max(0, Math.floor((b.x0 + size.width / 2) / CELL))
    const ix1 = Math.min(nx - 1, Math.floor((b.x1 + size.width / 2 - 1e-6) / CELL))
    const iz0 = Math.max(0, Math.floor((b.z0 + size.length / 2) / CELL))
    const iz1 = Math.min(nz - 1, Math.floor((b.z1 + size.length / 2 - 1e-6) / CELL))
    const rx = (b.x1 - b.x0) / 2
    const rz = (b.z1 - b.z0) / 2
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        if (round && ((cx(ix) - i.x) / rx) ** 2 + ((cz(iz) - i.z) / rz) ** 2 > 1.15) continue
        blocked[iz * nx + ix] = 1
      }
    }
  }
  // Walkable: not blocked and not right next to something (or a wall), so a path is ~1.5 ft wide or more.
  const walk = new Uint8Array(nx * nz)
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      let ok = ix > 0 && iz > 0 && ix < nx - 1 && iz < nz - 1
      for (let dx = -1; ok && dx <= 1; dx++) for (let dz = -1; ok && dz <= 1; dz++) if (blocked[(iz + dz) * nx + ix + dx]) ok = false
      walk[iz * nx + ix] = ok ? 1 : 0
    }
  }
  const cellAt = (x, z) => {
    const ix = Math.floor((x + size.width / 2) / CELL)
    const iz = Math.floor((z + size.length / 2) / CELL)
    return ix >= 0 && iz >= 0 && ix < nx && iz < nz ? iz * nx + ix : -1
  }
  return { nx, nz, walk, cellAt }
}

/** Cells reachable from `start` over walkable cells (and the nearest walkable cell to it). */
function reachable(grid, startX, startZ) {
  const seen = new Uint8Array(grid.walk.length)
  let start = grid.cellAt(startX, startZ)
  if (start < 0 || !grid.walk[start]) {
    // The nearest walkable cell, a short way into the room.
    let best = -1
    let bestD = Infinity
    const sx = Math.floor((startX + (grid.nx * CELL) / 2) / CELL)
    const sz = Math.floor((startZ + (grid.nz * CELL) / 2) / CELL)
    for (let c = 0; c < grid.walk.length; c++) {
      if (!grid.walk[c]) continue
      const d = Math.hypot((c % grid.nx) - sx, Math.floor(c / grid.nx) - sz)
      if (d < bestD) { bestD = d; best = c }
    }
    if (best < 0 || bestD > 6) return seen // nothing walkable near the door
    start = best
  }
  const queue = [start]
  seen[start] = 1
  while (queue.length) {
    const c = queue.pop()
    const x = c % grid.nx
    const z = Math.floor(c / grid.nx)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx
      const zz = z + dz
      if (xx < 0 || zz < 0 || xx >= grid.nx || zz >= grid.nz) continue
      const n = zz * grid.nx + xx
      if (!seen[n] && grid.walk[n]) { seen[n] = 1; queue.push(n) }
    }
  }
  return seen
}

/** Where someone stands to use a piece: in front of it (or any side for chairs, either side for beds). */
function accessPoints(i) {
  const b = box(i)
  const [fx, fz] = front(i)
  const off = 1.0
  const depth = Math.abs(fx) > 0.5 ? (b.x1 - b.x0) / 2 : (b.z1 - b.z0) / 2 // half the piece, measured along its front
  const sides = {
    front: [i.x + fx * (depth + off), i.z + fz * (depth + off)],
    left: [b.x0 - off, i.z],
    right: [b.x1 + off, i.z],
    back: [i.x, b.z0 - off],
    ahead: [i.x, b.z1 + off],
  }
  if (['dining-chair', 'desk-chair', 'bar-stool', 'pouf', 'bench'].includes(i.catalogId)) return Object.values(sides)
  if (BEDS.includes(i.catalogId)) return [sides.front, sides.left, sides.right, sides.back, sides.ahead]
  return [sides.front]
}

function doorPoints(design, size) {
  const hw = size.width / 2
  const hl = size.length / 2
  return design.openings.filter((o) => o.catalogId === 'door').map((o) => {
    const inset = 1
    if (o.wall === 'back') return [o.x - hw, -hl + inset]
    if (o.wall === 'front') return [hw - o.x, hl - inset]
    if (o.wall === 'left') return [-hw + inset, hl - o.x]
    return [hw - inset, o.x - hl]
  })
}

// ---- the score ---------------------------------------------------------------------------------------

/**
 * Scores a design. `opts.roomType` picks the Vastu rules; `opts.vastu` adds the Vastu term.
 * Returns `{ total, terms: [{ id, label, score, weight, note, uids }] }`; total is 0–100.
 */
export function scoreLayout(design, { roomType = '', vastu = false } = {}) {
  const size = roomSize(design)
  const floor = design.items.filter((i) => !i.wall && !i.hidden && spec(i))
  const furniture = floor.filter((i) => !isRug(i) && !(i.elevation > 0))
  const terms = []
  const add = (id, score, note = '', uids = []) => terms.push({ id, label: LABELS[id], score: Math.max(0, Math.min(1, score)), weight: WEIGHTS[id], note, uids })

  // walls
  const backed = furniture.filter((i) => spec(i).againstWall)
  if (backed.length) {
    const bad = []
    let sum = 0
    for (const i of backed) {
      const { wall, gap } = nearestWall(i, size)
      const flush = gap <= 0.35
      const turned = angleBetween(i.rotation, WALL_ROTATION[wall]) <= 10
      const s = flush && turned ? 1 : flush ? 0.4 : band(gap, 0, 0.35, 2.5) * 0.5
      sum += s
      if (s < 0.99) bad.push(i.uid)
    }
    add('walls', sum / backed.length, bad.length ? `${bad.length} wall-backed piece${bad.length === 1 ? ' is' : 's are'} off the wall or turned the wrong way` : '', bad)
  }

  // facing
  const seats = furniture.filter((i) => SEATS[i.catalogId])
  const faced = []
  for (const i of seats) {
    const target = nearestOf(i, furniture, SEATS[i.catalogId], REACH[i.catalogId] || 13)
    if (target) faced.push({ i, s: band(aimError(i, target.x, target.z), 0, 25, 65) })
    else if (SEATS[i.catalogId].some((id) => furniture.some((o) => o.catalogId === id))) faced.push({ i, s: 0.3 }) // its partner is too far away
  }
  if (faced.length) {
    const bad = faced.filter((f) => f.s < 0.9).map((f) => f.i.uid)
    add('facing', faced.reduce((a, f) => a + f.s, 0) / faced.length, bad.length ? `${bad.length} seat${bad.length === 1 ? '' : 's'} not facing ${bad.length === 1 ? 'its' : 'their'} table or TV` : '', bad)
  }

  // spacing
  const rel = []
  const sofas = furniture.filter((i) => ['sofa', 'l-sofa'].includes(i.catalogId))
  // Partners are searched room-wide: one that is far away scores low instead of not counting.
  for (const t of furniture.filter((i) => i.catalogId === 'coffee-table')) {
    const s = nearestOf(t, sofas, ['sofa', 'l-sofa'], Infinity)
    if (!s) continue
    // In the sofa's own frame: a 1–2 ft gap in front of it, and centred on it.
    const { ahead, aside } = relative(s, t)
    const gapFront = ahead - footprint(s).d / 2 - depthAlong(t, s) / 2
    rel.push({ uid: t.uid, s: band(gapFront, 1, 2, 2) * band(aside, 0, 0.8, 2.5) })
  }
  for (const tv of furniture.filter((i) => i.catalogId === 'tv-unit')) {
    const s = nearestOf(tv, furniture, ['sofa', 'l-sofa', 'recliner'], Infinity)
    if (!s) continue
    const { ahead, aside } = relative(s, tv)
    rel.push({ uid: tv.uid, s: band(ahead, 6, 12, 5) * band(aside, 0, 1.5, 3) })
  }
  // Lounge chairs gather round the coffee table rather than sitting across the room.
  for (const c of furniture.filter((i) => ['armchair', 'recliner', 'bean-bag'].includes(i.catalogId))) {
    const t = nearestOf(c, furniture, ['coffee-table'], Infinity)
    if (t) rel.push({ uid: c.uid, s: band(boxGap(c, t), 0.5, 2.5, 3) })
  }
  for (const c of furniture.filter((i) => ['dining-chair', 'desk-chair', 'bar-stool'].includes(i.catalogId))) {
    const t = nearestOf(c, furniture, SEATS[c.catalogId], Infinity)
    if (t) rel.push({ uid: c.uid, s: band(boxGap(c, t), 0, 0.6, 1.5) })
  }
  for (const n of furniture.filter((i) => i.catalogId === 'bedside-table')) {
    const bed = nearestOf(n, furniture, BEDS, Infinity)
    if (bed) {
      // Beside the bed (small gap) and level with its head end.
      const [fx, fz] = front(bed)
      const along = (n.x - bed.x) * fx + (n.z - bed.z) * fz
      const headAt = -footprint(bed).d / 2 + footprint(n).d / 2
      rel.push({ uid: n.uid, s: band(boxGap(n, bed), 0, 0.4, 1.5) * band(along - headAt, -0.6, 0.6, 2) })
    }
  }
  if (rel.length) {
    const bad = rel.filter((r) => r.s < 0.8).map((r) => r.uid)
    add('spacing', rel.reduce((a, r) => a + r.s, 0) / rel.length, bad.length ? `${bad.length} piece${bad.length === 1 ? ' is' : 's are'} too near or too far from ${bad.length === 1 ? 'its' : 'their'} partner` : '', bad)
  }

  // circulation
  const doors = doorPoints(design, size)
  const targets = furniture.filter((i) => !SMALL(i) && !['rug', 'room-divider'].includes(i.catalogId))
  if (targets.length) {
    const grid = walkGrid(design, size, floor)
    const start = doors[0] || [0, size.length / 2 - 1]
    const seen = reachable(grid, start[0], start[1])
    const ok = (p) => {
      const c = grid.cellAt(p[0], p[1])
      return c >= 0 && seen[c]
    }
    const stuck = targets.filter((i) => !accessPoints(i).some(ok))
    add('circulation', 1 - stuck.length / targets.length, stuck.length ? `${stuck.length} piece${stuck.length === 1 ? ' has' : 's have'} no clear path from the door` : '', stuck.map((i) => i.uid))
  }

  // open centre
  const middle = { x0: -size.width * 0.2, x1: size.width * 0.2, z0: -size.length * 0.2, z1: size.length * 0.2 }
  const inMiddle = furniture.filter((i) => footprint(i).h > 3 && !CENTRE_OK.includes(i.catalogId) && i.x > middle.x0 && i.x < middle.x1 && i.z > middle.z0 && i.z < middle.z1)
  if (furniture.length) add('centre', 1 - inMiddle.length / Math.max(1, Math.min(3, furniture.length)), inMiddle.length ? 'Tall pieces stand in the middle of the room' : '', inMiddle.map((i) => i.uid))

  // windows
  const windows = design.openings.filter((o) => o.catalogId === 'window')
  if (windows.length) {
    const blockers = []
    let blocked = 0
    for (const win of windows) {
      const { span } = wallDims(size, win.wall)
      const hw = size.width / 2
      const hl = size.length / 2
      const lo = win.x - win.w / 2
      const hi = win.x + win.w / 2
      const sill = win.y - win.h / 2
      const hits = furniture.filter((i) => {
        const { wall, gap } = nearestWall(i, size)
        if (wall !== win.wall || gap > 1.5 || footprint(i).h <= sill + 0.5) return false
        const b = box(i)
        const [a0, a1] = win.wall === 'back' ? [b.x0 + hw, b.x1 + hw]
          : win.wall === 'front' ? [hw - b.x1, hw - b.x0]
            : win.wall === 'left' ? [hl - b.z1, hl - b.z0] : [b.z0 + hl, b.z1 + hl]
        return Math.min(a1, hi, span) - Math.max(a0, lo, 0) > 0.3
      })
      if (hits.length) { blocked += 1; blockers.push(...hits.map((i) => i.uid)) }
    }
    add('windows', 1 - blocked / windows.length, blocked ? 'Tall furniture stands in front of a window' : '', blockers)
  }

  // balance
  if (furniture.length >= 2) {
    let wsum = 0
    let mx = 0
    let mz = 0
    for (const i of furniture) {
      const { w, d, h } = footprint(i)
      const weight = w * d * Math.max(1, h)
      wsum += weight
      mx += weight * i.x
      mz += weight * i.z
    }
    const off = Math.hypot(mx / wsum / (size.width / 2), mz / wsum / (size.length / 2))
    add('balance', 1 - off * 1.4, off > 0.35 ? 'The furniture is piled towards one side' : '')
  }

  // gaps
  const big = furniture.filter((i) => !SMALL(i))
  if (big.length) {
    const PAIRED = (a, b) => (SEATS[a.catalogId] || []).includes(b.catalogId) || (SEATS[b.catalogId] || []).includes(a.catalogId)
      || (a.catalogId === 'bedside-table' && BEDS.includes(b.catalogId)) || (b.catalogId === 'bedside-table' && BEDS.includes(a.catalogId))
    const awkward = new Set()
    for (let x = 0; x < big.length; x++) {
      for (let y = x + 1; y < big.length; y++) {
        if (PAIRED(big[x], big[y])) continue
        const g = boxGap(big[x], big[y])
        if (g > 0.15 && g < 1.1) { awkward.add(big[x].uid); awkward.add(big[y].uid) }
      }
      const { gap } = nearestWall(big[x], size)
      if (gap > 0.35 && gap < 1.1) awkward.add(big[x].uid)
    }
    add('gaps', 1 - awkward.size / big.length / 1.5, awkward.size ? `${awkward.size} piece${awkward.size === 1 ? ' leaves' : 's leave'} a sliver of dead space` : '', [...awkward])
  }

  // vastu
  if (vastu) {
    const report = vastuReport(design, roomType, size)
    const judged = report?.checks.filter((c) => c.status !== 'na') || []
    if (judged.length) {
      const failing = judged.filter((c) => c.status === 'warn')
      add('vastu', judged.reduce((a, c) => a + c.fraction, 0) / judged.length, failing.length ? `${report.followed} of ${report.total} Vastu guidelines followed` : '', failing.flatMap((c) => c.uids))
    }
  }

  const weight = terms.reduce((a, t) => a + t.weight, 0)
  const total = weight ? Math.round((terms.reduce((a, t) => a + t.score * t.weight, 0) / weight) * 1000) / 10 : 0
  return { total, terms }
}
