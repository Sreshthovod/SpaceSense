/**
 * "AI arrange": turning a layout proposed by a language model into a real design.
 *
 * The model only ever sees a compact copy of the catalog and answers with catalog ids and positions.
 * Nothing it returns is trusted: unknown ids, bad numbers, pieces outside the room, overlaps, blocked
 * doors and table-top pieces with no table are all dropped by the same placement rules the templates
 * and the editor use, and the result is applied as one undoable change.
 */
import { FLOOR_ITEMS, WALL_ITEMS, floorItemSpec, wallItemSpec } from './catalog'
import { WALLS, roomSize, wallDims } from './design'
import { polishFloorEntries } from './layoutPolish'
import { finishedRoom, placeFloorEntries, placeWallEntries } from './templates'

export const MAX_FLOOR_PIECES = 60
export const MAX_WALL_PIECES = 30
export const MAX_NOTE = 300
const MAX_DOORS = 2
const MAX_WINDOWS = 4

const round = (n) => Math.round(n * 100) / 100

/** The catalog in the small form sent to the server (and from there into the prompt). Sizes are feet. */
export function catalogSummary() {
  return {
    floor: Object.entries(FLOOR_ITEMS).map(([id, spec]) => ({
      id,
      name: spec.name,
      w: spec.size.w,
      d: spec.size.d,
      h: spec.size.h,
      shape: spec.shape === 'round' ? 'round' : spec.shape?.parts ? 'l' : 'rect',
      against_wall: Boolean(spec.againstWall),
      surface: Boolean(spec.surface),
      on_surface: Boolean(spec.onSurface),
    })),
    wall: Object.entries(WALL_ITEMS).map(([id, spec]) => ({
      id,
      name: spec.name,
      w: spec.size.w,
      h: spec.size.h,
      opening: Boolean(spec.opening),
      default_y: spec.defaultY,
    })),
  }
}

/**
 * Where a door goes if the model didn't give one. The first spot is the one the templates use (right wall,
 * near the front corner), then the other walls. Placed before any furniture, so the door swing is kept clear.
 */
function doorSpots(size) {
  const spots = []
  for (const wall of ['right', 'front', 'left', 'back']) {
    const { span } = wallDims(size, wall)
    if (span < 4) continue
    for (const along of [span - 2.2, 2.2, span / 2, span * 0.25, span * 0.75]) spots.push({ id: 'door', wall, along: Math.max(1.6, along) })
  }
  return spots
}

/** Where a window goes if the model didn't give one: the middle of a wall, then either side of it. */
function windowSpots(size) {
  const spots = []
  for (const wall of ['left', 'back', 'right', 'front']) {
    const { span } = wallDims(size, wall)
    if (span < 5) continue
    for (const along of [span / 2, span * 0.3, span * 0.7]) spots.push({ id: 'window', wall, along })
  }
  return spots
}

/** Tries each spot in turn and keeps the first one the placement rules accept. */
function placeFirstFit(design, spots, newUid) {
  for (const spot of spots) {
    const r = placeWallEntries(design, [spot], newUid)
    if (r.placed === 1) return { design: r.design, added: true }
  }
  return { design, added: false }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const area = (id) => {
  const { w, d } = floorItemSpec(id).size
  return w * d
}

/**
 * Builds a design from a model's layout: `{accent_wall?, floor: [{type, x, z, rotation}], wall: [{type, wall, along, y?, w?, h?}]}`.
 * Returns the design, how many pieces the model proposed that were placed (`moved` of them nudged a little to find
 * room), and the names of those that were left out.
 *
 * A room always gets a door and, where a wall has space, a window: if the model left one out, a default is
 * added (named in `addedOpenings`). Openings go in first, so furniture is then kept clear of the door swing.
 */
export function buildFromLayout(current, layout, newUid) {
  const accent = WALLS.includes(layout?.accent_wall) ? layout.accent_wall : null
  const { design: base, preset } = finishedRoom(current, current.style, accent)
  const leftOut = []

  const wallEntries = []
  for (const raw of Array.isArray(layout?.wall) ? layout.wall.slice(0, MAX_WALL_PIECES) : []) {
    const spec = wallItemSpec(raw?.type)
    const along = num(raw?.along)
    if (!spec || !WALLS.includes(raw.wall) || along === null) { leftOut.push(spec?.name || String(raw?.type)); continue }
    const entry = { id: raw.type, wall: raw.wall, along }
    for (const k of ['y', 'w', 'h']) if (num(raw[k]) !== null) entry[k] = raw[k]
    wallEntries.push(entry)
  }

  const floorEntries = []
  for (const raw of Array.isArray(layout?.floor) ? layout.floor.slice(0, MAX_FLOOR_PIECES) : []) {
    const spec = floorItemSpec(raw?.type)
    const x = num(raw?.x)
    const z = num(raw?.z)
    if (!spec || x === null || z === null) { leftOut.push(spec?.name || String(raw?.type)); continue }
    floorEntries.push({
      id: raw.type, x: round(x), z: round(z), rotation: num(raw.rotation) ?? 0,
      tint: raw.type === 'rug' ? 'rug' : 'fabric', snapToWall: true, nudge: true, clearance: 1,
    })
  }
  // Tidy the model's details (angles, which way seats face, the rug), then place big pieces first so they
  // claim their spot and small pieces yield to them.
  const polished = polishFloorEntries(floorEntries, roomSize(base))
  leftOut.push(...polished.dropped)
  floorEntries.splice(0, floorEntries.length, ...polished.entries)
  floorEntries.sort((a, b) => area(b.id) - area(a.id))

  // Doors and windows first (a couple of each at most), then the rest of the wall pieces.
  const counts = { door: 0, window: 0 }
  const caps = { door: MAX_DOORS, window: MAX_WINDOWS }
  const openingEntries = []
  const decorEntries = []
  for (const entry of wallEntries) {
    if (!wallItemSpec(entry.id).opening) { decorEntries.push(entry); continue }
    if (counts[entry.id] >= caps[entry.id]) { leftOut.push(wallItemSpec(entry.id).name); continue }
    counts[entry.id] += 1
    openingEntries.push(entry)
  }

  const size = roomSize(base)
  const openings = placeWallEntries(base, openingEntries, newUid)
  let design = openings.design
  const addedOpenings = []
  const has = (id) => design.openings.some((o) => o.catalogId === id)
  if (!has('door')) {
    const fit = placeFirstFit(design, doorSpots(size), newUid)
    design = fit.design
    if (fit.added) addedOpenings.push('door')
  }
  if (!has('window')) {
    const fit = placeFirstFit(design, windowSpots(size), newUid)
    design = fit.design
    if (fit.added) addedOpenings.push('window')
  }

  const decor = placeWallEntries(design, decorEntries, newUid)
  const floor = placeFloorEntries(decor.design, floorEntries, preset, newUid)
  const names = [
    ...openings.leftOut.map((id) => wallItemSpec(id).name),
    ...decor.leftOut.map((id) => wallItemSpec(id).name),
    ...floor.leftOut.map((id) => floorItemSpec(id).name),
    ...leftOut,
  ]
  return {
    design: floor.design,
    placed: openings.placed + decor.placed + floor.placed,
    skipped: names.length,
    moved: floor.moved,
    addedOpenings,
    leftOut: names,
    size: roomSize(floor.design),
  }
}
