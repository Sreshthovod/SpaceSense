import { describe, expect, it } from 'vitest'
import { DEMO, SCHEMA_VERSION, createDesign, defaultView, isBehindWall, roomSize, styleLabel, wallSpecs } from './design'
import { designReducer } from './reducer'

const form = { roomType: 'Living room', length: '16', width: '12', height: '10', style: 'scandinavian', budget: '60000' }

describe('createDesign', () => {
  it('marks dimensions the user entered as measured', () => {
    const d = createDesign({ form, photoName: 'room.jpg' })
    expect(d.schemaVersion).toBe(SCHEMA_VERSION)
    expect(d.room.width).toEqual({ value: 12, source: 'measured' })
    expect(d.room.length).toEqual({ value: 16, source: 'measured' })
    expect(d.room.height).toEqual({ value: 10, source: 'measured' })
    expect(d.budget).toBe(60000)
    expect(d.style).toBe('scandinavian')
    expect(d.photo).toEqual({ name: 'room.jpg' })
    expect(d.items).toEqual([])
  })

  it('falls back to estimated demo values and the demo budget and style', () => {
    const d = createDesign({ form: { length: '', width: 'abc' } })
    expect(d.room.length).toEqual({ value: DEMO.length, source: 'estimated' })
    expect(d.room.width).toEqual({ value: DEMO.width, source: 'estimated' })
    expect(d.room.height.source).toBe('estimated')
    expect(d.budget).toBe(25000)
    expect(d.style).toBe('modern-indian')
    expect(styleLabel(d.style)).toBe('Warm & cozy (Modern Indian)')
    expect(d.photo).toBeNull()
  })

  it('round-trips through JSON unchanged', () => {
    const d = createDesign({ form })
    expect(JSON.parse(JSON.stringify(d))).toEqual(d)
  })
})

describe('wallSpecs', () => {
  const specs = Object.fromEntries(wallSpecs({ width: 12, length: 16, height: 10 }).map((s) => [s.id, s]))

  it('places each wall on the room boundary with an inward normal', () => {
    expect(specs.back.center).toEqual([0, 5, -8])
    expect(specs.front.center).toEqual([0, 5, 8])
    expect(specs.left.center).toEqual([-6, 5, 0])
    expect(specs.right.center).toEqual([6, 5, 0])
    for (const s of Object.values(specs)) {
      // The normal points from the wall towards the room centre.
      const toCentre = [-s.center[0], -s.center[2]]
      expect(toCentre[0] * s.normal[0] + toCentre[1] * s.normal[2]).toBeGreaterThan(0)
    }
  })

  it('uses width for back/front spans and length for side spans', () => {
    expect(specs.back.span).toBe(12)
    expect(specs.front.span).toBe(12)
    expect(specs.left.span).toBe(16)
    expect(specs.right.span).toBe(16)
  })

  it('rotation turns local +z into the inward normal', () => {
    for (const s of Object.values(specs)) {
      // Rotating (0,0,1) about y by θ gives (sin θ, 0, cos θ).
      expect(Math.sin(s.rotationY)).toBeCloseTo(s.normal[0])
      expect(Math.cos(s.rotationY)).toBeCloseTo(s.normal[2])
    }
  })

  it('knows when the camera is behind a wall', () => {
    const view = defaultView({ width: 12, length: 16, height: 10 })
    const hidden = Object.values(specs).filter((s) => isBehindWall(s, view.position)).map((s) => s.id).sort()
    expect(hidden).toEqual(['front', 'right'])
    expect(Object.values(specs).some((s) => isBehindWall(s, [0, 5, 0]))).toBe(false)
  })

  it('steps the default camera back on a portrait canvas', () => {
    const room = { width: 12, length: 16, height: 10 }
    const dist = (v) => Math.hypot(...v.position.map((p, i) => p - v.target[i]))
    expect(dist(defaultView(room, 0.5))).toBeCloseTo(dist(defaultView(room, 1.5)) * 2.6)
    expect(dist(defaultView(room, 2))).toBeCloseTo(dist(defaultView(room, 1.5)))
  })
})

describe('designReducer', () => {
  const base = createDesign({ form })

  it('updates and clamps dimensions, ignoring invalid values', () => {
    expect(roomSize(designReducer(base, { type: 'setDimension', key: 'width', value: 14 })).width).toBe(14)
    expect(roomSize(designReducer(base, { type: 'setDimension', key: 'width', value: 500 })).width).toBe(60)
    expect(roomSize(designReducer(base, { type: 'setDimension', key: 'height', value: 2 })).height).toBe(7)
    expect(designReducer(base, { type: 'setDimension', key: 'width', value: Number.NaN })).toBe(base)
    expect(designReducer(base, { type: 'setDimension', key: 'depth', value: 10 })).toBe(base)
    expect(designReducer(base, { type: 'setDimension', key: 'width', value: 12 })).toBe(base)
  })

  it('keeps the measured flag when resizing and lets the user change it', () => {
    const resized = designReducer(base, { type: 'setDimension', key: 'length', value: 15 })
    expect(resized.room.length.source).toBe('measured')
    const est = designReducer(base, { type: 'setDimensionSource', key: 'length', source: 'estimated' })
    expect(est.room.length).toEqual({ value: 16, source: 'estimated' })
    expect(designReducer(base, { type: 'setDimensionSource', key: 'length', source: 'guess' })).toBe(base)
  })

  it('paints one wall or all walls with valid hex colours only', () => {
    const one = designReducer(base, { type: 'setWallColor', wall: 'left', color: '#c5cdb6' })
    expect(one.walls.left.color).toBe('#c5cdb6')
    expect(one.walls.back.color).toBe(base.walls.back.color)
    const all = designReducer(base, { type: 'setWallColor', wall: 'all', color: '#5d5f5a' })
    expect(new Set(Object.values(all.walls).map((w) => w.color))).toEqual(new Set(['#5d5f5a']))
    expect(designReducer(base, { type: 'setWallColor', wall: 'all', color: 'red' })).toBe(base)
    expect(designReducer(base, { type: 'setWallColor', wall: 'ceiling', color: '#ffffff' })).toBe(base)
  })

  it('switches floor material with its colour, or sets a custom colour', () => {
    const marble = designReducer(base, { type: 'setFloor', material: 'marble' })
    expect(marble.floor).toMatchObject({ material: 'marble', color: '#ece8e1', rotation: 0, scale: 1, sheen: 'matte' })
    const custom = designReducer(marble, { type: 'setFloor', color: '#123456' })
    expect(custom.floor).toMatchObject({ material: 'marble', color: '#123456' })
    expect(designReducer(base, { type: 'setFloor', material: 'lava' })).toBe(base)
  })

  it('does not mutate the previous design', () => {
    const snapshot = JSON.stringify(base)
    designReducer(base, { type: 'setWallColor', wall: 'all', color: '#000000' })
    designReducer(base, { type: 'setDimension', key: 'width', value: 20 })
    expect(JSON.stringify(base)).toBe(snapshot)
  })
})
