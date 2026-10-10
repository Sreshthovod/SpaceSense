import { describe, expect, it } from 'vitest'
import { createDesign, roomSize } from './design'
import { designReducer } from './reducer'
import {
  clampToRoom, corners, doorSwing, findFloorSpot, floorHalfExtents, floorWarnings, itemCorners, polygonsOverlap,
  snapFloor, snapRotationStep,
} from './floorPlacement'
import { wallSpecs } from './design'

const size = { width: 12, length: 16, height: 9 }
const sofa = (extra = {}) => ({ uid: 's', catalogId: 'sofa', wall: null, x: 0, z: 0, rotation: 0, scale: 1, ...extra })

describe('footprints', () => {
  it('rotates corners the way three.js rotates about y', () => {
    // Rotating +90° turns local +x (width) towards -z.
    const c = corners(0, 0, 2, 1, 90).map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100])
    expect(c).toContainEqual([-0.5, 1])
    expect(c).toContainEqual([0.5, -1])
  })

  it('swaps the half extents when turned 90°', () => {
    expect(floorHalfExtents(sofa())).toEqual({ hx: 3.5, hz: 1.5 })
    const turned = floorHalfExtents(sofa({ rotation: 90 }))
    expect(turned.hx).toBeCloseTo(1.5)
    expect(turned.hz).toBeCloseTo(3.5)
  })

  it('detects overlap but not edges that only touch', () => {
    const a = corners(0, 0, 2, 2, 0)
    expect(polygonsOverlap(a, corners(1.5, 0, 2, 2, 0))).toBe(true)
    expect(polygonsOverlap(a, corners(2, 0, 2, 2, 0))).toBe(false)
    expect(polygonsOverlap(a, corners(2.2, 0, 2, 2, 45))).toBe(true) // a rotated corner pokes in
  })
})

describe('clampToRoom', () => {
  it('keeps furniture inside the walls, including when rotated', () => {
    expect(clampToRoom(sofa({ x: 100, z: -100 }), size)).toMatchObject({ x: 2.5, z: -6.5 })
    expect(clampToRoom(sofa({ x: 100, rotation: 90 }), size).x).toBeCloseTo(4.5)
  })

  it('normalises rotation and limits scaling to resizable items', () => {
    expect(clampToRoom(sofa({ rotation: -15, scale: 3 }), size)).toMatchObject({ rotation: 345, scale: 1 })
    expect(clampToRoom({ ...sofa(), catalogId: 'rug', scale: 9 }, size).scale).toBe(2)
    expect(snapRotationStep(98)).toBe(105)
  })

  it('centres an item bigger than the room', () => {
    expect(clampToRoom(sofa({ x: 3 }), { width: 5, length: 16 }).x).toBe(0)
  })
})

describe('snapFloor', () => {
  it('pulls an item flush against a nearby wall', () => {
    expect(snapFloor(sofa({ x: 0.1, z: -6.2 }), [], size)).toEqual({ x: 0, z: -6.5 })
  })

  it('aligns to other furniture edges, otherwise the grid', () => {
    const table = { uid: 't', catalogId: 'coffee-table', wall: null, x: 4, z: 2, rotation: 0, scale: 1 } // left edge 2.25
    const chair = { ...sofa(), catalogId: 'armchair', x: 1.05, z: 1.1 } // right edge 2.35
    expect(snapFloor(chair, [table], size).x).toBe(0.95)
    expect(snapFloor(sofa({ x: 0.6, z: 1.1 }), [], size)).toEqual({ x: 0.5, z: 1 })
  })
})

describe('floorWarnings', () => {
  const base = () => createDesign({ form: { width: '12', length: '16', height: '9' } })

  it('flags overlapping furniture but lets rugs sit underneath', () => {
    const d = { ...base(), items: [sofa(), sofa({ uid: 's2', x: 2 }), { ...sofa({ uid: 'r' }), catalogId: 'rug' }] }
    const w = floorWarnings(d)
    expect(w).toHaveLength(1)
    expect(w[0]).toMatchObject({ kind: 'overlap', ids: ['s', 's2'] })
  })

  it('flags furniture in a door swing and furniture hitting wall décor', () => {
    let d = base()
    d = designReducer(d, { type: 'addWallItem', uid: 'door', wall: 'back', catalogId: 'door' })
    d = designReducer(d, { type: 'addWallItem', uid: 'shelf', wall: 'left', catalogId: 'shelf' })
    const door = d.openings[0]
    const inSwing = sofa({ uid: 'a', catalogId: 'armchair', x: door.x - 6, z: -6.5 })
    const underShelf = { uid: 'w', catalogId: 'wardrobe', wall: null, x: -5, z: 0, rotation: 90, scale: 1 }
    const lowChair = { uid: 'p', catalogId: 'pouf', wall: null, x: -5.2, z: 0, rotation: 0, scale: 1 }
    d = { ...d, items: [...d.items, inSwing, underShelf] }
    const kinds = floorWarnings(d).map((w) => [w.kind, w.ids[0]])
    expect(kinds).toContainEqual(['door', 'a'])
    expect(kinds).toContainEqual(['clash', 'w'])
    // A pouf is lower than the shelf, so it fits under it.
    const ok = { ...d, items: d.items.filter((i) => i.uid !== 'w').concat(lowChair) }
    expect(floorWarnings(ok).map((w) => w.ids[0])).not.toContain('p')
  })

  it('door swing is a door-wide square in front of the door', () => {
    const spec = { ...wallSpecs(size)[0], span: 12 }
    const swing = doorSwing({ x: 6, w: 3 }, spec)
    expect(swing).toEqual([[-1.5, -8], [1.5, -8], [1.5, -5], [-1.5, -5]])
  })
})

describe('furniture in the reducer', () => {
  const form = { width: '12', length: '16', height: '9' }

  it('puts a sofa against the back wall and keeps new pieces apart', () => {
    let d = createDesign({ form })
    d = designReducer(d, { type: 'addFloorItem', uid: 'a', catalogId: 'sofa' })
    expect(d.items[0]).toMatchObject({ x: 0, z: -6.5, rotation: 0, wall: null })
    d = designReducer(d, { type: 'addFloorItem', uid: 'b', catalogId: 'sofa' })
    d = designReducer(d, { type: 'addFloorItem', uid: 'c', catalogId: 'coffee-table' })
    d = designReducer(d, { type: 'addFloorItem', uid: 'r', catalogId: 'rug' })
    expect(floorWarnings(d)).toEqual([])
    expect(d.items.find((i) => i.uid === 'r')).toMatchObject({ x: 0, z: 0 })
  })

  it('keeps door swings clear when placing', () => {
    let d = createDesign({ form })
    d = designReducer(d, { type: 'addWallItem', uid: 'door', wall: 'back', catalogId: 'door' })
    d = designReducer(d, { type: 'addFloorItem', uid: 'a', catalogId: 'sofa' })
    expect(floorWarnings(d)).toEqual([])
    expect(polygonsOverlap(itemCorners(d.items[0]), doorSwing(d.openings[0], { ...wallSpecs(roomSize(d))[0] }))).toBe(false)
  })

  it('moves, rotates, rescales, duplicates and clamps on room resize', () => {
    let d = designReducer(createDesign({ form }), { type: 'addFloorItem', uid: 'p', catalogId: 'plant' })
    d = designReducer(d, { type: 'updatePlaced', uid: 'p', changes: { x: 50, z: 1, rotation: 30, scale: 1.2, y: 9 } })
    expect(d.items[0]).toMatchObject({ z: 1, rotation: 30, scale: 1.2 })
    // Pushed against the right wall: 6 ft minus half the rotated footprint (1.8 ft square at 30°).
    expect(d.items[0].x).toBeCloseTo(6 - (1.8 * (Math.cos(Math.PI / 6) + Math.sin(Math.PI / 6))) / 2, 2)
    expect(d.items[0].y).toBeUndefined()
    d = designReducer(d, { type: 'duplicatePlaced', uid: 'p', newUid: 'p2' })
    expect(d.items[1]).toMatchObject({ uid: 'p2', z: 2 })
    d = designReducer(d, { type: 'setDimension', key: 'width', value: 6 })
    for (const item of d.items) expect(Math.abs(item.x) + floorHalfExtents(item).hx).toBeLessThanOrEqual(3 + 1e-6)
    expect(designReducer(d, { type: 'addFloorItem', uid: 'z', catalogId: 'painting' })).toBe(d)
  })

  it('findFloorSpot avoids an occupied centre', () => {
    const d = { ...createDesign({ form }), items: [{ uid: 't', catalogId: 'coffee-table', wall: null, x: 0, z: 0, rotation: 0, scale: 1 }] }
    const spot = findFloorSpot({ uid: 'u', catalogId: 'pouf', wall: null, x: 0, z: 0, rotation: 0, scale: 1 }, d)
    expect(polygonsOverlap(itemCorners(spot), itemCorners(d.items[0]))).toBe(false)
  })
})
