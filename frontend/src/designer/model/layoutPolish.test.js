import { describe, expect, it } from 'vitest'
import { floorItemSpec } from './catalog'
import { createDesign, roomSize } from './design'
import { floorWarnings } from './floorPlacement'
import { buildFromLayout } from './aiLayout'
import { polishFloorEntries } from './layoutPolish'

const SIZE = { width: 12, length: 14, height: 9 }
const e = (id, x, z, rotation = 0) => ({ id, x, z, rotation })
const polish = (entries, size = SIZE) => polishFloorEntries(entries, size)
const byId = (r, id) => r.entries.filter((x) => x.id === id)
let n = 0
const uid = () => `u${++n}`
const base = () => createDesign({ form: { length: 14, width: 12, height: 9, style: 'scandinavian', budget: 60000 } })
const place = (floor) => buildFromLayout(base(), { floor, wall: [] }, uid)

describe('angles', () => {
  it('snaps odd angles to right angles and leaves round pieces unturned', () => {
    const r = polish([e('sofa', 0, -5, 7), e('bookshelf', -5, 0, 95), e('wardrobe', 5, 0, 268), e('pouf', 1, 1, 33), e('plant', 4, 4, 200)])
    expect(r.entries.map((x) => x.rotation)).toEqual([0, 90, 270, 0, 0])
  })

  it('never changes the input entries', () => {
    const input = [e('sofa', 0, -5, 7)]
    polish(input)
    expect(input[0].rotation).toBe(7)
  })
})

describe('seats face what they belong to', () => {
  it('dining chairs face the table from every side', () => {
    const r = polish([e('dining-table', 0, 0), e('dining-chair', 0, -2.4, 180), e('dining-chair', 0, 2.4, 0), e('dining-chair', -3.6, 0, 0), e('dining-chair', 3.6, 0, 0)])
    const chairs = byId(r, 'dining-chair').map((c) => [c.x, c.z, c.rotation])
    expect(chairs).toEqual([[0, -2.4, 0], [0, 2.4, 180], [-3.6, 0, 90], [3.6, 0, 270]]) // all turned towards the middle
  })

  it('a desk chair faces its desk, an armchair faces the coffee table, a stool faces the island', () => {
    const r = polish([
      e('study-desk', 0, -6), e('desk-chair', 0, -4.5, 0),
      e('coffee-table', 0, 0), e('armchair', -4, 0, 0),
      e('kitchen-island', 4, 5), e('bar-stool', 4, 3.4, 0),
    ], { width: 14, length: 16, height: 9 })
    expect(byId(r, 'desk-chair')[0].rotation).toBe(180) // desk is behind it (towards -z)
    expect(byId(r, 'armchair')[0].rotation).toBe(90) // table is to its right (+x)
    expect(byId(r, 'bar-stool')[0].rotation).toBe(0) // island is in front (+z)
  })

  it('leaves a seat alone when there is nothing to face', () => {
    expect(polish([e('dining-chair', 0, 0, 90)]).entries[0].rotation).toBe(90)
    expect(polish([e('armchair', 0, 0, 180)]).entries[0].rotation).toBe(180)
  })

  it('a floating sofa faces the coffee table; one at a wall is left for the wall to turn', () => {
    const wide = { width: 20, length: 20, height: 9 } // far enough from every wall to count as floating
    const floating = polish([e('sofa', 0, 0, 0), e('coffee-table', 0, -3, 0)], wide)
    expect(byId(floating, 'sofa')[0].rotation).toBe(180) // table is behind it
    const atWall = polish([e('sofa', 0, -5.4, 0), e('coffee-table', 0, -2.5, 0)])
    expect(byId(atWall, 'sofa')[0].rotation).toBe(0)
  })

  it('a bedside table turns the way its bed does', () => {
    const r = polish([e('bed', 0, -3.5, 0), e('bedside-table', -3.4, -6.3, 90), e('bedside-table', 3.4, -6.3, 270)])
    expect(byId(r, 'bedside-table').map((t) => t.rotation)).toEqual([0, 0])
  })
})

describe('rugs', () => {
  const rugOf = (r) => r.entries.find((x) => x.id === 'rug')

  it('is moved under the coffee table group and sized to cover it', () => {
    const r = polish([e('sofa', 0, -5.5), e('coffee-table', 0, -2), e('armchair', -4, -2, 90), e('rug', 4, 5, 33)])
    const rug = rugOf(r)
    expect(r.dropped).toEqual([])
    expect(Math.abs(rug.x)).toBeLessThan(2)
    expect(rug.z).toBeLessThan(-1) // centred on the seating, not where the model put it
    expect([0, 90]).toContain(rug.rotation)
    expect(rug.scale).toBeGreaterThanOrEqual(0.6)
    expect(rug.scale).toBeLessThanOrEqual(1.7)
  })

  it('sticks out from the foot of a bed, not the headboard', () => {
    const rug = rugOf(polish([e('bed', 0, -3.5, 0), e('rug', 0, 6, 0)]))
    expect(rug.z).toBeGreaterThan(-3.5) // the foot of a bed facing +z
  })

  it('goes under the dining table', () => {
    const rug = rugOf(polish([e('dining-table', 0, 0), e('rug', 5, 5)]))
    expect([rug.x, rug.z]).toEqual([0, 0])
  })

  it('is removed when there is nothing for it to sit under, and only one is kept', () => {
    const none = polish([e('plant', 3, 3), e('rug', 0, 0)])
    expect(none.entries.map((x) => x.id)).toEqual(['plant'])
    expect(none.dropped).toEqual(['Area rug'])
    const two = polish([e('coffee-table', 0, 0), e('rug', 0, 0), e('rug', 2, 2)])
    expect(two.entries.filter((x) => x.id === 'rug')).toHaveLength(1)
    expect(two.dropped).toEqual(['Area rug'])
  })
})

describe('through the whole pipeline', () => {
  it('a dining set the model turned the wrong way ends up facing the table', () => {
    const { design } = place([
      { type: 'dining-table', x: 0, z: 0, rotation: 0 },
      { type: 'dining-chair', x: 0, z: -2.4, rotation: 180 },
      { type: 'dining-chair', x: 0, z: 2.4, rotation: 0 },
    ])
    const chairs = design.items.filter((i) => i.catalogId === 'dining-chair').sort((a, b) => a.z - b.z)
    expect(chairs.map((c) => c.rotation)).toEqual([0, 180])
    expect(floorWarnings(design)).toEqual([])
  })

  it('the rug ends up under the group and not floating alone', () => {
    const { design, leftOut } = place([
      { type: 'sofa', x: 0, z: -5.5, rotation: 0 },
      { type: 'coffee-table', x: 0, z: -2.5, rotation: 0 },
      { type: 'rug', x: 4.5, z: 5, rotation: 12 },
    ])
    const rug = design.items.find((i) => i.catalogId === 'rug')
    const table = design.items.find((i) => i.catalogId === 'coffee-table')
    expect(rug).toBeTruthy()
    expect(Math.hypot(rug.x - table.x, rug.z - table.z)).toBeLessThan(2.5)
    expect(leftOut).toEqual([])
    expect(floorSpec(rug)).toBeTruthy()
  })

  it('a rug with nothing to sit under is left out and reported', () => {
    const { design, leftOut } = place([{ type: 'plant', x: 3, z: 3, rotation: 0 }, { type: 'rug', x: 0, z: 0, rotation: 0 }])
    expect(design.items.map((i) => i.catalogId)).toEqual(['plant'])
    expect(leftOut).toContain('Area rug')
  })

  it('leaves walkway between big pieces that the model packed shoulder to shoulder', () => {
    const { design } = place([
      { type: 'l-sofa', x: 1.5, z: -4.3, rotation: 0 },
      { type: 'armchair', x: -2.9, z: -3.0, rotation: 90 }, // touching the sofa's end
      { type: 'bookshelf', x: 5.4, z: 2, rotation: 270 },
    ])
    const sofa = design.items.find((i) => i.catalogId === 'l-sofa')
    const chair = design.items.find((i) => i.catalogId === 'armchair')
    expect(floorWarnings(design)).toEqual([])
    expect(Math.hypot(sofa.x - chair.x, sofa.z - chair.z)).toBeGreaterThan(4.5)
  })

  it('still places tight pieces when there is simply no room for the walkway', () => {
    const tight = createDesign({ form: { length: 8, width: 7, height: 9, style: 'minimalist', budget: 60000 } })
    const { design } = buildFromLayout(tight, { wall: [], floor: [
      { type: 'sofa', x: 0, z: -3, rotation: 0 }, { type: 'armchair', x: -2.4, z: 1.5, rotation: 90 }, { type: 'coffee-table', x: 0, z: 0, rotation: 0 },
    ] }, uid)
    expect(design.items.length).toBeGreaterThanOrEqual(2)
    expect(floorWarnings(design)).toEqual([])
    expect(roomSize(design).width).toBe(7)
  })

  it('chairs and stools may sit close to their table', () => {
    const { design } = place([
      { type: 'dining-table', x: 0, z: 0, rotation: 0 },
      { type: 'dining-chair', x: 0, z: -2.45, rotation: 0 }, // 0.1 ft from the table's edge
    ])
    expect(design.items.filter((i) => i.catalogId === 'dining-chair')).toHaveLength(1)
    const chair = design.items.find((i) => i.catalogId === 'dining-chair')
    expect(Math.abs(chair.z)).toBeLessThan(3.2) // tucked in: at most a small step, not a full walkway away
  })
})

const floorSpec = (i) => floorItemSpec(i.catalogId)
