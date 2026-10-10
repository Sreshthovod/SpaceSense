import { describe, expect, it } from 'vitest'
import { FLOOR_ITEMS, WALL_ITEMS } from './catalog'
import { createDesign, roomSize } from './design'
import { floorWarnings, footprint } from './floorPlacement'
import { buildFromLayout, catalogSummary } from './aiLayout'

let n = 0
const uid = () => `u${++n}`
const base = () => createDesign({ form: { length: 14, width: 12, height: 9, style: 'scandinavian', budget: 60000 } })

const layout = (floor = [], wall = [], extra = {}) => ({ floor, wall, ...extra })

describe('catalogSummary', () => {
  it('describes every catalog piece with the facts a layout needs, and nothing else', () => {
    const c = catalogSummary()
    expect(c.floor.map((f) => f.id).sort()).toEqual(Object.keys(FLOOR_ITEMS).sort())
    expect(c.wall.map((w) => w.id).sort()).toEqual(Object.keys(WALL_ITEMS).sort())
    expect(c.floor.find((f) => f.id === 'sofa')).toEqual({ id: 'sofa', name: 'Three-seater sofa', w: 7, d: 3, h: 2.8, shape: 'rect', against_wall: true, surface: false, on_surface: false })
    expect(c.floor.find((f) => f.id === 'l-sofa').shape).toBe('l')
    expect(c.floor.find((f) => f.id === 'pouf').shape).toBe('round')
    expect(c.floor.find((f) => f.id === 'coffee-table').surface).toBe(true)
    expect(c.wall.find((w) => w.id === 'window').opening).toBe(true)
    expect(JSON.stringify(c)).not.toMatch(/price|product/i)
  })
})

describe('doors and windows', () => {
  const kinds = (design) => design.openings.map((o) => o.catalogId).sort()

  it('always adds a door and a window when the model gave neither', () => {
    const { design, addedOpenings, placed } = buildFromLayout(base(), layout([{ type: 'sofa', x: 0, z: -5.5, rotation: 0 }]), uid)
    expect(kinds(design)).toEqual(['door', 'window'])
    expect(addedOpenings).toEqual(['door', 'window'])
    expect(placed).toBe(1) // `placed` counts the model's pieces, not the defaults
    expect(floorWarnings(design)).toEqual([])
  })

  it('does that for an empty or garbage layout too', () => {
    for (const bad of [null, {}, { floor: [], wall: [] }, { floor: 'no' }]) {
      expect(kinds(buildFromLayout(base(), bad, uid).design)).toEqual(['door', 'window'])
    }
  })

  it('keeps a door the model supplied and does not add a second one', () => {
    const { design, addedOpenings } = buildFromLayout(base(), layout([], [{ type: 'door', wall: 'front', along: 3 }]), uid)
    expect(kinds(design)).toEqual(['door', 'window'])
    expect(addedOpenings).toEqual(['window'])
    expect(design.openings.find((o) => o.catalogId === 'door').wall).toBe('front')
  })

  it('keeps a window the model supplied and adds only the missing door', () => {
    const { design, addedOpenings } = buildFromLayout(base(), layout([], [{ type: 'window', wall: 'back', along: 6 }]), uid)
    expect(addedOpenings).toEqual(['door'])
    const window = design.openings.find((o) => o.catalogId === 'window')
    expect([window.wall, window.x]).toEqual(['back', 6])
  })

  it('adds nothing when the model supplied both', () => {
    const { addedOpenings, design } = buildFromLayout(base(), layout([], [
      { type: 'door', wall: 'right', along: 11 }, { type: 'window', wall: 'left', along: 7 },
    ]), uid)
    expect(addedOpenings).toEqual([])
    expect(kinds(design)).toEqual(['door', 'window'])
  })

  it('keeps furniture out of the door swing, because the door goes in first', () => {
    // The default door is on the right wall near the front corner. A sofa proposed right there must yield.
    const { design } = buildFromLayout(base(), layout([{ type: 'sofa', x: 4, z: 5.5, rotation: 180 }]), uid)
    const door = design.openings.find((o) => o.catalogId === 'door')
    expect(door).toBeTruthy()
    expect(floorWarnings(design).filter((w) => w.kind === 'door')).toEqual([])
    const sofa = design.items.find((i) => i.catalogId === 'sofa')
    if (sofa) expect(Math.hypot(sofa.x - 4, sofa.z - 5.5)).toBeGreaterThan(0) // moved clear of the swing
  })

  it('drops wall decor that would sit on top of a window', () => {
    // The default window is the middle of the left wall (7 ft along a 14 ft wall), at 5 ft up.
    const { design, leftOut } = buildFromLayout(base(), layout([], [{ type: 'painting', wall: 'left', along: 7, y: 5 }]), uid)
    expect(design.items.some((i) => i.catalogId === 'painting')).toBe(false)
    expect(leftOut).toContain('Framed painting')
  })

  it('limits a model that proposes far too many openings', () => {
    const doors = Array.from({ length: 5 }, (_, i) => ({ type: 'door', wall: ['left', 'right', 'front', 'back', 'left'][i], along: 3 + i }))
    const windows = Array.from({ length: 9 }, (_, i) => ({ type: 'window', wall: ['left', 'right', 'back', 'front'][i % 4], along: 2 + (i % 3) * 3 }))
    const { design } = buildFromLayout(base(), layout([], [...doors, ...windows]), uid)
    expect(design.openings.filter((o) => o.catalogId === 'door').length).toBeLessThanOrEqual(2)
    expect(design.openings.filter((o) => o.catalogId === 'window').length).toBeLessThanOrEqual(4)
  })

  it('still gives a tiny room a door, and skips the window when no wall is wide enough', () => {
    const tiny = createDesign({ form: { length: 4, width: 4, height: 9, style: 'scandinavian', budget: 60000 } })
    const { design, addedOpenings } = buildFromLayout(tiny, layout(), uid)
    expect(addedOpenings).toEqual(['door'])
    expect(kinds(design)).toEqual(['door'])
  })

  it('never leaves an opening outside its wall', () => {
    for (const [length, width] of [[8, 6], [20, 12], [14, 12], [30, 30], [6, 14]]) {
      const room = createDesign({ form: { length, width, height: 9, style: 'minimalist', budget: 60000 } })
      const { design } = buildFromLayout(room, layout([{ type: 'sofa', x: 0, z: 0, rotation: 0 }]), uid)
      const size = roomSize(design)
      for (const o of design.openings) {
        const span = o.wall === 'back' || o.wall === 'front' ? size.width : size.length
        expect(o.x - o.w / 2).toBeGreaterThanOrEqual(-1e-6)
        expect(o.x + o.w / 2).toBeLessThanOrEqual(span + 1e-6)
      }
      expect(floorWarnings(design)).toEqual([])
    }
  })
})

describe('buildFromLayout', () => {
  it('places valid pieces, finishes the room in the current style and keeps size, budget and style', () => {
    const current = base()
    const { design, placed, skipped } = buildFromLayout(current, layout(
      [{ type: 'sofa', x: 0, z: -5.4, rotation: 0 }, { type: 'coffee-table', x: 0, z: -2, rotation: 0 }],
      [{ type: 'window', wall: 'back', along: 6 }],
    ), uid)
    expect(placed).toBe(3)
    expect(skipped).toBe(0)
    expect(design.items.map((i) => i.catalogId).sort()).toEqual(['coffee-table', 'sofa'])
    expect(design.openings.map((i) => i.catalogId).sort()).toEqual(['door', 'window']) // the model's window, plus a door added for it
    expect(roomSize(design)).toEqual(roomSize(current))
    expect(design.budget).toBe(current.budget)
    expect(design.style).toBe('scandinavian')
    expect(design.items.every((i) => i.productId === null)).toBe(true) // the AI never picks products
    expect(floorWarnings(design)).toEqual([])
  })

  it('drops unknown pieces, bad numbers and bad walls, and names what was left out', () => {
    const { design, placed, skipped, leftOut } = buildFromLayout(base(), layout(
      [
        { type: 'spaceship', x: 0, z: 0, rotation: 0 },
        { type: 'sofa', x: 'left', z: 0, rotation: 0 },
        { type: 'sofa', x: null, z: 1, rotation: 0 },
        { type: 'armchair', x: Number.NaN, z: 1, rotation: 0 },
        { type: 'pouf', x: 0, z: 0, rotation: 0 },
      ],
      [{ type: 'painting', wall: 'ceiling', along: 3 }, { type: 'mirror', wall: 'left', along: 'x' }, { type: 'mirror', wall: 'left', along: 4 }],
    ), uid)
    expect(placed).toBe(2) // the pouf and one mirror
    expect(skipped).toBe(6)
    expect(leftOut).toContain('Three-seater sofa')
    expect(design.items.map((i) => i.catalogId).sort()).toEqual(['mirror', 'pouf'])
  })

  it('pulls pieces that are outside the room back inside it', () => {
    const { design } = buildFromLayout(base(), layout([{ type: 'bookshelf', x: 90, z: -90, rotation: 0 }]), uid)
    const size = roomSize(design)
    const [shelf] = design.items
    const { w, d } = footprint(shelf)
    expect(Math.abs(shelf.x) + w / 2).toBeLessThanOrEqual(size.width / 2 + 1e-6)
    expect(Math.abs(shelf.z) + d / 2).toBeLessThanOrEqual(size.length / 2 + 1e-6)
  })

  it('moves a piece that overlaps a bigger one to the nearest free spot instead of dropping it', () => {
    const { design, placed, moved, leftOut } = buildFromLayout(base(), layout([
      { type: 'pouf', x: 0, z: 0, rotation: 0 },
      { type: 'sofa', x: 0, z: 0, rotation: 0 },
    ]), uid)
    expect(placed).toBe(2)
    expect(moved).toBe(1)
    expect(leftOut).toEqual([])
    const sofa = design.items.find((i) => i.catalogId === 'sofa')
    const pouf = design.items.find((i) => i.catalogId === 'pouf')
    expect(sofa.x).toBe(0) // the bigger piece keeps its spot
    expect(Math.hypot(pouf.x - 0, pouf.z - 0)).toBeGreaterThan(0)
    expect(Math.hypot(pouf.x - 0, pouf.z - 0)).toBeLessThanOrEqual(3 * Math.SQRT2 + 1e-6) // only a short way
    expect(floorWarnings(design)).toEqual([])
  })

  it('drops a piece when there is nowhere within reach to move it', () => {
    const tight = createDesign({ form: { length: 8, width: 6, height: 9, style: 'scandinavian', budget: 60000 } })
    const { design, placed, moved, leftOut } = buildFromLayout(tight, layout([
      { type: 'dining-table', x: 0, z: 0, rotation: 0 },
      { type: 'dining-table', x: 0, z: 0, rotation: 0 },
    ]), uid)
    expect(placed).toBe(1)
    expect(moved).toBeLessThanOrEqual(1) // the first may shift a little to clear the door swing
    expect(leftOut).toEqual(['Dining table'])
    expect(design.items).toHaveLength(1)
    expect(floorWarnings(design)).toEqual([])
  })

  it('puts a lamp on its table even when that table had to be moved', () => {
    const { design, placed, leftOut } = buildFromLayout(base(), layout([
      { type: 'sofa', x: 0, z: -5.5, rotation: 0 },
      { type: 'armchair', x: -4.2, z: -1.5, rotation: 90 },
      { type: 'side-table', x: -5.1, z: -2.8, rotation: 90 }, // overlaps the armchair, so it gets moved
      { type: 'table-lamp', x: -5.1, z: -2.8, rotation: 0 }, // where the table was meant to be
    ]), uid)
    expect(leftOut).toEqual([])
    expect(placed).toBe(4)
    const table = design.items.find((i) => i.catalogId === 'side-table')
    const lamp = design.items.find((i) => i.catalogId === 'table-lamp')
    expect(lamp.elevation).toBeGreaterThan(0)
    expect(Math.hypot(lamp.x - table.x, lamp.z - table.z)).toBeLessThan(0.5)
    expect(floorWarnings(design)).toEqual([])
  })

  it('snaps a wall-backed piece that is almost against a wall, but not one in the middle of the room', () => {
    const size = roomSize(base())
    const nearBack = buildFromLayout(base(), layout([{ type: 'sofa', x: 0.3, z: -size.length / 2 + 2.1, rotation: 5 }]), uid).design.items[0]
    expect(nearBack.rotation).toBe(0)
    expect(nearBack.z).toBeCloseTo(-size.length / 2 + 1.5, 5) // flush: half its 3 ft depth from the wall
    const middle = buildFromLayout(base(), layout([{ type: 'sofa', x: 0, z: 0, rotation: 30 }]), uid).design.items[0]
    expect(middle.rotation % 90).toBe(0) // an odd angle is tidied to a right angle, but it stays in the middle
    expect(middle.z).toBe(0)
  })

  it('leaves out a table-top piece with no table under it, and keeps it when there is one', () => {
    expect(buildFromLayout(base(), layout([{ type: 'table-lamp', x: 0, z: 0, rotation: 0 }]), uid).placed).toBe(0)
    const withTable = buildFromLayout(base(), layout([
      { type: 'side-table', x: 2, z: 1, rotation: 0 },
      { type: 'table-lamp', x: 2, z: 1, rotation: 0 },
    ]), uid)
    expect(withTable.placed).toBe(2)
    expect(withTable.design.items.find((i) => i.catalogId === 'table-lamp').elevation).toBeGreaterThan(0)
  })

  it('tints upholstery and rugs from the style, and leaves other pieces alone', () => {
    const { design } = buildFromLayout(base(), layout([
      { type: 'sofa', x: 0, z: -5.5, rotation: 0 },
      { type: 'coffee-table', x: 0, z: -2.5, rotation: 0 },
      { type: 'rug', x: 0, z: 0, rotation: 0 },
      { type: 'bookshelf', x: -5.4, z: 1, rotation: 90 },
    ]), uid)
    const by = (id) => design.items.find((i) => i.catalogId === id)
    expect(by('sofa').color).toBeTruthy()
    expect(by('rug').color).toBeTruthy()
    expect(by('bookshelf').color).toBeNull()
  })

  it('uses a valid accent wall and ignores an invalid one', () => {
    const accented = buildFromLayout(base(), layout([], [], { accent_wall: 'back' }), uid).design
    expect(accented.walls.back.color).not.toBe(accented.walls.left.color)
    const plain = buildFromLayout(base(), layout([], [], { accent_wall: 'roof' }), uid).design
    expect(new Set(Object.values(plain.walls).map((w) => w.color)).size).toBe(1)
  })

  it('survives garbage: missing lists, wrong types, huge lists', () => {
    for (const bad of [null, undefined, 5, 'x', {}, { floor: 'no', wall: {} }, { floor: [null, 3, 'a'], wall: [[], null] }]) {
      expect(() => buildFromLayout(base(), bad, uid)).not.toThrow()
      expect(buildFromLayout(base(), bad, uid).placed).toBe(0)
    }
    const many = Array.from({ length: 500 }, (_, i) => ({ type: 'pouf', x: (i % 10) - 5, z: Math.floor(i / 10) - 5, rotation: 0 }))
    expect(buildFromLayout(base(), layout(many), uid).placed).toBeLessThanOrEqual(60)
  })

  it('never returns a design with overlapping or blocked pieces', () => {
    const rnd = (() => { let s = 7; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) })()
    const types = Object.keys(FLOOR_ITEMS)
    const floor = Array.from({ length: 50 }, () => ({ type: types[Math.floor(rnd() * types.length)], x: (rnd() - 0.5) * 20, z: (rnd() - 0.5) * 20, rotation: Math.floor(rnd() * 360) }))
    const { design } = buildFromLayout(base(), layout(floor, [{ type: 'door', wall: 'front', along: 3 }, { type: 'window', wall: 'left', along: 7 }]), uid)
    expect(floorWarnings(design)).toEqual([])
  })
})
