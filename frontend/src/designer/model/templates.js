/**
 * Starter rooms: one furniture layout per room type, finished in any of the styles. Layouts are
 * worked out from the room's size, and a piece that doesn't fit (it would overlap something, block
 * the door or be bigger than the room) is left out rather than placed badly. Templates only use
 * generic shapes: no product is ever chosen for the user.
 */
import { FABRICS, floorItemSpec } from './catalog'
import { ITEM_DEFAULTS, WALLS, createDesign, defaultFloor, defaultWall, roomSize } from './design'
import { designReducer } from './reducer'
import { alignToWall, clampToRoom, findFloorSpot, floorWarnings, footprint, itemsOverlap, settleItems } from './floorPlacement'
import { wallWarnings } from './wallPlacement'

/**
 * Finishes and colours per style. `accent` is the one wall that gets a stronger finish (the wall
 * behind the room's main piece); `fabric` and `rug` colour upholstered pieces and rugs.
 */
export const STYLE_PRESETS = {
  'modern-indian': { walls: '#e3d5bf', accent: { color: '#d9a98b' }, floor: { material: 'wood' }, fabric: '#b85c38', rug: '#9a6b52' },
  minimalist: { walls: '#efe9df', accent: null, floor: { material: 'tile' }, fabric: '#e4ddd2', rug: '#c9b9a6' },
  scandinavian: { walls: '#efe9df', accent: { color: '#c5cdb6' }, floor: { material: 'wood' }, fabric: '#c9b9a6', rug: '#e4ddd2' },
  'contemporary-luxury': {
    walls: '#e6e0d4', accent: { kind: 'wallpaper', pattern: 'grasscloth', color: '#cbb27a' }, floor: { material: 'marble', sheen: 'polished' }, fabric: '#5d6b7a', rug: '#e4ddd2',
  },
  boho: { walls: '#f1e4d0', accent: { kind: 'wallpaper', pattern: 'geometric', color: '#d9a98b' }, floor: { material: 'wood' }, fabric: '#cbb27a', rug: '#b85c38' },
  industrial: { walls: '#d8d2c6', accent: { color: '#5d5f5a' }, floor: { material: 'concrete' }, fabric: '#9a6b52', rug: '#3b3f3a' },
}

// Room-space helpers. W is the width (x), L the length (z); the back wall is at z = -L/2.
const depth = (id) => floorItemSpec(id).size.d
const width = (id) => floorItemSpec(id).size.w
const back = (id, x, L, extra = {}) => ({ id, x, z: -L / 2 + depth(id) / 2, rotation: 0, ...extra })
const front = (id, x, L, extra = {}) => ({ id, x, z: L / 2 - depth(id) / 2, rotation: 180, ...extra })
const left = (id, z, W, extra = {}) => ({ id, x: -W / 2 + depth(id) / 2, z, rotation: 90, ...extra })
const right = (id, z, W, extra = {}) => ({ id, x: W / 2 - depth(id) / 2, z, rotation: 270, ...extra })
const at = (id, x, z, rotation = 0, extra = {}) => ({ id, x, z, rotation, ...extra })

/** Distance along a wall, measured from its left end as seen from inside the room. */
export function alongWall(wall, x, z, { width: W, length: L }) {
  return { back: x + W / 2, front: W / 2 - x, left: L / 2 - z, right: z + L / 2 }[wall]
}

// The door sits on the right wall near the front corner in every layout, so layouts keep that corner clear.
const DOOR = ({ length: L }) => ({ id: 'door', wall: 'right', along: Math.max(1.6, L - 2.2) })

/**
 * Each layout returns { accent, wall: [...], floor: [...] }. Floor entries are tried in order, so the
 * most important pieces come first and win the space.
 */
const LAYOUTS = {
  'Living room': ({ width: W, length: L }) => ({
    accent: 'back',
    wall: [
      DOOR({ length: L }),
      { id: 'window', wall: 'left', along: L / 2 },
      { id: 'painting', wall: 'back', along: W / 2, y: 5.4, w: 3, h: 2 },
    ],
    floor: [
      back('sofa', 0, L, { tint: 'fabric' }),
      at('rug', 0, -L / 2 + 6, 90, { tint: 'rug' }),
      at('coffee-table', 0, -L / 2 + 5.5),
      front('tv-unit', 0, L),
      back('side-table', -4.35, L),
      back('floor-lamp', 4.3, L),
      at('armchair', -W / 2 + 1.6, -L / 2 + 6, 90, { tint: 'fabric' }),
      at('plant', -W / 2 + 0.9, L / 2 - 0.9),
      at('table-lamp', -4.35, -L / 2 + 0.75),
      at('vase', 0.8, -L / 2 + 5.5),
      at('small-plant', 1.4, L / 2 - 0.65),
    ],
  }),
  Bedroom: ({ width: W, length: L }) => ({
    accent: 'back',
    wall: [
      DOOR({ length: L }),
      { id: 'window', wall: 'left', along: L * 0.7 },
      { id: 'painting', wall: 'back', along: W / 2, y: 5.8, w: 3.5, h: 1.6 },
      { id: 'mirror', wall: 'right', along: L / 2, y: 5 },
    ],
    floor: [
      back('bed', 0, L, { tint: 'fabric' }),
      back('bedside-table', -3.4, L),
      back('bedside-table', 3.4, L),
      at('rug', 0, -L / 2 + 6.5, 90, { tint: 'rug' }),
      left('wardrobe', L / 2 - 2.5, W),
      right('dresser', 0, W),
      at('plant', -W / 2 + 0.8, -L / 2 + 0.8),
      at('table-lamp', -3.4, -L / 2 + 0.68),
      at('table-lamp', 3.4, -L / 2 + 0.68),
      at('vase', W / 2 - 0.8, 0.5),
    ],
  }),
  Kitchen: (size) => {
    const { width: W, length: L } = size
    // A run along the back wall: fridge in the corner, then counters, sink and cooktop.
    const floor = []
    const wall = [DOOR(size), { id: 'window', wall: 'front', along: W / 2 }]
    // Fridge, sink and cooktop come first; counters fill whatever width is left.
    const run = ['fridge', 'base-cabinet', 'sink-cabinet', 'base-cabinet', 'stove']
    const total = () => run.reduce((sum, id) => sum + width(id), 0)
    while (total() > W && run.includes('base-cabinet')) run.splice(run.lastIndexOf('base-cabinet'), 1)
    while (total() > W) run.pop()
    while (total() + width('base-cabinet') <= W) run.push('base-cabinet')
    let cursor = -W / 2
    for (const id of run) {
      const w = width(id)
      const x = cursor + w / 2
      floor.push(back(id, x, L))
      if (id === 'stove') wall.push({ id: 'range-hood', wall: 'back', along: alongWall('back', x, 0, size) })
      else if (id !== 'fridge') wall.push({ id: 'wall-cabinet', wall: 'back', along: alongWall('back', x, 0, size), w })
      cursor += w
    }
    wall.push({ id: 'spice-rack', wall: 'left', along: L - 3.2, y: 4 })
    // A short return along the left wall in longer rooms: a pantry and two more counters.
    if (L >= 10) {
      let z = -L / 2 + 2.3
      for (const id of ['base-cabinet', 'base-cabinet', 'tall-cabinet']) {
        floor.push(left(id, z + width(id) / 2, W))
        if (id === 'base-cabinet') wall.push({ id: 'wall-cabinet', wall: 'left', along: alongWall('left', 0, z + 1, size), w: 2 })
        z += width(id)
      }
    }
    // An island with stools in roomy kitchens, a trolley otherwise.
    if (W >= 11 && L >= 12) {
      const z = -L / 2 + 2 + 3.5 + 1.35
      floor.push(at('kitchen-island', 0.5, z))
      for (const x of [-0.9, 0.5, 1.9]) floor.push(at('bar-stool', x, z + 1.35 + 0.75, 180))
      floor.push(at('small-plant', 2.2, z - 0.5))
    } else {
      const trolley = right('kitchen-trolley', -L / 2 + 3.5, W)
      floor.push(trolley, at('small-plant', trolley.x, trolley.z))
    }
    return { accent: null, wall, floor }
  },
  'Dining room': ({ width: W, length: L }) => ({
    accent: 'back',
    wall: [
      DOOR({ length: L }),
      { id: 'window', wall: 'left', along: L / 2 },
      { id: 'painting', wall: 'back', along: W / 2, y: 5.2, w: 3, h: 2 },
    ],
    floor: [
      at('dining-table', 0, 0.5),
      at('dining-chair', -1.25, 0.5 - 2.4, 0),
      at('dining-chair', 1.25, 0.5 - 2.4, 0),
      at('dining-chair', -1.25, 0.5 + 2.4, 180),
      at('dining-chair', 1.25, 0.5 + 2.4, 180),
      at('dining-chair', -3.4, 0.5, 90),
      at('dining-chair', 3.4, 0.5, 270),
      at('rug', 0, 0.5, 90, { tint: 'rug', scale: 1.4 }),
      back('sideboard', 0, L),
      at('plant', -W / 2 + 0.9, L / 2 - 0.9),
      at('vase', 0, 0.5),
      at('table-lamp', 1.8, -L / 2 + 0.75),
    ],
  }),
  'Home office': ({ width: W, length: L }) => ({
    accent: 'back',
    wall: [
      DOOR({ length: L }),
      { id: 'window', wall: 'back', along: W / 2, y: 5.2 },
      { id: 'clock', wall: 'right', along: L * 0.4, y: 6 },
      { id: 'shelf', wall: 'left', along: 2.5, y: 5.5 },
    ],
    floor: [
      back('study-desk', 0, L),
      at('desk-chair', 0, -L / 2 + 1.7 + 1.35, 180, { tint: 'fabric' }),
      left('bookshelf', -L / 2 + 3, W),
      back('filing-cabinet', 3.3, L),
      at('rug', 0, 0.5, 90, { tint: 'rug' }),
      at('armchair', -W / 2 + 1.6, L / 2 - 2, 90, { tint: 'fabric' }),
      at('floor-lamp', -W / 2 + 0.8, L / 2 - 4.1),
      at('plant', -W / 2 + 0.75, -L / 2 + 0.75),
      at('work-lamp', 1.6, -L / 2 + 0.6),
      at('small-plant', 3.3, -L / 2 + 0.95),
    ],
  }),
  'Kids room': ({ width: W, length: L }) => ({
    accent: 'left',
    wall: [
      DOOR({ length: L }),
      { id: 'window', wall: 'back', along: W - 2.6, y: 5.2 },
      { id: 'clock', wall: 'left', along: L - 2, y: 6 },
      { id: 'shelf', wall: 'left', along: L - 6, y: 5.5 },
    ],
    floor: [
      left('single-bed', -L / 2 + 1.95, W, { tint: 'fabric' }),
      back('study-desk', W / 2 - 2.5, L),
      at('desk-chair', W / 2 - 2.5, -L / 2 + 1.7 + 1.35, 180, { tint: 'fabric' }),
      right('toy-storage', 0.3, W),
      left('bedside-table', -L / 2 + 4.35, W),
      at('rug', 0, 1, 90, { tint: 'rug', scale: 0.8 }),
      at('bean-bag', 0.5, L / 2 - 2.2, 180, { tint: 'fabric' }),
      front('wardrobe', -W / 2 + 2.2, L),
      at('work-lamp', W / 2 - 1, -L / 2 + 0.6),
      at('table-lamp', -W / 2 + 0.68, -L / 2 + 4.35),
    ],
  }),
}

export const TEMPLATE_ROOM_TYPES = Object.keys(LAYOUTS)

/**
 * The plain starter layout for a room type and size, in the shape an AI layout comes back in
 * (`{floor: [{type, x, z, rotation}], wall: [{type, wall, along, y?}]}`). Shown to the model as an example.
 */
export function exampleLayout(roomType, size) {
  const plan = LAYOUTS[roomType]?.(size)
  if (!plan) return null
  const r = (n) => Math.round(n * 100) / 100
  return {
    floor: plan.floor.map((e) => ({ type: e.id, x: r(e.x), z: r(e.z), rotation: e.rotation })),
    wall: plan.wall.map((e) => ({ type: e.id, wall: e.wall, along: r(e.along), ...(e.y !== undefined ? { y: r(e.y) } : {}) })),
  }
}

/** The finishes of a style on a fresh design: walls, accent wall and floor. */
function applyFinishes(design, preset, accent) {
  const walls = Object.fromEntries(WALLS.map((w) => [w, defaultWall(preset.walls)]))
  if (accent && preset.accent) {
    const a = preset.accent
    walls[accent] = { ...walls[accent], color: a.color, ...(a.kind === 'wallpaper' ? { kind: 'wallpaper', pattern: a.pattern } : {}) }
  }
  const floor = { ...defaultFloor(preset.floor.material), ...(preset.floor.sheen ? { sheen: preset.floor.sheen } : {}) }
  return { ...design, walls, floor }
}

/** A fresh, empty design that keeps the room's size, budget, style and photo. */
export function emptyRoom(current) {
  return { ...createDesign({}), room: current.room, budget: current.budget, style: current.style, photo: current.photo, facing: current.facing ?? null }
}

/**
 * Adds wall pieces one at a time through the reducer. A piece that can't be added, or that would
 * overlap something already on its wall, is left out (and named in `leftOut`).
 * Entries: `{id, wall, along, y?, w?, h?}`.
 */
export function placeWallEntries(design, entries, newUid) {
  let current = design
  let placed = 0
  const leftOut = []
  for (const entry of entries) {
    const uid = newUid()
    const added = designReducer(current, { type: 'addWallItem', uid, wall: entry.wall, catalogId: entry.id })
    if (added === current) { leftOut.push(entry.id); continue }
    const changes = { x: entry.along }
    for (const k of ['y', 'w', 'h']) if (entry[k] !== undefined) changes[k] = entry[k]
    const moved = designReducer(added, { type: 'updatePlaced', uid, changes })
    const sameWall = [...moved.openings, ...moved.items].filter((i) => i.wall === entry.wall)
    if (wallWarnings(sameWall).some((w) => w.kind === 'overlap' && w.ids.includes(uid))) { leftOut.push(entry.id); continue }
    current = moved
    placed += 1
  }
  return { design: current, placed, leftOut }
}

/** How close (ft) a wall-backed piece must already be to a wall for an AI layout to snap it flush. */
const SNAP_TO_WALL_FT = 2.5

// Pieces that belong close together: a chair tucks under its table, a bedside table sits by its bed.
const TUCKED = ['dining-chair', 'desk-chair', 'bar-stool', 'pouf', 'bean-bag']
const BED_IDS = ['bed', 'single-bed', 'bunk-bed']

/** The walkway (ft) to leave between two floor pieces: none where one sits on or under the other. */
function walkway(a, b) {
  const sa = floorItemSpec(a.catalogId)
  const sb = floorItemSpec(b.catalogId)
  if (sa.layer === 'rug' || sb.layer === 'rug' || sa.onSurface || sb.onSurface) return 0
  if (TUCKED.includes(a.catalogId) || TUCKED.includes(b.catalogId)) return 0.25
  if ((a.catalogId === 'bedside-table' && BED_IDS.includes(b.catalogId)) || (b.catalogId === 'bedside-table' && BED_IDS.includes(a.catalogId))) return 0.15
  const small = (s) => Math.max(s.size.w, s.size.d) < 2.2
  return small(sa) || small(sb) ? 0.5 : 1
}

/** True when a piece leaves less than `scale` times the usual walkway to something already placed. */
function tooClose(candidate, items, scale) {
  const f = footprint(candidate)
  for (const other of items) {
    if (other.wall || other.hidden) continue
    const gap = walkway(candidate, other) * scale
    if (gap > 0 && itemsOverlap({ ...candidate, scale: 1, size: { w: f.w + 2 * gap, d: f.d + 2 * gap, h: f.h } }, other)) return true
  }
  return false
}

/** How far (ft) a rejected piece may be moved to find room, and the grid it tries. */
const NUDGE_RADIUS_FT = 3
const NUDGE_STEP_FT = 0.5
const NUDGE_OFFSETS = (() => {
  const offsets = []
  for (let dx = -NUDGE_RADIUS_FT; dx <= NUDGE_RADIUS_FT; dx += NUDGE_STEP_FT) {
    for (let dz = -NUDGE_RADIUS_FT; dz <= NUDGE_RADIUS_FT; dz += NUDGE_STEP_FT) {
      if (dx || dz) offsets.push([dx, dz])
    }
  }
  return offsets.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
})()

/**
 * Adds floor pieces, clamped into the room. A piece that would overlap, block the door or hit wall
 * décor is left out, and so is a table-top piece with no table under it.
 * Entries: `{id, x, z, rotation, scale?, tint?, snapToWall?, nudge?}`. `snapToWall` pushes a wall-backed piece
 * flush against the wall it is already next to, so a layout that is a few inches off still sits right.
 * `clearance` (1 for normal walkways) asks for breathing room around the piece: it looks for a spot that
 * leaves it first, and only if there is none settles for any spot the placement rules accept.
 * `nudge` lets a piece that doesn't fit where it was put move to the nearest free spot within a few feet
 * (counted in `moved`) instead of being dropped, and a table-top piece with no table under it goes onto any
 * free table (so a lamp follows its table when that table had to move). With no table it is still left out.
 */
export function placeFloorEntries(design, entries, preset, newUid) {
  let current = design
  const size = roomSize(design)
  let placed = 0
  let moved = 0
  const leftOut = []
  for (const entry of entries) {
    const spec = floorItemSpec(entry.id)
    const tint = entry.tint && spec.colors ? preset[entry.tint] : null
    const uid = newUid()
    let item = clampToRoom({
      ...ITEM_DEFAULTS, uid, catalogId: entry.id, wall: null, x: entry.x, z: entry.z, rotation: entry.rotation, scale: entry.scale || 1,
      color: tint && FABRICS.includes(tint) ? tint : null,
    }, size)
    if (entry.snapToWall && spec.againstWall) {
      const flush = alignToWall(item, size)
      if (Math.abs(flush.x - item.x) + Math.abs(flush.z - item.z) <= SNAP_TO_WALL_FT) item = flush
    }
    // Returns the design with this piece added, or null when it floats or breaks a placement rule.
    const attempt = (candidate) => {
      const trial = { ...current, items: settleItems([...current.items, candidate]) }
      // Small pieces meant for a table top are left out when there's no table under them.
      const settled = trial.items[trial.items.length - 1]
      if (spec.onSurface && !settled.elevation) return { trial: null, floating: true }
      return { trial: floorWarnings(trial, uid).length ? null : trial, floating: false }
    }
    // Where it was put, then (if allowed) the nearest spot that works. `roomy` also demands the walkway.
    const search = (roomy) => {
      const ok = (candidate) => {
        const { trial } = attempt(candidate)
        return trial && !(roomy && tooClose(candidate, current.items, entry.clearance)) ? trial : null
      }
      const here = ok(item)
      if (here) return { trial: here, shifted: false }
      if (!entry.nudge) return null
      for (const [dx, dz] of NUDGE_OFFSETS) {
        const candidate = clampToRoom({ ...item, x: item.x + dx, z: item.z + dz }, size)
        if (candidate.x === item.x && candidate.z === item.z) continue
        const trial = ok(candidate)
        if (trial) return { trial, shifted: true }
      }
      return null
    }
    let found = null
    if (attempt(item).floating) {
      if (entry.nudge) {
        const trial = attempt(findFloorSpot(item, current)).trial // a free table top, if there is one
        if (trial) found = { trial, shifted: true }
      }
    } else {
      found = (entry.clearance && search(true)) || search(false)
    }
    if (!found) { leftOut.push(entry.id); continue }
    current = found.trial
    placed += 1
    if (found.shifted) moved += 1
  }
  return { design: current, placed, moved, leftOut }
}

/**
 * A furnished starter design for a room type in a style, sized to the current room. Returns the
 * design and how many pieces were left out because they didn't fit.
 */
export function buildTemplate(current, roomType, styleId, newUid) {
  const layout = LAYOUTS[roomType]
  const preset = STYLE_PRESETS[styleId] || STYLE_PRESETS.scandinavian
  if (!layout) return { design: emptyRoom(current), placed: 0, skipped: 0 }
  const plan = layout(roomSize(current))
  const base = applyFinishes({ ...emptyRoom(current), style: styleId }, preset, plan.accent)
  const walls = placeWallEntries(base, plan.wall, newUid)
  const floor = placeFloorEntries(walls.design, plan.floor, preset, newUid)
  return { design: floor.design, placed: walls.placed + floor.placed, skipped: walls.leftOut.length + floor.leftOut.length }
}

/** A starting design with a style's finishes (walls, accent, floor) and nothing placed. Used by AI layouts. */
export function finishedRoom(current, styleId, accentWall = null) {
  const preset = STYLE_PRESETS[styleId] || STYLE_PRESETS.scandinavian
  return { design: applyFinishes({ ...emptyRoom(current), style: styleId }, preset, accentWall), preset }
}
