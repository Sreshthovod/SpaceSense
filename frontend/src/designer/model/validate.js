/**
 * Turns untrusted data (a saved design, an imported file) into a safe design object, or explains why
 * it can't. Older versions are migrated, wrong values are replaced with defaults, unknown items are
 * dropped with a notice, and every placed item is clamped back inside the room.
 */
import { STYLES } from '../../data/sampleData'
import { floorItemSpec, wallItemSpec } from './catalog'
import {
  DEMO, DIMENSIONS, FLOOR_MATERIALS, ITEM_DEFAULTS, SCHEMA_VERSION, WALLS, clampDimension, defaultFloor, defaultWall,
  isHexColor, migrate, wallDims,
} from './design'
import { clampToRoom } from './floorPlacement'
import { clampToWall } from './wallPlacement'

export class DesignLoadError extends Error {}

const UID = /^[A-Za-z0-9_-]{1,64}$/
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const SHEENS = ['matte', 'eggshell', 'satin', 'polished']

function cleanItem(raw, size, notices) {
  if (!isObject(raw) || typeof raw.uid !== 'string' || !UID.test(raw.uid)) {
    notices.push('An item with a missing or invalid id was removed.')
    return null
  }
  const onWall = raw.wall !== null && raw.wall !== undefined
  const spec = onWall ? wallItemSpec(raw.catalogId) : floorItemSpec(raw.catalogId)
  if (!spec || (onWall && !WALLS.includes(raw.wall))) {
    notices.push(`An unknown item (${String(raw.catalogId).slice(0, 40)}) was removed.`)
    return null
  }
  const base = {
    ...ITEM_DEFAULTS,
    uid: raw.uid,
    catalogId: raw.catalogId,
    wall: onWall ? raw.wall : null,
    productId: typeof raw.productId === 'string' && raw.productId.length <= 80 ? raw.productId : null,
    label: typeof raw.label === 'string' ? raw.label.slice(0, 80) : null,
    hidden: raw.hidden === true,
    locked: raw.locked === true,
    color: isHexColor(raw.color) ? raw.color : null,
    rotation: num(raw.rotation, 0),
  }
  if (onWall) {
    const dims = wallDims(size, raw.wall)
    return clampToWall({
      ...base, x: num(raw.x, dims.span / 2), y: num(raw.y, spec.defaultY), w: num(raw.w, spec.size.w), h: num(raw.h, spec.size.h),
    }, dims)
  }
  return clampToRoom({ ...base, x: num(raw.x, 0), z: num(raw.z, 0), scale: num(raw.scale, 1) }, size)
}

/** Returns { design, notices }. Throws DesignLoadError when the data can't be used at all. */
export function validateDesign(raw) {
  if (!isObject(raw)) throw new DesignLoadError('This file is not a SpaceSense design.')
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion < 1) throw new DesignLoadError('This design has no version and cannot be loaded.')
  if (raw.schemaVersion > SCHEMA_VERSION) throw new DesignLoadError('This design was made with a newer version of SpaceSense.')
  const d = migrate(raw)
  const notices = []

  const room = {}
  for (const key of DIMENSIONS) {
    const dim = d.room?.[key]
    const value = num(dim?.value, DEMO[key])
    room[key] = { value: clampDimension(key, value), source: dim?.source === 'measured' ? 'measured' : 'estimated' }
  }
  const size = { width: room.width.value, length: room.length.value, height: room.height.value }

  const walls = Object.fromEntries(WALLS.map((w) => {
    const wall = isObject(d.walls?.[w]) ? d.walls[w] : {}
    const out = defaultWall(isHexColor(wall.color) ? wall.color : undefined)
    if (wall.kind === 'wallpaper' && typeof wall.pattern === 'string') Object.assign(out, { kind: 'wallpaper', pattern: wall.pattern.slice(0, 40) })
    if (SHEENS.includes(wall.sheen)) out.sheen = wall.sheen
    return [w, out]
  }))

  const f = isObject(d.floor) ? d.floor : {}
  const floor = defaultFloor(FLOOR_MATERIALS[f.material] ? f.material : 'wood')
  if (isHexColor(f.color)) floor.color = f.color
  if ([0, 45, 90].includes(f.rotation)) floor.rotation = f.rotation
  floor.scale = Math.min(3, Math.max(0.25, num(f.scale, 1)))
  if (SHEENS.includes(f.sheen)) floor.sheen = f.sheen

  const seen = new Set()
  const clean = (list) => (Array.isArray(list) ? list : [])
    .map((i) => cleanItem(i, size, notices))
    .filter((i) => {
      if (!i || seen.has(i.uid)) return false
      seen.add(i.uid)
      return true
    })
  const items = clean(d.items)
  const openings = clean(d.openings).filter((i) => i.wall && wallItemSpec(i.catalogId)?.opening)
  const misplacedOpenings = items.filter((i) => wallItemSpec(i.catalogId)?.opening)

  const design = {
    schemaVersion: SCHEMA_VERSION,
    room,
    walls,
    floor,
    openings: [...openings, ...misplacedOpenings],
    items: items.filter((i) => !wallItemSpec(i.catalogId)?.opening),
    budget: Math.min(100_000_000, Math.max(0, num(d.budget, DEMO.budget))),
    style: STYLES.some((s) => s.id === d.style) ? d.style : DEMO.style,
    choices: {
      removed: Array.isArray(d.choices?.removed) ? d.choices.removed.filter((x) => typeof x === 'string').slice(0, 200) : [],
      replaced: {},
    },
    photo: isObject(d.photo) && typeof d.photo.name === 'string' ? { name: d.photo.name.slice(0, 200) } : null,
  }
  return { design, notices: [...new Set(notices)] }
}

