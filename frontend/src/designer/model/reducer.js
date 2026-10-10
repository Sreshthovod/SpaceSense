import {
  DIMENSIONS, FLOOR_MATERIALS, PAINTS, WALLS, clampDimension, collectionFor, findPlaced, isHexColor, onWall, roomSize,
  wallDims,
} from './design'
import { floorItemSpec, wallItemSpec } from './catalog'
import { clampToRoom, findFloorSpot } from './floorPlacement'
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

/** Every design edit goes through here, so undo/redo can wrap it later. Invalid actions are ignored. */
export function designReducer(design, action) {
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
      return { ...design, floor: { material, color } }
    }
    case 'addWallItem': {
      const { uid, wall, catalogId } = action
      const spec = wallItemSpec(catalogId)
      if (!spec || !WALLS.includes(wall) || !uid || findPlaced(design, uid)) return design
      const dims = wallDims(roomSize(design), wall)
      const fresh = { uid, catalogId, wall, x: dims.span / 2, y: spec.defaultY, w: spec.size.w, h: spec.size.h, rotation: 0 }
      const item = findFreeSpot(fresh, onWall(design, wall), dims)
      const key = collectionFor(spec.opening)
      return { ...design, [key]: [...design[key], item] }
    }
    case 'addFloorItem': {
      const { uid, catalogId } = action
      if (!floorItemSpec(catalogId) || !uid || findPlaced(design, uid)) return design
      const item = findFloorSpot({ uid, catalogId, wall: null, x: 0, z: 0, rotation: 0, scale: 1 }, design)
      return { ...design, items: [...design.items, item] }
    }
    case 'updatePlaced': {
      const found = findPlaced(design, action.uid)
      if (!found) return design
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
      const copy = clampPlaced({ ...item, ...offset, uid: action.newUid }, roomSize(design))
      return { ...design, [found.key]: [...design[found.key], copy] }
    }
    case 'removePlaced': {
      const found = findPlaced(design, action.uid)
      if (!found) return design
      return { ...design, [found.key]: design[found.key].filter((i) => i.uid !== action.uid) }
    }
    case 'resetWall': {
      const { wall } = action
      if (!WALLS.includes(wall)) return design
      return {
        ...design,
        walls: { ...design.walls, [wall]: { ...design.walls[wall], color: PAINTS[0].color } },
        items: design.items.filter((i) => i.wall !== wall),
        openings: design.openings.filter((i) => i.wall !== wall),
      }
    }
    default:
      return design
  }
}
