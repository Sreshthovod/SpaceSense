import {
  DIMENSIONS, FLOOR_MATERIALS, ITEM_DEFAULTS, PAINTS, WALLS, clampDimension, collectionFor, findPlaced, isHexColor, onWall,
  roomSize, wallDims,
} from './design'
import { STYLES } from '../../data/sampleData'
import { floorItemSpec, wallItemSpec } from './catalog'
import { FLOOR_ROTATIONS, FLOOR_SCALE, FLOOR_SHEENS, WALLPAPERS, WALL_SHEENS } from './finishes'
import { alignToWall, clampToRoom, findFloorSpot, settleItems } from './floorPlacement'
import { clampToWall, findFreeSpot } from './wallPlacement'

const DUPLICATE_OFFSET = 0.5

const replaceAt = (list, index, value) => list.map((v, i) => (i === index ? value : v))

/** Clamp a placed item to its wall, or to the room if it stands on the floor. */
const clampPlaced = (item, size) => (item.wall ? clampToWall(item, wallDims(size, item.wall)) : clampToRoom(item, size))

/** Keep every placed item inside the room after it changes size. */
function reclampAll(design) {
  const size = roomSize(design)
  const fix = (list) => list.map((i) => clampPlaced(i, size))
  return { ...design, items: fix(design.items), openings: fix(design.openings) }
}

const SIZE_LIMIT = 30 // ft; a product size larger than this is not a real piece of furniture
const validSize = (size) => size && ['w', 'd', 'h'].every((k) => Number.isFinite(size[k]) && size[k] > 0 && size[k] <= SIZE_LIMIT)

/**
 * Every design edit goes through here (undo/redo wraps it). Invalid actions are ignored. After any
 * change, small items re-settle onto whatever table-like surface is under them.
 */
export function designReducer(design, action) {
  const next = applyAction(design, action)
  if (next === design) return design
  const items = settleItems(next.items)
  return items === next.items ? next : { ...next, items }
}

function applyAction(design, action) {
  switch (action.type) {
    case 'setDimension': {
      const { key, value } = action
      if (!DIMENSIONS.includes(key) || !Number.isFinite(value) || value <= 0) return design
      const next = clampDimension(key, value)
      if (next === design.room[key].value) return design
      return reclampAll({ ...design, room: { ...design.room, [key]: { ...design.room[key], value: next } } })
    }
    case 'setDimensionSource': {
      const { key, source } = action
      if (!DIMENSIONS.includes(key) || !['measured', 'estimated'].includes(source)) return design
      return { ...design, room: { ...design.room, [key]: { ...design.room[key], source } } }
    }
    case 'setWallColor': {
      const { wall, color } = action
      if (!isHexColor(color)) return design
      const targets = wall === 'all' ? WALLS : WALLS.filter((w) => w === wall)
      if (!targets.length) return design
      const walls = { ...design.walls }
      for (const w of targets) walls[w] = { ...walls[w], color }
      return { ...design, walls }
    }
    case 'setFloor': {
      const material = action.material ?? design.floor.material
      if (!FLOOR_MATERIALS[material]) return design
      // Choosing a material resets to its colour; an explicit colour wins.
      const color = action.color ?? (action.material ? FLOOR_MATERIALS[material].color : design.floor.color)
      if (!isHexColor(color)) return design
      const floor = { ...design.floor, material, color }
      if (action.rotation !== undefined) {
        if (!FLOOR_ROTATIONS.includes(action.rotation)) return design
        floor.rotation = action.rotation
      }
      if (action.scale !== undefined) {
        if (!Number.isFinite(action.scale)) return design
        floor.scale = Math.min(FLOOR_SCALE[1], Math.max(FLOOR_SCALE[0], action.scale))
      }
      if (action.sheen !== undefined) {
        if (!FLOOR_SHEENS[action.sheen]) return design
        floor.sheen = action.sheen
      }
      if (Object.keys(floor).every((k) => floor[k] === design.floor[k])) return design
      return { ...design, floor }
    }
    case 'setWallFinish': {
      // Paint (a colour and sheen) or wallpaper (a pattern in a colour), for one wall or all of them.
      const targets = action.wall === 'all' ? WALLS : WALLS.filter((w) => w === action.wall)
      if (!targets.length) return design
      if (action.color !== undefined && !isHexColor(action.color)) return design
      if (action.kind !== undefined && !['paint', 'wallpaper'].includes(action.kind)) return design
      if (action.pattern !== undefined && action.pattern !== null && !WALLPAPERS[action.pattern]) return design
      if (action.sheen !== undefined && !WALL_SHEENS[action.sheen]) return design
      const walls = { ...design.walls }
      let changed = false
      for (const w of targets) {
        const next = { ...walls[w] }
        if (action.color !== undefined) next.color = action.color
        if (action.sheen !== undefined) next.sheen = action.sheen
        if (action.kind === 'paint') next.pattern = null
        if (action.kind !== undefined) next.kind = action.kind
        if (action.pattern !== undefined) next.pattern = action.pattern
        if (next.kind === 'wallpaper' && !next.pattern) next.pattern = 'stripe'
        if (Object.keys(next).some((k) => next[k] !== walls[w][k])) changed = true
        walls[w] = next
      }
      return changed ? { ...design, walls } : design
    }
    case 'addWallItem': {
      const { uid, wall, catalogId } = action
      const spec = wallItemSpec(catalogId)
      if (!spec || !WALLS.includes(wall) || !uid || findPlaced(design, uid)) return design
      const dims = wallDims(roomSize(design), wall)
      const fresh = { ...ITEM_DEFAULTS, productId: action.productId ?? null, uid, catalogId, wall, x: dims.span / 2, y: spec.defaultY, w: spec.size.w, h: spec.size.h, rotation: 0 }
      const item = findFreeSpot(fresh, onWall(design, wall), dims)
      const key = collectionFor(spec.opening)
      return { ...design, [key]: [...design[key], item] }
    }
    case 'addFloorItem': {
      const { uid, catalogId } = action
      if (!floorItemSpec(catalogId) || !uid || findPlaced(design, uid)) return design
      const fresh = { ...ITEM_DEFAULTS, productId: action.productId ?? null, uid, catalogId, wall: null, x: 0, z: 0, rotation: 0, scale: 1 }
      if (validSize(action.size)) fresh.size = { ...action.size }
      // A position from the placement preview is used as given (clamped); otherwise find a free spot.
      const item = Number.isFinite(action.x) && Number.isFinite(action.z)
        ? clampToRoom({ ...fresh, x: action.x, z: action.z, rotation: Number.isFinite(action.rotation) ? action.rotation : 0 }, roomSize(design))
        : findFloorSpot(fresh, design)
      return { ...design, items: [...design.items, item] }
    }
    case 'updatePlaced': {
      const found = findPlaced(design, action.uid)
      if (!found || found.item.locked) return design // locked items can't be moved by accident
      const allowed = found.item.wall ? ['x', 'y', 'w', 'h', 'rotation'] : ['x', 'z', 'rotation', 'scale']
      const changes = Object.fromEntries(
        Object.entries(action.changes || {}).filter(([k, v]) => allowed.includes(k) && Number.isFinite(v)),
      )
      if (!Object.keys(changes).length) return design
      const next = clampPlaced({ ...found.item, ...changes }, roomSize(design))
      if (allowed.every((k) => next[k] === found.item[k])) return design
      return { ...design, [found.key]: replaceAt(design[found.key], found.index, next) }
    }
    case 'duplicatePlaced': {
      const found = findPlaced(design, action.uid)
      if (!found || !action.newUid || findPlaced(design, action.newUid)) return design
      const { item } = found
      const offset = item.wall
        ? { x: item.x + DUPLICATE_OFFSET, y: item.y - DUPLICATE_OFFSET }
        : { x: item.x + DUPLICATE_OFFSET * 2, z: item.z + DUPLICATE_OFFSET * 2 }
      const copy = clampPlaced({ ...item, ...offset, uid: action.newUid, locked: false }, roomSize(design))
      return { ...design, [found.key]: [...design[found.key], copy] }
    }
    case 'removePlaced': {
      const found = findPlaced(design, action.uid)
      if (!found || found.item.locked) return design
      return { ...design, [found.key]: design[found.key].filter((i) => i.uid !== action.uid) }
    }
    case 'setProduct': {
      // The product a placed item stands for, picked by the user. The server checks it belongs to
      // this item type before pricing it; null means a generic shape with no price.
      const found = findPlaced(design, action.uid)
      const productId = action.productId ?? null
      if (!found || found.item.locked || (productId !== null && (typeof productId !== 'string' || !productId))) return design
      // A product with an unambiguous listed size sizes the 3D shape; otherwise the typical size stays.
      const size = !found.item.wall && productId && validSize(action.size) ? { ...action.size } : null
      if (found.item.productId === productId && JSON.stringify(found.item.size ?? null) === JSON.stringify(size)) return design
      const next = { ...found.item, productId }
      if (found.item.wall) return { ...design, [found.key]: replaceAt(design[found.key], found.index, next) }
      if (size) next.size = size
      else delete next.size
      return { ...design, [found.key]: replaceAt(design[found.key], found.index, clampToRoom(next, roomSize(design))) }
    }
    case 'setItemColor': {
      const found = findPlaced(design, action.uid)
      const colors = found && floorItemSpec(found.item.catalogId)?.colors
      if (!found || found.item.locked || !colors) return design
      const color = action.color ?? null
      if (color !== null && !isHexColor(color)) return design
      if ((found.item.color ?? null) === color) return design
      return { ...design, [found.key]: replaceAt(design[found.key], found.index, { ...found.item, color }) }
    }
    case 'alignToWall': {
      const found = findPlaced(design, action.uid)
      if (!found || found.item.wall || found.item.locked) return design
      const next = alignToWall(found.item, roomSize(design))
      if (next.x === found.item.x && next.z === found.item.z && next.rotation === found.item.rotation) return design
      return { ...design, [found.key]: replaceAt(design[found.key], found.index, next) }
    }
    case 'setBudget': {
      // Budget and style only steer suggestions; placed items are never touched.
      const value = Number(action.value)
      if (!Number.isFinite(value) || value < 0 || value > 100_000_000 || value === design.budget) return design
      return { ...design, budget: value }
    }
    case 'setStyle': {
      if (!STYLES.some((s) => s.id === action.style) || action.style === design.style) return design
      return { ...design, style: action.style }
    }
    case 'replaceDesign': {
      // Load, reset or recover: the new design must already be validated. Undoable like any edit.
      return action.design && action.design !== design ? action.design : design
    }
    case 'setItemFlags': {
      const found = findPlaced(design, action.uid)
      if (!found) return design
      const changes = {}
      if (action.label !== undefined) changes.label = typeof action.label === 'string' && action.label.trim() ? action.label.trim().slice(0, 80) : null
      if (typeof action.hidden === 'boolean') changes.hidden = action.hidden
      if (typeof action.locked === 'boolean') changes.locked = action.locked
      if (Object.entries(changes).every(([k, v]) => found.item[k] === v)) return design
      return { ...design, [found.key]: replaceAt(design[found.key], found.index, { ...found.item, ...changes }) }
    }
    case 'resetWall': {
      const { wall } = action
      if (!WALLS.includes(wall)) return design
      return {
        ...design,
        walls: { ...design.walls, [wall]: { ...design.walls[wall], color: PAINTS[0].color, kind: 'paint', pattern: null } },
        items: design.items.filter((i) => i.wall !== wall),
        openings: design.openings.filter((i) => i.wall !== wall),
      }
    }
    default:
      return design
  }
}
