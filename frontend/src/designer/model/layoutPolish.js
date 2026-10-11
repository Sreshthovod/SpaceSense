/**
 * Tidying an AI layout before it is placed. A small language model gets the big idea of a room right
 * but is careless with the details that make it feel right: chairs turned the wrong way, odd angles,
 * a rug floating under nothing. These fixes are plain rules, so they behave the same every time and
 * never depend on the model getting them right. They only adjust the entries; every piece is still
 * checked by the normal placement rules afterwards.
 *
 * Entries are `{id, x, z, rotation, ...}` in feet from the room centre, front facing +z at rotation 0.
 */
import { floorItemSpec } from './catalog'

const RUG_SCALE = [0.6, 1.7]
const RUG_MARGIN = 1.5 // ft the rug should reach beyond the furniture on it
const BEDS = ['bed', 'single-bed', 'bunk-bed']
// What each kind of seat should face, nearest first, and how far away that may be (ft).
const FACES = {
  'dining-chair': { targets: ['dining-table', 'round-dining-table'], within: 5 },
  'desk-chair': { targets: ['study-desk', 'dressing-table'], within: 5 },
  'bar-stool': { targets: ['kitchen-island'], within: 5 },
  armchair: { targets: ['coffee-table', 'sofa', 'l-sofa'], within: 9 },
  'bean-bag': { targets: ['coffee-table', 'tv-unit'], within: 9 },
  recliner: { targets: ['coffee-table', 'tv-unit'], within: 10 },
}
// Seating and tables that make up a "group" a rug goes under.
const GROUP = ['sofa', 'l-sofa', 'armchair', 'recliner', 'dining-chair', 'coffee-table', 'dining-table', 'round-dining-table', 'desk-chair', 'study-desk', 'bean-bag']
// Where a rug goes, best anchor first.
const ANCHORS = [BEDS, ['dining-table', 'round-dining-table'], ['coffee-table'], ['study-desk']]

const turn90 = (deg) => ((Math.round(deg / 90) * 90) % 360 + 360) % 360
const faceAngle = (from, to) => turn90((Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI)
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const sizeOf = (e) => floorItemSpec(e.id).size
const half = (e) => {
  const { w, d } = sizeOf(e)
  const sideways = Math.round(e.rotation / 90) % 2 !== 0
  return { hx: (sideways ? d : w) / 2, hz: (sideways ? w : d) / 2 }
}

/** The nearest piece of the first kind in `ids` that is within reach (so a table beats a closer sofa). */
function nearest(entry, entries, ids, within) {
  for (const id of ids) {
    const candidates = entries.filter((o) => o !== entry && o.id === id && dist(entry, o) <= within)
    if (candidates.length) return candidates.reduce((a, b) => (dist(entry, a) <= dist(entry, b) ? a : b))
  }
  return null
}

/** Distance from a piece's edge to the nearest wall (0 when it touches one). */
function wallGap(entry, size) {
  const { hx, hz } = half(entry)
  return Math.min(entry.x + size.width / 2 - hx, size.width / 2 - entry.x - hx, entry.z + size.length / 2 - hz, size.length / 2 - entry.z - hz)
}

const FLOATING_FROM_WALL = 2.5 // a wall-backed piece closer than this is pushed flush, further it floats

function fixRug(entries, rug, size) {
  const anchor = ANCHORS.map((ids) => nearest(rug, entries, ids, Infinity)).find(Boolean)
  if (!anchor) return false
  const group = entries.filter((e) => GROUP.includes(e.id) && dist(e, anchor) <= 4.5)
  if (!group.includes(anchor)) group.push(anchor)
  const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
  for (const e of group) {
    const { hx, hz } = half(e)
    box.x0 = Math.min(box.x0, e.x - hx); box.x1 = Math.max(box.x1, e.x + hx)
    box.z0 = Math.min(box.z0, e.z - hz); box.z1 = Math.max(box.z1, e.z + hz)
  }
  let cx = (box.x0 + box.x1) / 2
  let cz = (box.z0 + box.z1) / 2
  let coverW = box.x1 - box.x0 + RUG_MARGIN
  let coverD = box.z1 - box.z0 + RUG_MARGIN
  if (BEDS.includes(anchor.id)) {
    // A bed's rug sticks out from the foot, not the headboard: cover the bed, then shift towards the foot.
    const front = [Math.sin((anchor.rotation * Math.PI) / 180), Math.cos((anchor.rotation * Math.PI) / 180)]
    const onX = Math.abs(front[0]) > Math.abs(front[1])
    const reach = 2.5
    if (onX) { coverW += reach; cx += (Math.sign(front[0]) * reach) / 2 } else { coverD += reach; cz += (Math.sign(front[1]) * reach) / 2 }
  }
  const { w: rw, d: rd } = floorItemSpec(rug.id).size
  const need0 = Math.max(coverW / rw, coverD / rd) // rug as it is: long side along the room's length
  const need90 = Math.max(coverW / rd, coverD / rw) // turned a quarter
  const turned = need90 < need0
  const scale = Math.min(RUG_SCALE[1], Math.max(RUG_SCALE[0], turned ? need90 : need0))
  Object.assign(rug, { x: cx, z: cz, rotation: turned ? 90 : 0, scale })
  // Keep it in the room; the placement step clamps again.
  rug.x = Math.max(-size.width / 2, Math.min(size.width / 2, rug.x))
  rug.z = Math.max(-size.length / 2, Math.min(size.length / 2, rug.z))
  return true
}

/**
 * Returns `{entries, dropped}`: the entries with tidy angles, seats turned to face what they belong
 * to, bedside tables matching their bed and rugs re-fitted under their group, and the names of any
 * rugs that had nothing to sit under (and one rug too many) and were removed.
 */
export function polishFloorEntries(entries, size) {
  const list = entries.map((e) => ({ ...e }))

  // 1. Clean angles: right angles for everything, none for round pieces.
  for (const e of list) e.rotation = floorItemSpec(e.id).shape === 'round' ? 0 : turn90(e.rotation || 0)

  // 2. Seats face what they belong with.
  for (const e of list) {
    const rule = FACES[e.id]
    if (!rule) continue
    const target = nearest(e, list, rule.targets, rule.within)
    if (target) e.rotation = faceAngle(e, target)
  }
  // A sofa or TV unit that floats (is not at a wall) faces its partner; at a wall it is flushed when placed.
  for (const e of list) {
    if (!['sofa', 'l-sofa', 'tv-unit'].includes(e.id) || wallGap(e, size) <= FLOATING_FROM_WALL) continue
    const target = nearest(e, list, e.id === 'tv-unit' ? ['sofa', 'l-sofa'] : ['coffee-table', 'tv-unit'], 12)
    if (target) e.rotation = faceAngle(e, target)
  }
  // 3. A bedside table faces the way its bed does.
  for (const e of list) {
    if (e.id !== 'bedside-table') continue
    const bed = nearest(e, list, BEDS, 5)
    if (bed) e.rotation = bed.rotation
  }

  // 4. Rugs: one, under its group.
  const dropped = []
  const rugs = list.filter((e) => floorItemSpec(e.id).layer === 'rug')
  let kept = 0
  for (const rug of rugs) {
    if (kept === 0 && fixRug(list, rug, size)) { kept += 1; continue }
    list.splice(list.indexOf(rug), 1)
    dropped.push(floorItemSpec(rug.id).name)
  }
  return { entries: list, dropped }
}
