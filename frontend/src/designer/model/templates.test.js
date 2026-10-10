import { describe, expect, it } from 'vitest'
import { STYLES } from '../../data/sampleData'
import { FLOOR_ITEMS, WALL_ITEMS } from './catalog'
import { createDesign } from './design'
import { floorWarnings } from './floorPlacement'
import { STYLE_PRESETS, TEMPLATE_ROOM_TYPES, buildTemplate, emptyRoom } from './templates'
import { validateDesign } from './validate'
import { wallWarnings } from './wallPlacement'

let n = 0
const uid = () => `t${++n}`
const room = (width, length, height = 9) => createDesign({ form: { width, length, height, budget: 50000, style: 'boho' } })
const SIZES = [[12, 14], [10, 10], [16, 20], [8, 9], [6, 6]]

describe('room templates', () => {
  it('has a template for every room type the form offers and a preset for every style', async () => {
    const { ROOM_TYPES } = await import('../../data/sampleData')
    expect(TEMPLATE_ROOM_TYPES).toEqual(ROOM_TYPES)
    expect(Object.keys(STYLE_PRESETS).sort()).toEqual(STYLES.map((s) => s.id).sort())
  })

  it.each(TEMPLATE_ROOM_TYPES)('%s: furnishes typical rooms with no overlaps, blocked doors or wall clashes, in every style', (type) => {
    for (const [w, l] of SIZES) {
      for (const style of STYLES) {
        const { design, placed } = buildTemplate(room(w, l), type, style.id, uid)
        expect(floorWarnings(design), `${type} ${w}x${l}`).toEqual([])
        for (const wall of ['back', 'right', 'front', 'left']) {
          const onWall = [...design.openings, ...design.items].filter((i) => i.wall === wall)
          expect(wallWarnings(onWall).filter((x) => x.kind === 'overlap')).toEqual([])
        }
        expect(design.style).toBe(style.id)
        // Templates never choose a product for the user.
        expect([...design.items, ...design.openings].every((i) => i.productId === null)).toBe(true)
        // Survives a save and reload unchanged.
        expect(validateDesign(JSON.parse(JSON.stringify(design))).design).toEqual(design)
        if (w >= 10 && l >= 10) expect(placed, `${type} ${w}x${l}`).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it('keeps the room size, budget and photo, and applies the style finishes', () => {
    const base = { ...room(12, 14), photo: { name: 'room.jpg' } }
    const { design } = buildTemplate(base, 'Living room', 'contemporary-luxury', uid)
    expect(design.room).toEqual(base.room)
    expect(design.budget).toBe(50000)
    expect(design.photo).toEqual({ name: 'room.jpg' })
    expect(design.floor).toMatchObject({ material: 'marble', sheen: 'polished' })
    expect(design.walls.back).toMatchObject({ kind: 'wallpaper', pattern: 'grasscloth' })
    expect(design.walls.left).toMatchObject({ kind: 'paint', color: '#e6e0d4' })
    expect(design.items.find((i) => i.catalogId === 'sofa').color).toBe('#5d6b7a')
  })

  it('builds a kitchen run with cabinets above the counters and a hood over the cooktop', () => {
    const { design } = buildTemplate(room(12, 14), 'Kitchen', 'scandinavian', uid)
    const ids = design.items.map((i) => i.catalogId)
    for (const id of ['fridge', 'sink-cabinet', 'stove', 'base-cabinet', 'tall-cabinet', 'kitchen-island', 'bar-stool', 'wall-cabinet', 'range-hood']) {
      expect(ids).toContain(id)
    }
    const stove = design.items.find((i) => i.catalogId === 'stove')
    const hood = design.items.find((i) => i.catalogId === 'range-hood')
    expect(hood.x).toBeCloseTo(stove.x + 6, 3) // back wall: along = x + width / 2
  })

  it('keeps the cooktop and sink in narrow kitchens', () => {
    for (const w of [8, 10]) {
      const ids = buildTemplate(room(w, 10), 'Kitchen', 'boho', uid).design.items.map((i) => i.catalogId)
      expect(ids).toContain('stove')
      expect(ids).toContain('sink-cabinet')
    }
  })

  it('leaves out what does not fit instead of overlapping', () => {
    const { design, skipped } = buildTemplate(room(6, 6), 'Bedroom', 'minimalist', uid)
    expect(skipped).toBeGreaterThan(0)
    expect(floorWarnings(design)).toEqual([])
  })

  it('an empty room keeps size, budget and style but nothing placed', () => {
    const { design: full } = buildTemplate(room(12, 14), 'Dining room', 'industrial', uid)
    const empty = emptyRoom(full)
    expect(empty.items).toEqual([])
    expect(empty.openings).toEqual([])
    expect(empty.room).toEqual(full.room)
    expect(empty.style).toBe('industrial')
  })

  it('every new catalog type has a 3D-sized spec', () => {
    for (const spec of [...Object.values(FLOOR_ITEMS), ...Object.values(WALL_ITEMS)]) {
      expect(spec.size.w).toBeGreaterThan(0)
      expect(spec.name).toBeTruthy()
    }
  })
})
