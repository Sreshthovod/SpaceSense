/** Where a new piece would land during placement, and whether it fits there. Pure. */
import { floorItemSpec } from './catalog'
import { alignToWall, clampToRoom, floorHalfExtents, floorWarnings, snapFloor, surfaceElevation } from './floorPlacement'

export const GHOST = '__placing__'

/**
 * Where a new piece would go if dropped at (x, z): clamped to the room, snapped when snapping is on,
 * turned to face the room when it's a wall piece near a wall, and raised onto a table if it's small.
 */
export function ghostAt(design, size, catalogId, x, z, snap, extra = {}) {
  const spec = floorItemSpec(catalogId)
  let item = clampToRoom({ uid: GHOST, catalogId, wall: null, x, z, rotation: 0, scale: 1, ...extra }, size)
  const others = design.items.filter((i) => !i.wall && !i.hidden)
  if (snap) {
    const snapped = snapFloor(item, others, size)
    item = clampToRoom({ ...item, x: snapped.x, z: snapped.z }, size)
  }
  if (spec.againstWall) {
    // Distance from the piece's nearest edge (not its centre) to the nearest wall.
    const { hx, hz } = floorHalfExtents(item)
    const near = Math.min(item.z - hz + size.length / 2, size.length / 2 - item.z - hz, item.x - hx + size.width / 2, size.width / 2 - item.x - hx)
    if (near < 2.5) item = alignToWall(item, size)
  }
  const elevation = surfaceElevation(item, others)
  if (elevation) item = { ...item, elevation }
  const valid = !floorWarnings({ ...design, items: [...design.items, item] }).some((w) => w.ids.includes(GHOST))
  return { item, valid }
}
