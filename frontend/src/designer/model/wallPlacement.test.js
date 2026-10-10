import { describe, expect, it } from 'vitest'
import { createDesign, onWall, roomSize, wallDims } from './design'
import { designReducer } from './reducer'
import {
  bounds, clampToWall, clientToWall, findFreeSpot, formatFeet, halfExtents, measurements, snapPosition, snapRotation,
  wallWarnings,
} from './wallPlacement'

const wall = { span: 12, height: 9 }
const painting = (extra = {}) => ({ uid: 'p', catalogId: 'painting', wall: 'back', x: 6, y: 5, w: 2, h: 1.5, rotation: 0, ...extra })

describe('bounds and measurements', () => {
  it('measures distances to every edge of the wall', () => {
    expect(bounds(painting())).toEqual({ left: 5, right: 7, bottom: 4.25, top: 5.75 })
    expect(measurements(painting(), wall)).toEqual({ fromLeft: 5, fromRight: 5, fromFloor: 4.25, fromCeiling: 3.25, width: 2, height: 1.5 })
  })

  it('uses the rotated footprint', () => {
    const { hw, hh } = halfExtents({ w: 2, h: 1, rotation: 90 })
    expect(hw).toBeCloseTo(0.5)
    expect(hh).toBeCloseTo(1)
  })

  it('formats feet and inches', () => {
    expect(formatFeet(4.5)).toBe('4′ 6″')
    expect(formatFeet(3)).toBe('3′')
    expect(formatFeet(0.26)).toBe('0′ 3″')
  })
})

describe('clampToWall', () => {
  it('keeps the item fully inside the wall', () => {
    expect(clampToWall(painting({ x: -3, y: 20 }), wall)).toMatchObject({ x: 1, y: 8.25 })
    expect(clampToWall(painting({ x: 30, y: -1 }), wall)).toMatchObject({ x: 11, y: 0.75 })
  })

  it('applies catalog size limits and locks doors to the floor', () => {
    expect(clampToWall(painting({ w: 50, h: 0.1 }), wall)).toMatchObject({ w: 6, h: 0.75 })
    const door = clampToWall({ uid: 'd', catalogId: 'door', x: 3, y: 6, w: 3, h: 7, rotation: 0 }, wall)
    expect(door.y).toBe(3.5)
  })

  it('keeps a mirror round when the wall is too small, and stops non-rotatable items rotating', () => {
    const mirror = clampToWall({ uid: 'm', catalogId: 'mirror', x: 1, y: 1, w: 4, h: 4, rotation: 30 }, { span: 2, height: 9 })
    expect(mirror.w).toBe(mirror.h)
    expect(mirror.w).toBe(2)
    expect(mirror.rotation).toBe(0)
  })

  it('normalises rotation for rotatable items', () => {
    expect(clampToWall(painting({ rotation: -90 }), wall).rotation).toBe(270)
    expect(snapRotation(22)).toBe(15)
    expect(snapRotation(-5)).toBe(0)
    expect(snapRotation(-8)).toBe(345)
  })
})

describe('snapPosition', () => {
  it('snaps edges to a nearby item and reports a guide', () => {
    const other = painting({ uid: 'o', x: 2, y: 5 }) // right edge at 3
    const moved = painting({ x: 4.1, y: 5.05 }) // left edge at 3.1
    const s = snapPosition(moved, [other], wall)
    expect(s.x).toBe(4)
    expect(s.guides).toContainEqual({ axis: 'x', at: 3 })
  })

  it('snaps to the wall centre and otherwise to the 3-inch grid', () => {
    expect(snapPosition(painting({ x: 6.1, y: 2.13 }), [], wall)).toMatchObject({ x: 6, y: 2.25 })
  })
})

describe('wallWarnings', () => {
  it('flags overlaps and cramped spacing, not well-spaced items', () => {
    const a = painting({ uid: 'a', x: 2 })
    expect(wallWarnings([a, painting({ uid: 'b', x: 3 })])[0]).toMatchObject({ kind: 'overlap', ids: ['a', 'b'] })
    expect(wallWarnings([a, painting({ uid: 'c', x: 4.1 })])[0]).toMatchObject({ kind: 'tight' })
    expect(wallWarnings([a, painting({ uid: 'd', x: 6 })])).toEqual([])
  })
})

describe('findFreeSpot', () => {
  it('prefers the centre, then the nearest spot with a 3-inch gap', () => {
    const first = findFreeSpot(painting(), [], wall)
    expect(first.x).toBe(6)
    const second = findFreeSpot(painting({ uid: 'q' }), [first], wall)
    expect(wallWarnings([first, second])).toEqual([])
  })
})

describe('clientToWall', () => {
  it('maps screen pixels to wall feet for a letterboxed SVG', () => {
    // viewBox 10 × 5 drawn into 400 × 400 px: 40 px per foot, 100 px of letterbox top and bottom.
    const rect = { left: 0, top: 0, width: 400, height: 400 }
    expect(clientToWall(rect, [0, 0, 10, 5], 200, 300, 5)).toEqual({ x: 5, y: 0 })
    expect(clientToWall(rect, [0, 0, 10, 5], 0, 100, 5)).toEqual({ x: 0, y: 5 })
  })
})

describe('wall actions in the reducer', () => {
  const form = { width: '12', length: '16', height: '9' }
  const add = (d, uid, catalogId, wallId = 'back') => designReducer(d, { type: 'addWallItem', uid, wall: wallId, catalogId })

  it('adds décor to items and doors/windows to openings, without overlaps', () => {
    let d = createDesign({ form })
    d = add(d, 'a', 'painting')
    d = add(d, 'b', 'mirror')
    d = add(d, 'c', 'door')
    expect(d.items.map((i) => i.uid)).toEqual(['a', 'b'])
    expect(d.openings.map((i) => i.uid)).toEqual(['c'])
    expect(wallWarnings(onWall(d, 'back')).filter((w) => w.kind === 'overlap')).toEqual([])
  })

  it('ignores unknown items, walls and duplicate ids', () => {
    const d = add(createDesign({ form }), 'a', 'painting')
    expect(add(d, 'x', 'sofa')).toBe(d)
    expect(add(d, 'x', 'painting', 'ceiling')).toBe(d)
    expect(add(d, 'a', 'mirror')).toBe(d)
  })

  it('moves within bounds, duplicates, removes and resets a wall', () => {
    let d = add(add(createDesign({ form }), 'a', 'painting'), 'w', 'window', 'left')
    d = designReducer(d, { type: 'updatePlaced', uid: 'a', changes: { x: 100, y: 2, w: Number.NaN } })
    expect(d.items[0]).toMatchObject({ x: 11, y: 2, w: 2 })
    d = designReducer(d, { type: 'duplicatePlaced', uid: 'a', newUid: 'a2' })
    expect(d.items.find((i) => i.uid === 'a2')).toMatchObject({ x: 11, y: 1.5 })
    d = designReducer(d, { type: 'removePlaced', uid: 'a' })
    expect(d.items.map((i) => i.uid)).toEqual(['a2'])
    d = designReducer(d, { type: 'setWallColor', wall: 'back', color: '#5d5f5a' })
    d = designReducer(d, { type: 'resetWall', wall: 'back' })
    expect(onWall(d, 'back')).toEqual([])
    expect(d.walls.back.color).toBe('#efe9df')
    expect(onWall(d, 'left')).toHaveLength(1)
  })

  it('pulls wall items back inside when the room shrinks', () => {
    let d = add(createDesign({ form }), 'a', 'panel')
    d = designReducer(d, { type: 'updatePlaced', uid: 'a', changes: { x: 10 } })
    d = designReducer(d, { type: 'setDimension', key: 'width', value: 5 })
    d = designReducer(d, { type: 'setDimension', key: 'height', value: 7 })
    const dims = wallDims(roomSize(d), 'back')
    const b = bounds(d.items[0])
    expect(b.left).toBeGreaterThanOrEqual(0)
    expect(b.right).toBeLessThanOrEqual(dims.span)
    expect(b.top).toBeLessThanOrEqual(dims.height)
  })
})
