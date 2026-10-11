/**
 * Which way the room faces, and Vastu checks on a placed design.
 *
 * `design.facing` is the compass side the BACK wall is on (one of 8 directions), or null when unknown.
 * Bearings are degrees clockwise from north. In room coordinates the back wall is at -z and the right
 * wall at +x, so (seen from above) turning clockwise from the back wall reaches the right wall.
 *
 * The Vastu checks are the widely quoted general guidelines the backend also uses (services/vastu.py),
 * not a professional consultation.
 */
import { DIRECTIONS } from '../../data/sampleData'
import { floorItemSpec } from './catalog'
import { footprint } from './floorPlacement'

export { DIRECTIONS }
export const SHORT = { north: 'N', 'north-east': 'NE', east: 'E', 'south-east': 'SE', south: 'S', 'south-west': 'SW', west: 'W', 'north-west': 'NW' }
const WALL_TURN = { back: 0, right: 90, front: 180, left: 270 }

export const isDirection = (d) => DIRECTIONS.includes(d)
export const bearingOf = (direction) => DIRECTIONS.indexOf(direction) * 45
const norm = (deg) => ((deg % 360) + 360) % 360
export const directionAt = (bearing) => DIRECTIONS[Math.round(norm(bearing) / 45) % 8]
/** Smallest angle between two bearings, 0–180. */
export const angleBetween = (a, b) => Math.abs(norm(a - b + 180) - 180)

/** The compass side each wall is on, e.g. { back: 'north', right: 'east', ... }. */
export function wallDirections(facing) {
  if (!isDirection(facing)) return null
  const back = bearingOf(facing)
  return Object.fromEntries(Object.entries(WALL_TURN).map(([wall, turn]) => [wall, directionAt(back + turn)]))
}

/** Compass bearing of a direction in room coordinates (x right, z towards the front wall). */
export const bearingOfVector = (facing, x, z) => norm(bearingOf(facing) + (Math.atan2(x, -z) * 180) / Math.PI)

/**
 * How far to turn a north-up compass rose so it matches the screen: given which way "up the screen"
 * points across the floor (a room-space vector), returns the rose rotation in degrees.
 */
export const roseRotation = (facing, upX, upZ) => -bearingOfVector(facing, upX, upZ)

/** Unit vectors for north and east in room coordinates (x, z). */
function axes(facing) {
  const o = (bearingOf(facing) * Math.PI) / 180
  return { n: [-Math.sin(o), -Math.cos(o)], e: [Math.cos(o), -Math.sin(o)] }
}

/**
 * Where a floor point sits on the compass, as `{ north, east }` from -1 (far south / west edge of the
 * room) to 1 (far north / east edge). Works for rooms turned diagonally too.
 */
export function compassPosition(facing, size, x, z) {
  const { n, e } = axes(facing)
  const hw = size.width / 2
  const hl = size.length / 2
  const corners = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]]
  const along = (v, p) => v[0] * p[0] + v[1] * p[1]
  const scale = (v) => Math.max(...corners.map((c) => along(v, c))) || 1 // the room is centred on 0
  return { north: along(n, [x, z]) / scale(n), east: along(e, [x, z]) / scale(e) }
}

/** The compass zone of a floor point: one of the 8 directions, or 'centre'. Thirds of the room each way. */
export function zoneOf(facing, size, x, z) {
  const { north, east } = compassPosition(facing, size, x, z)
  const ns = north > 1 / 3 ? 'north' : north < -1 / 3 ? 'south' : ''
  const ew = east > 1 / 3 ? 'east' : east < -1 / 3 ? 'west' : ''
  return ns && ew ? `${ns}-${ew}` : ns || ew || 'centre'
}

// Which way a piece faces (its front), as a room-space vector. Rotation 0 faces the front wall (+z).
const front = (item) => {
  const r = (item.rotation * Math.PI) / 180
  return [Math.sin(r), Math.cos(r)]
}

/** Opening centre in room coordinates; wall items store `x` as distance along the wall from its left end, seen inside. */
function openingPoint(o, size) {
  const hw = size.width / 2
  const hl = size.length / 2
  if (o.wall === 'back') return [o.x - hw, -hl]
  if (o.wall === 'front') return [hw - o.x, hl]
  if (o.wall === 'left') return [-hw, hl - o.x]
  return [hw, o.x - hl]
}

const HEAVY = ['sofa', 'l-sofa', 'wardrobe', 'bookshelf', 'dresser', 'sideboard', 'tall-cabinet', 'fridge', 'bunk-bed', 'filing-cabinet', 'toy-storage', 'shoe-cabinet', 'upright-piano', 'divan']
const BEDS = ['bed', 'single-bed', 'bunk-bed']
const SOFAS = ['sofa', 'l-sofa']
const NE_FRIENDLY = ['pooja-unit', 'aquarium', 'plant', 'small-plant']

/**
 * Checks a design against the Vastu guidelines for a room type. Each check is
 * `{ id, text, status: 'ok' | 'warn' | 'na', uids }` ('na': nothing in the room it applies to).
 * Returns null when the room's direction isn't set, because then nothing can be judged.
 */
export function vastuReport(design, roomType, size) {
  if (!isDirection(design.facing)) return null
  const facing = design.facing
  const items = design.items.filter((i) => !i.wall && !i.hidden && floorItemSpec(i.catalogId))
  const of = (ids) => items.filter((i) => ids.includes(i.catalogId))
  const pos = (i) => compassPosition(facing, size, i.x, i.z)
  const zone = (i) => zoneOf(facing, size, i.x, i.z)
  const facingBearing = (i) => bearingOfVector(facing, ...front(i))
  const behindBearing = (i) => norm(facingBearing(i) + 180)
  const near = (b, targets) => targets.some((t) => angleBetween(b, t) <= 45)

  // `fraction`: how many of the pieces it applies to pass (the layout optimiser climbs on this).
  const check = (id, text, list, pass) => {
    if (!list.length) return { id, text, status: 'na', uids: [], fraction: 1 }
    const failing = list.filter((i) => !pass(i))
    return { id, text, status: failing.length ? 'warn' : 'ok', uids: (failing.length ? failing : list).map((i) => i.uid), fraction: 1 - failing.length / list.length }
  }
  const southOrWest = (i) => pos(i).north < -0.2 || pos(i).east < -0.2
  const southWest = (i) => (pos(i).north < 0 && pos(i).east < 0) || southOrWest(i)
  const notInNorthEast = (i) => zone(i) !== 'north-east'
  // Tall pieces that weigh down the north-east. A pooja unit or aquarium belongs there, so it doesn't count.
  const tall = items.filter((i) => footprint(i).h > 3 && floorItemSpec(i.catalogId).layer !== 'rug' && !NE_FRIENDLY.includes(i.catalogId))
  const neClear = () => {
    if (!items.length) return { id: 'ne-clear', text: 'North-east corner kept light and clear', status: 'na', uids: [], fraction: 1 }
    const blocking = tall.filter((i) => !notInNorthEast(i))
    return {
      id: 'ne-clear', text: 'North-east corner kept light and clear', status: blocking.length ? 'warn' : 'ok',
      uids: blocking.map((i) => i.uid), fraction: 1 - blocking.length / Math.max(1, tall.length),
    }
  }
  // Someone working at a desk faces its back (the desk's front faces them).
  const deskFacesNorthOrEast = (i) => near(behindBearing(i), [0, 90])
  const doors = design.openings.filter((o) => o.catalogId === 'door').map((o) => openingPoint(o, size))
  const feetAtDoor = (bed) => doors.some(([dx, dz]) => {
    const [fx, fz] = front(bed)
    const vx = dx - bed.x
    const vz = dz - bed.z
    const len = Math.hypot(vx, vz) || 1
    return (fx * vx + fz * vz) / len > Math.cos((20 * Math.PI) / 180)
  })

  const type = (roomType || '').toLowerCase()
  let checks
  if (type === 'bedroom') {
    checks = [
      check('bed-sw', 'Bed in the south-west, or along the south or west wall', of(BEDS), southWest),
      check('bed-head', 'Headboard towards the south or west', of(BEDS), (i) => near(behindBearing(i), [180, 270])),
      check('bed-door', 'Feet not pointing straight at the door', of(BEDS), (i) => !feetAtDoor(i)),
      check('wardrobe-w', 'Wardrobe on the west or south-west side', of(['wardrobe']), (i) => pos(i).east < -0.2),
      neClear(),
    ]
  } else if (type === 'kitchen') {
    const stoves = of(['stove'])
    const sinks = of(['sink-cabinet'])
    checks = [
      check('stove-se', 'Cooking range in the south-east', stoves, (i) => pos(i).north < 0 && pos(i).east > 0),
      check('sink-ne', 'Sink in the north-east', sinks, (i) => pos(i).north > 0 && pos(i).east > 0),
      check('stove-sink', 'Stove not right beside the sink', sinks.length ? stoves : [], (s) => sinks.every((k) => Math.hypot(k.x - s.x, k.z - s.z) >= 4.5)),
      check('storage-sw', 'Tall storage and the fridge along the south or west', of(['tall-cabinet', 'fridge']), southOrWest),
    ]
  } else if (type === 'dining room') {
    checks = [
      check('table-we', 'Dining table towards the west or east', of(['dining-table']), (i) => Math.abs(pos(i).east) > 0.2),
      neClear(),
    ]
  } else if (type === 'home office') {
    checks = [
      check('desk-w', 'Desk towards the west or south-west', of(['study-desk']), (i) => pos(i).east < -0.2),
      check('desk-face', 'You face north or east while working', of(['study-desk']), deskFacesNorthOrEast),
      check('storage-sw', 'Storage and files along the south or west', of(['bookshelf', 'filing-cabinet']), southOrWest),
      neClear(),
    ]
  } else if (type === 'kids room') {
    checks = [
      check('desk-face', 'Study desk lets the child face north or east', of(['study-desk']), deskFacesNorthOrEast),
      check('bed-sw', 'Bed in the south-west or along the west', of(BEDS), southWest),
      check('storage-sw', 'Toys and heavy storage along the south or west', of(['toy-storage', 'wardrobe', 'bookshelf']), southOrWest),
      neClear(),
    ]
  } else {
    checks = [
      check('heavy-sw', 'Heavy furniture along the south or west', of(HEAVY), southOrWest),
      neClear(),
      check('tv-se', 'TV in the south-east', of(['tv-unit']), (i) => pos(i).north < 0 && pos(i).east > 0),
      check('seat-face', 'Main seating faces north or east', of(SOFAS), (i) => near(facingBearing(i), [0, 90])),
    ]
  }
  // Wherever they are, a pooja unit belongs in the north-east and an aquarium in the north, east or north-east.
  checks.push(
    check('pooja-ne', 'Pooja unit in the north-east', of(['pooja-unit']), (i) => pos(i).north > 0 && pos(i).east > 0),
    check('aquarium-ne', 'Aquarium towards the north, east or north-east', of(['aquarium']), (i) => pos(i).north > 0.2 || pos(i).east > 0.2),
  )
  const judged = checks.filter((c) => c.status !== 'na')
  return { checks, followed: judged.filter((c) => c.status === 'ok').length, total: judged.length }
}
