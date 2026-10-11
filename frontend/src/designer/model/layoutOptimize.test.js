import { describe, expect, it } from 'vitest'
import { createDesign } from './design'
import { designReducer } from './reducer'
import { floorWarnings } from './floorPlacement'
import { buildTemplate, TEMPLATE_ROOM_TYPES } from './templates'
import { scoreLayout } from './layoutScore'
import { improveLayout } from './layoutOptimize'

let n = 0
const uid = () => `u${++n}`
const base = (facing = null) => ({ ...createDesign({ form: { width: 12, length: 14, height: 9, style: 'scandinavian', budget: 60000 } }), facing })
const add = (d, catalogId, x, z, rotation = 0, extra = {}) => {
  const id = uid()
  const next = designReducer(d, { type: 'addFloorItem', uid: id, catalogId, x, z, rotation })
  return extra.locked ? designReducer(next, { type: 'setItemFlags', uid: id, locked: true }) : next
}
const withDoor = (d) => designReducer(d, { type: 'addWallItem', uid: uid(), catalogId: 'door', wall: 'right', x: 11.5 })

function messyLivingRoom(facing) {
  let d = withDoor(base(facing))
  d = add(d, 'sofa', -0.5, -1.5, 90) // floating in the middle, turned sideways
  d = add(d, 'coffee-table', 3, 4.5) // far from the sofa
  d = add(d, 'tv-unit', -4.6, 5, 0) // near a wall but facing the wrong way
  d = add(d, 'armchair', 4.2, -5.2, 180)
  d = add(d, 'bookshelf', 4.6, -6.2, 0) // tall, in the back-right corner
  d = add(d, 'floor-lamp', 0.5, 2)
  return d
}

describe('layout score', () => {
  it('scores 0–100 with a named breakdown, and a tidy layout beats a messy one', () => {
    const messy = scoreLayout(messyLivingRoom(), { roomType: 'Living room' })
    expect(messy.total).toBeGreaterThanOrEqual(0)
    expect(messy.total).toBeLessThanOrEqual(100)
    expect(messy.terms.map((t) => t.id)).toEqual(expect.arrayContaining(['walls', 'facing', 'spacing', 'circulation', 'balance']))
    expect(messy.terms.find((t) => t.id === 'walls').score).toBeLessThan(1)
    const { design: tidy } = buildTemplate(base(), 'Living room', 'scandinavian', uid)
    expect(scoreLayout(tidy, { roomType: 'Living room' }).total).toBeGreaterThan(messy.total)
  })

  it('adds the Vastu term only in Vastu mode with a room direction', () => {
    const d = messyLivingRoom('north')
    expect(scoreLayout(d, { roomType: 'Living room' }).terms.some((t) => t.id === 'vastu')).toBe(false)
    expect(scoreLayout(d, { roomType: 'Living room', vastu: true }).terms.some((t) => t.id === 'vastu')).toBe(true)
    expect(scoreLayout(messyLivingRoom(null), { roomType: 'Living room', vastu: true }).terms.some((t) => t.id === 'vastu')).toBe(false)
  })
})

describe('layout optimiser', () => {
  it('raises the score of a messy room a lot without ever breaking a placement rule', () => {
    const messy = messyLivingRoom()
    const { design, before, after, moves } = improveLayout(messy, { roomType: 'Living room', budgetMs: Infinity })
    expect(after.total).toBeGreaterThan(before.total + 10)
    expect(moves).toBeGreaterThan(0)
    expect(floorWarnings(design)).toEqual([])
    expect(design.items).toHaveLength(messy.items.length)
    // The coffee table ends up in front of the sofa, a comfortable 1–2 ft from it, and centred on it.
    expect(after.terms.find((t) => t.id === 'spacing').score).toBeGreaterThan(0.9)
    const sofa = design.items.find((i) => i.catalogId === 'sofa')
    const table = design.items.find((i) => i.catalogId === 'coffee-table')
    const r = (sofa.rotation * Math.PI) / 180
    const ahead = (table.x - sofa.x) * Math.sin(r) + (table.z - sofa.z) * Math.cos(r)
    expect(ahead).toBeGreaterThan(2.5)
    expect(ahead).toBeLessThan(5)
  })

  it('is deterministic and never moves a locked piece', () => {
    let d = messyLivingRoom()
    const locked = d.items.find((i) => i.catalogId === 'bookshelf')
    d = designReducer(d, { type: 'setItemFlags', uid: locked.uid, locked: true })
    const a = improveLayout(d, { roomType: 'Living room', budgetMs: Infinity })
    const b = improveLayout(d, { roomType: 'Living room', budgetMs: Infinity })
    expect(a.design).toEqual(b.design)
    const after = a.design.items.find((i) => i.uid === locked.uid)
    expect([after.x, after.z, after.rotation]).toEqual([locked.x, locked.z, locked.rotation])
  })

  it('in Vastu mode moves pieces towards the Vastu zones', () => {
    let d = withDoor(base('north'))
    d = add(d, 'bed', 3, -3.5, 0) // headboard north, in the north-east half
    d = add(d, 'wardrobe', 4, 6.3, 180)
    const opts = { roomType: 'Bedroom', vastu: true, budgetMs: Infinity }
    const { before, after, design } = improveLayout(d, opts)
    const vastuOf = (s) => s.terms.find((t) => t.id === 'vastu').score
    expect(vastuOf(after)).toBeGreaterThan(vastuOf(before))
    expect(floorWarnings(design)).toEqual([])
  })

  it('carries a lamp along with the table it stands on', () => {
    let d = withDoor(base())
    d = add(d, 'sofa', 0, -5.4, 0)
    d = add(d, 'side-table', 4.5, 4.5)
    d = add(d, 'table-lamp', 4.5, 4.5)
    const { design } = improveLayout(d, { roomType: 'Living room', budgetMs: Infinity })
    const table = design.items.find((i) => i.catalogId === 'side-table')
    const lamp = design.items.find((i) => i.catalogId === 'table-lamp')
    expect(lamp.elevation).toBeGreaterThan(0)
    expect(Math.hypot(lamp.x - table.x, lamp.z - table.z)).toBeLessThan(0.8)
    expect(floorWarnings(design)).toEqual([])
  })

  it.each(TEMPLATE_ROOM_TYPES)('%s template: never worse and always valid after optimising', (type) => {
    for (const [w, l] of [[12, 14], [10, 10], [16, 20]]) {
      const start = { ...base('north'), room: createDesign({ form: { width: w, length: l, height: 9 } }).room }
      const { design } = buildTemplate(start, type, 'boho', uid)
      for (const vastu of [false, true]) {
        const r = improveLayout(design, { roomType: type, vastu, budgetMs: 400 })
        expect(r.after.total).toBeGreaterThanOrEqual(r.before.total)
        expect(floorWarnings(r.design)).toEqual([])
      }
    }
  })
})
