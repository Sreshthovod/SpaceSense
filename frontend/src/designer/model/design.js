/**
 * The 3D Room Designer's single serializable design object, plus pure helpers for the room.
 *
 * Units: feet for every length (the form asks for feet), INR for money. Scene coordinates put the
 * floor centre at the origin: x runs across the room's width, z along its length, y up.
 */
import { LIMITS } from '../../utils/validation'

export const SCHEMA_VERSION = 2

// Demo defaults when the designer opens without a filled-in brief.
export const DEMO = { budget: 25000, style: 'modern-indian', width: 12, length: 14, height: 9 }

// "Warm & cozy" is a designer label for the existing Modern Indian style, not a new style id.
const STYLE_LABELS = { 'modern-indian': 'Warm & cozy (Modern Indian)' }
export const styleLabel = (id, fallback = '') => STYLE_LABELS[id] || fallback || id

export const DIMENSIONS = ['width', 'length', 'height']
export const DIMENSION_LABELS = { width: 'Width', length: 'Length', height: 'Ceiling height' }
export const DIMENSION_LIMITS = { width: LIMITS.width, length: LIMITS.length, height: LIMITS.height }

export const WALLS = ['back', 'right', 'front', 'left']
export const WALL_LABELS = { back: 'Back wall', right: 'Right wall', front: 'Front wall', left: 'Left wall' }
export const WALL_THICKNESS = 0.4

export const PAINTS = [
  { id: 'warm-white', label: 'Warm white', color: '#efe9df' },
  { id: 'sand', label: 'Sand', color: '#e3d5bf' },
  { id: 'sage', label: 'Sage', color: '#c5cdb6' },
  { id: 'terracotta', label: 'Terracotta', color: '#d9a98b' },
  { id: 'dusty-blue', label: 'Dusty blue', color: '#b9c6cf' },
  { id: 'charcoal', label: 'Charcoal', color: '#5d5f5a' },
]

export const FLOOR_MATERIALS = {
  wood: { label: 'Wood', color: '#a47551', roughness: 0.65 },
  tile: { label: 'Tile', color: '#d9d4ca', roughness: 0.35 },
  marble: { label: 'Marble', color: '#ece8e1', roughness: 0.2 },
  concrete: { label: 'Concrete', color: '#9c9a94', roughness: 0.9 },
}

const HEX = /^#[0-9a-f]{6}$/i

// Fields every placed item carries from schema version 2 on.
export const ITEM_DEFAULTS = { productId: null, label: null, hidden: false, locked: false, color: null }
export const defaultWall = (color = PAINTS[0].color) => ({ color, kind: 'paint', pattern: null, sheen: 'matte' })
export const defaultFloor = (material = 'wood') => ({
  material, color: FLOOR_MATERIALS[material].color, rotation: 0, scale: 1, sheen: 'matte',
})

const dimension = (raw, fallback) => {
  const n = Number(raw)
  return raw !== '' && raw != null && Number.isFinite(n) && n > 0
    ? { value: n, source: 'measured' }
    : { value: fallback, source: 'estimated' }
}

/** A fresh design from the room form. Values the user typed in are measured; the rest are estimates. */
export function createDesign({ form = {}, photoName = null } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    room: {
      width: dimension(form.width, DEMO.width),
      length: dimension(form.length, DEMO.length),
      height: dimension(form.height, DEMO.height),
    },
    walls: Object.fromEntries(WALLS.map((w) => [w, defaultWall()])),
    floor: defaultFloor(),
    openings: [], // doors and windows, placed per wall
    items: [], // placed catalog items
    budget: Number(form.budget) > 0 ? Number(form.budget) : DEMO.budget,
    style: form.style || DEMO.style,
    choices: { removed: [], replaced: {} },
    photo: photoName ? { name: photoName } : null,
  }
}

/**
 * Upgrades an older design object to the current schema. Unknown future versions are not touched;
 * validateDesign() rejects them.
 */
export function migrate(design) {
  let d = design
  if (d.schemaVersion === 1) {
    const upgrade = (list) => (Array.isArray(list) ? list.map((i) => ({ ...ITEM_DEFAULTS, ...i })) : list)
    d = {
      ...d,
      schemaVersion: 2,
      walls: Object.fromEntries(WALLS.map((w) => [w, { ...defaultWall(), ...(d.walls?.[w] || {}) }])),
      floor: { ...defaultFloor(FLOOR_MATERIALS[d.floor?.material] ? d.floor.material : 'wood'), ...(d.floor || {}) },
      items: upgrade(d.items),
      openings: upgrade(d.openings),
    }
  }
  return d
}

export const clampDimension = (key, value) => {
  const [min, max] = DIMENSION_LIMITS[key]
  return Math.min(max, Math.max(min, value))
}

export const isHexColor = (c) => typeof c === 'string' && HEX.test(c)

/** Room size as plain numbers. */
export const roomSize = (design) => ({
  width: design.room.width.value,
  length: design.room.length.value,
  height: design.room.height.value,
})

/**
 * Where each wall sits. `rotationY` turns the wall's local axes so local +z is the inward normal and
 * local +x runs left to right for someone standing inside the room facing that wall.
 */
export function wallSpecs({ width, length, height }) {
  const half = { x: width / 2, z: length / 2 }
  const specs = {
    back: { span: width, center: [0, height / 2, -half.z], normal: [0, 0, 1], rotationY: 0 },
    front: { span: width, center: [0, height / 2, half.z], normal: [0, 0, -1], rotationY: Math.PI },
    left: { span: length, center: [-half.x, height / 2, 0], normal: [1, 0, 0], rotationY: Math.PI / 2 },
    right: { span: length, center: [half.x, height / 2, 0], normal: [-1, 0, 0], rotationY: -Math.PI / 2 },
  }
  return WALLS.map((id) => ({ id, height, ...specs[id] }))
}

/** True when a point (e.g. the camera) is outside the room behind this wall, so the wall would block the view. */
export function isBehindWall(spec, [x, , z]) {
  const [cx, , cz] = spec.center
  const [nx, , nz] = spec.normal
  return (x - cx) * nx + (z - cz) * nz < 0
}

/**
 * A starting camera that looks into the room over the front-right corner. On a narrow (portrait)
 * canvas it steps back so the whole room still fits across the screen.
 */
export function defaultView({ width, length, height }, aspect = 1.5) {
  const reach = Math.max(width, length)
  const target = [0, height * 0.3, 0]
  const base = [width * 0.8 + reach * 0.15, height * 1.7 + reach * 0.25, length * 0.9 + reach * 0.45]
  const back = Math.max(1, 1.3 / aspect)
  return {
    position: base.map((v, i) => target[i] + (v - target[i]) * back),
    target,
    minDistance: 3,
    maxDistance: reach * 3 * back,
  }
}

/** Width and height of one wall as seen from inside the room. */
export function wallDims(size, wallId) {
  return { span: wallId === 'back' || wallId === 'front' ? size.width : size.length, height: size.height }
}

/** Doors and windows live in `openings`; everything else placed lives in `items`. */
export const collectionFor = (isOpening) => (isOpening ? 'openings' : 'items')

export function findPlaced(design, uid) {
  for (const key of ['items', 'openings']) {
    const index = design[key].findIndex((i) => i.uid === uid)
    if (index !== -1) return { key, index, item: design[key][index] }
  }
  return null
}

/** Everything attached to one wall: openings first so décor draws on top. */
export const onWall = (design, wallId) => [...design.openings, ...design.items].filter((i) => i.wall === wallId)
