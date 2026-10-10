import { describe, expect, it } from 'vitest'
import { FLOOR_ITEMS, L_SOFA_CHAISE, L_SOFA_SEAT } from './catalog'
import { ITEM_DEFAULTS, createDesign } from './design'
import {
  floorWarnings, footprint, footprintOutline, footprintPolygons, itemContains, itemsOverlap, localParts, settleItems,
} from './floorPlacement'

const item = (catalogId, x, z, rotation = 0, extra = {}) => ({ ...ITEM_DEFAULTS, uid: `${catalogId}-${x}-${z}`, catalogId, wall: null, x, z, rotation, scale: 1, ...extra })
const room = (items) => ({ ...createDesign({ form: { length: 20, width: 20, height: 9, style: 'scandinavian', budget: 50000 } }), items })
const bounds = (polys) => {
  const pts = polys.flat()
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
}
const shoelace = (poly) => Math.abs(poly.reduce((sum, [x, z], i) => { const [x2, z2] = poly[(i + 1) % poly.length]; return sum + (x * z2 - x2 * z) }, 0)) / 2

describe('footprint shapes', () => {
  it('most pieces are one rectangle of their width and depth', () => {
    const polys = footprintPolygons(item('bookshelf', 1, 2))
    expect(polys).toHaveLength(1)
    expect(polys[0]).toHaveLength(4)
    expect(bounds(polys)).toEqual({ x0: -0.5, x1: 2.5, z0: 1.4, z1: 2.6 })
  })

  it('the L-shaped sofa is two rectangles: the back, and the chaise on the right', () => {
    const polys = footprintPolygons(item('l-sofa', 0, 0))
    expect(polys).toHaveLength(2)
    const [back, chaise] = polys.map((p) => bounds([p]))
    expect(back.x0).toBeCloseTo(-4); expect(back.x1).toBeCloseTo(4)
    expect(back.z0).toBeCloseTo(-2.75); expect(back.z1).toBeCloseTo(0.45)
    expect(chaise.x0).toBeCloseTo(1.2); expect(chaise.x1).toBeCloseTo(4)
    expect(chaise.z0).toBeCloseTo(0.45); expect(chaise.z1).toBeCloseTo(2.75)
    expect(bounds(polys)).toMatchObject({ x0: expect.closeTo(-4), x1: expect.closeTo(4), z0: expect.closeTo(-2.75), z1: expect.closeTo(2.75) })
  })

  it('the L turns with the sofa', () => {
    const sofa = item('l-sofa', 0, 0, 90)
    const b = bounds(footprintPolygons(sofa))
    expect(b.x1 - b.x0).toBeCloseTo(5.5) // width and depth swap
    expect(b.z1 - b.z0).toBeCloseTo(8)
    // In the sofa's own frame the notch centre is (-1.4, 1.6) and a point on the back is (0, -1.5).
    // Turned 90° those land at (1.6, 1.4) and (-1.5, 0) in the room.
    expect(itemContains(sofa, [1.6, 1.4])).toBe(false)
    expect(itemContains(sofa, [-1.5, 0])).toBe(true)
    // The chaise's far corner, local (3.5, 2.5), lands at (2.5, -3.5).
    expect(itemContains(sofa, [2.4, -3.4])).toBe(true)
  })

  it('round pieces are polygons that stay inside their ellipse, not square boxes', () => {
    const [poly] = footprintPolygons(item('pouf', 0, 0))
    expect(poly.length).toBeGreaterThanOrEqual(12)
    for (const [x, z] of poly) expect(Math.hypot(x, z)).toBeLessThanOrEqual(0.8 + 1e-9)
    expect(shoelace(poly)).toBeLessThan(1.6 * 1.6 * 0.82) // about π/4 of the square
    expect(shoelace(poly)).toBeGreaterThan(1.6 * 1.6 * 0.74)
  })

  it('every shape in the catalog stays inside its width and depth box', () => {
    for (const [id, spec] of Object.entries(FLOOR_ITEMS)) {
      const b = bounds(footprintPolygons(item(id, 0, 0)))
      const { w, d } = footprint(item(id, 0, 0))
      expect(b.x0, id).toBeGreaterThanOrEqual(-w / 2 - 1e-9)
      expect(b.x1, id).toBeLessThanOrEqual(w / 2 + 1e-9)
      expect(b.z0, id).toBeGreaterThanOrEqual(-d / 2 - 1e-9)
      expect(b.z1, id).toBeLessThanOrEqual(d / 2 + 1e-9)
      expect(spec.shape === undefined || spec.shape === 'round' || Array.isArray(spec.shape.parts), id).toBe(true)
    }
  })

  it('the drawn outline and the collision parts describe the same L', () => {
    const sofa = item('l-sofa', 0, 0)
    const outline = footprintOutline(sofa)
    expect(outline).toHaveLength(6)
    const partsArea = footprintPolygons(sofa).reduce((sum, p) => sum + shoelace(p), 0)
    expect(shoelace(outline)).toBeCloseTo(partsArea, 6)
    expect(partsArea).toBeLessThan(8 * 5.5) // it is not the full rectangle
    expect(partsArea).toBeCloseTo(8 * 3.2 + 2.8 * (5.5 - 3.2), 6)
    expect(footprintOutline(item('bookshelf', 0, 0))).toHaveLength(4)
  })

  it('shares its proportions with the 3D model', () => {
    expect(L_SOFA_SEAT * 5.5).toBeCloseTo(3.2)
    expect(L_SOFA_CHAISE * 8).toBeCloseTo(2.8)
    expect(localParts('l-sofa', 8, 5.5)).toHaveLength(2)
    expect(localParts('sofa', 7, 3)).toEqual([{ cx: 0, cz: 0, w: 7, d: 3 }])
  })
})

describe('collisions use the real shape', () => {
  it('a table fits in the empty corner of an L-shaped sofa', () => {
    const sofa = item('l-sofa', 0, 0)
    const inNotch = item('coffee-table', -1.5, 1.6) // x -3.25..0.25, z 0.6..2.6: inside the notch
    expect(itemsOverlap(sofa, inNotch)).toBe(false)
    expect(floorWarnings(room([sofa, inNotch]))).toEqual([])
  })

  it('but it still collides with the chaise and the back', () => {
    const sofa = item('l-sofa', 0, 0)
    expect(itemsOverlap(sofa, item('coffee-table', 2.6, 1.6))).toBe(true) // on the chaise
    expect(itemsOverlap(sofa, item('coffee-table', -1.5, -0.5))).toBe(true) // on the back
    const warnings = floorWarnings(room([sofa, item('coffee-table', 2.6, 1.6)]))
    expect(warnings.map((w) => w.kind)).toEqual(['overlap'])
  })

  it('the notch moves with the sofa when it is turned', () => {
    // Turned 180°: back at the front, chaise on the left, notch now towards the back wall.
    const sofa = item('l-sofa', 0, 0, 180)
    expect(itemsOverlap(sofa, item('coffee-table', 1.5, -1.6))).toBe(false)
    expect(itemsOverlap(sofa, item('coffee-table', -2.6, -1.6))).toBe(true)
  })

  it('round pieces that only meet at their square corners do not collide', () => {
    const a = item('pouf', 0, 0)
    const b = item('pouf', 1.5, 1.5) // 1.5 apart on each axis: boxes overlap, circles (r 0.8) do not
    expect(itemsOverlap(a, b)).toBe(false)
    expect(floorWarnings(room([a, b]))).toEqual([])
    expect(itemsOverlap(a, item('pouf', 1.0, 0.5))).toBe(true) // genuinely touching
  })

  it('a lamp at the corner of a round table is not standing on it', () => {
    const table = item('side-table', 0, 0) // round, 1.5 across
    const onTop = settleItems([table, item('table-lamp', 0.1, 0.1)])[1]
    const offEdge = settleItems([table, item('table-lamp', 0.7, 0.7)])[1] // inside the square, outside the circle
    expect(onTop.elevation).toBeGreaterThan(0)
    expect(offEdge.elevation || 0).toBe(0)
    expect(itemContains(table, [0.7, 0.7])).toBe(false)
  })

  it('far-apart pieces are rejected quickly and never reported as overlapping', () => {
    expect(itemsOverlap(item('l-sofa', -8, -8), item('l-sofa', 8, 8))).toBe(false)
  })
})

describe('floorWarnings for one piece', () => {
  it('returns exactly the warnings that involve that piece', () => {
    const a = item('sofa', 0, 0)
    const b = item('armchair', 0.5, 0)
    const c = item('dining-table', 6, 6)
    const d = item('dining-table', 6.5, 6)
    const design = room([a, b, c, d])
    const all = floorWarnings(design)
    expect(all).toHaveLength(2)
    expect(floorWarnings(design, a.uid)).toEqual(all.filter((w) => w.ids.includes(a.uid)))
    expect(floorWarnings(design, c.uid)).toEqual(all.filter((w) => w.ids.includes(c.uid)))
    expect(floorWarnings(design, 'nobody')).toEqual([])
  })
})

describe('speed', () => {
  it('checks a crowded room of mixed shapes in well under a second', () => {
    const ids = Object.keys(FLOOR_ITEMS)
    const items = Array.from({ length: 80 }, (_, i) => item(ids[i % ids.length], ((i * 37) % 17) - 8, ((i * 53) % 17) - 8, (i * 45) % 360, { uid: `p${i}` }))
    const design = room(items)
    const start = performance.now()
    for (let n = 0; n < 5; n++) floorWarnings(design)
    expect(performance.now() - start).toBeLessThan(1500)
  })
})
