import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, createDesign } from './design'
import { designReducer } from './reducer'
import { DesignLoadError, validateDesign } from './validate'

const form = { width: '12', length: '16', height: '9', budget: '40000', style: 'scandinavian' }

const furnished = () => {
  let d = createDesign({ form })
  d = designReducer(d, { type: 'addFloorItem', uid: 'sofa1', catalogId: 'sofa', productId: 'ikea-kivik-sofa' })
  d = designReducer(d, { type: 'addWallItem', uid: 'door1', wall: 'back', catalogId: 'door' })
  d = designReducer(d, { type: 'addWallItem', uid: 'art1', wall: 'left', catalogId: 'painting' })
  return designReducer(d, { type: 'setFloor', material: 'marble' })
}

describe('validateDesign', () => {
  it('returns a valid design unchanged', () => {
    const d = furnished()
    const { design, notices } = validateDesign(JSON.parse(JSON.stringify(d)))
    expect(design).toEqual(d)
    expect(notices).toEqual([])
  })

  it('migrates a version 1 design, adding the new fields with safe defaults', () => {
    const v1 = {
      schemaVersion: 1,
      room: { width: { value: 12, source: 'measured' }, length: { value: 16, source: 'measured' }, height: { value: 9, source: 'estimated' } },
      walls: { back: { color: '#c5cdb6' }, right: { color: '#efe9df' }, front: { color: '#efe9df' }, left: { color: '#efe9df' } },
      floor: { material: 'tile', color: '#d9d4ca' },
      openings: [{ uid: 'd', catalogId: 'door', wall: 'front', x: 6, y: 3.5, w: 3, h: 7, rotation: 0 }],
      items: [{ uid: 's', catalogId: 'sofa', wall: null, x: 0, z: -6.5, rotation: 0, scale: 1 }],
      budget: 25000, style: 'modern-indian', choices: { removed: [], replaced: {} }, photo: null,
    }
    const { design } = validateDesign(v1)
    expect(design.schemaVersion).toBe(SCHEMA_VERSION)
    expect(design.walls.back).toEqual({ color: '#c5cdb6', kind: 'paint', pattern: null, sheen: 'matte' })
    expect(design.floor).toEqual({ material: 'tile', color: '#d9d4ca', rotation: 0, scale: 1, sheen: 'matte' })
    expect(design.items[0]).toMatchObject({ uid: 's', productId: null, label: null, hidden: false, locked: false })
    expect(design.openings[0]).toMatchObject({ uid: 'd', wall: 'front' })
  })

  it('repairs bad values and clamps items back into the room', () => {
    const d = furnished()
    const broken = JSON.parse(JSON.stringify(d))
    broken.room.width = { value: 900, source: 'guess' }
    broken.walls.left.color = 'red'
    broken.floor = { material: 'lava', rotation: 33, scale: 99 }
    broken.items[0].x = 1e9
    broken.items[0].label = 'x'.repeat(500)
    broken.budget = -5
    broken.style = 'gothic'
    const { design } = validateDesign(broken)
    expect(design.room.width).toEqual({ value: 60, source: 'estimated' })
    expect(design.walls.left.color).toBe('#efe9df')
    expect(design.floor).toMatchObject({ material: 'wood', rotation: 0, scale: 3 })
    expect(design.items[0].x).toBeLessThanOrEqual(30)
    expect(design.items[0].label).toHaveLength(80)
    expect(design.budget).toBe(0)
    expect(design.style).toBe('modern-indian')
  })

  it('drops unknown, invalid and duplicate items with a notice', () => {
    const d = JSON.parse(JSON.stringify(furnished()))
    d.items.push({ uid: 'z', catalogId: 'spaceship', wall: null, x: 0, z: 0 })
    d.items.push({ ...d.items[0] })
    d.items.push({ uid: 'bad id!', catalogId: 'sofa', wall: null })
    d.items.push('nonsense')
    const { design, notices } = validateDesign(d)
    expect(design.items.map((i) => i.uid)).toEqual(['sofa1', 'art1'])
    expect(notices.join(' ')).toMatch(/unknown item \(spaceship\)/)
    expect(notices.join(' ')).toMatch(/invalid id/)
  })

  it('rejects data that is not a design or is from a newer version', () => {
    for (const bad of [null, 'x', [], {}, { schemaVersion: 'two' }]) expect(() => validateDesign(bad)).toThrow(DesignLoadError)
    expect(() => validateDesign({ ...furnished(), schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/newer version/)
  })
})

describe('budget, style and product choices', () => {
  it('changing the budget or style never touches placed items', () => {
    const d = furnished()
    const changed = designReducer(designReducer(d, { type: 'setBudget', value: 5000 }), { type: 'setStyle', style: 'industrial' })
    expect(changed.items).toBe(d.items)
    expect(changed.openings).toBe(d.openings)
    expect(changed).toMatchObject({ budget: 5000, style: 'industrial' })
    expect(designReducer(d, { type: 'setStyle', style: 'gothic' })).toBe(d)
    expect(designReducer(d, { type: 'setBudget', value: -1 })).toBe(d)
  })

  it('sets or clears the product an item stands for, only when the user picks one', () => {
    const d = furnished()
    expect(d.items[0].productId).toBe('ikea-kivik-sofa')
    const generic = designReducer(d, { type: 'setProduct', uid: 'sofa1', productId: null })
    expect(generic.items[0].productId).toBeNull()
    expect(designReducer(d, { type: 'setProduct', uid: 'nope', productId: 'x' })).toBe(d)
    expect(designReducer(d, { type: 'setProduct', uid: 'sofa1', productId: 42 })).toBe(d)
    expect(designReducer(d, { type: 'addFloorItem', uid: 'p', catalogId: 'plant' }).items.at(-1).productId).toBeNull()
  })
})
