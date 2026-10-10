import { describe, expect, it } from 'vitest'
import { FLOOR_ITEMS, WALL_ITEMS } from './catalog'
import { lowestPrice, searchCatalog } from './catalogSearch'
import { createDesign, roomSize, wallDims } from './design'
import { floorRoughness, textureRepeat } from './finishes'
import {
  alignToWall, floorHalfExtents, floorWarnings, footprint, parseListedSize, settleItems, surfaceElevation,
} from './floorPlacement'
import { ghostAt } from './placement'
import { designReducer } from './reducer'
import { validateDesign } from './validate'
import { bounds } from './wallPlacement'

const form = { width: '12', length: '16', height: '9' }
const fresh = () => createDesign({ form })
const run = (d, actions) => actions.reduce((x, a) => designReducer(x, a), d)
const size = { width: 12, length: 16, height: 9 }

describe('product sizes', () => {
  it('uses only unambiguous W × D × H listed sizes', () => {
    expect(parseListedSize('78x50x190 cm')).toEqual({ w: 2.56, d: 1.64, h: 6.23 })
    expect(parseListedSize('120 x 40 x 38 cm')).toEqual({ w: 3.94, d: 1.31, h: 1.25 })
    for (const s of ['90x55 cm', '17 cm', '63-74 cm', '', null, '78x50x190 mm']) expect(parseListedSize(s)).toBeNull()
  })

  it('a product size resizes the shape; clearing the product restores the typical size', () => {
    let d = run(fresh(), [{ type: 'addFloorItem', uid: 'w', catalogId: 'wardrobe' }])
    d = designReducer(d, { type: 'setProduct', uid: 'w', productId: 'ikea-brimnes-wardrobe', size: parseListedSize('78x50x190 cm') })
    expect(footprint(d.items[0])).toMatchObject({ w: 2.56, d: 1.64, h: 6.23 })
    d = designReducer(d, { type: 'setProduct', uid: 'w', productId: null })
    expect(d.items[0].size).toBeUndefined()
    expect(footprint(d.items[0]).h).toBe(FLOOR_ITEMS.wardrobe.size.h)
    expect(designReducer(d, { type: 'setProduct', uid: 'w', productId: 'x', size: { w: 900, d: 1, h: 1 } }).items[0].size).toBeUndefined()
  })
})

describe('surfaces', () => {
  it('small items stand on a table under them and fall to the floor when it moves away', () => {
    let d = run(fresh(), [
      { type: 'addFloorItem', uid: 't', catalogId: 'coffee-table', x: 0, z: 0 },
      { type: 'addFloorItem', uid: 'lamp', catalogId: 'table-lamp', x: 0.5, z: 0.2 },
    ])
    const lamp = () => d.items.find((i) => i.uid === 'lamp')
    expect(lamp().elevation).toBe(FLOOR_ITEMS['coffee-table'].size.h)
    expect(floorWarnings(d)).toEqual([]) // standing on the table isn't an overlap
    d = designReducer(d, { type: 'updatePlaced', uid: 't', changes: { x: -4 } })
    expect(lamp().elevation).toBe(0)
    expect(surfaceElevation({ ...lamp(), catalogId: 'sofa' }, d.items)).toBe(0) // only small items climb
  })

  it('adding a small item puts it on a free table top', () => {
    const d = run(fresh(), [
      { type: 'addFloorItem', uid: 'b', catalogId: 'bedside-table', x: 4, z: -6 },
      { type: 'addFloorItem', uid: 'v', catalogId: 'vase' },
    ])
    const vase = d.items.find((i) => i.uid === 'v')
    expect([vase.x, vase.z]).toEqual([4, -6])
    expect(vase.elevation).toBe(FLOOR_ITEMS['bedside-table'].size.h)
  })

  it('heights decide clashes: a shelf above a low chest is fine, a wardrobe is not', () => {
    let d = run(fresh(), [{ type: 'addWallItem', uid: 'shelf', wall: 'back', catalogId: 'shelf' }])
    const shelf = d.items[0]
    d = run(d, [{ type: 'addFloorItem', uid: 'c', catalogId: 'dresser', x: shelf.x - 6, z: -7.2 }])
    expect(floorWarnings(d).filter((w) => w.kind === 'clash')).toEqual([])
    d = run(d, [{ type: 'addFloorItem', uid: 'w', catalogId: 'wardrobe', x: shelf.x - 6 + 3, z: -7 }])
    expect(floorWarnings(d).some((w) => w.kind === 'clash' && w.ids.includes('w'))).toBe(true)
  })

  it('settleItems keeps unchanged items identical', () => {
    const d = run(fresh(), [{ type: 'addFloorItem', uid: 's', catalogId: 'sofa' }])
    expect(settleItems(d.items)).toBe(d.items)
  })
})

describe('align to wall and placement preview', () => {
  it('turns a piece to face the room from its nearest wall, flush against it', () => {
    const base = { uid: 'a', catalogId: 'sofa', wall: null, rotation: 33, scale: 1 }
    expect(alignToWall({ ...base, x: 0, z: -6 }, size)).toMatchObject({ rotation: 0, z: -6.5 })
    expect(alignToWall({ ...base, x: 0, z: 7 }, size)).toMatchObject({ rotation: 180, z: 6.5 })
    expect(alignToWall({ ...base, x: -5, z: 0 }, size)).toMatchObject({ rotation: 90, x: -4.5 })
    expect(alignToWall({ ...base, x: 5.5, z: 0 }, size)).toMatchObject({ rotation: 270, x: 4.5 })
  })

  it('the preview is red exactly where a drop would be flagged', () => {
    const d = run(fresh(), [{ type: 'addFloorItem', uid: 't', catalogId: 'dining-table', x: 0, z: 0 }])
    const onTable = ghostAt(d, size, 'armchair', 0, 0, false)
    expect(onTable.valid).toBe(false)
    const clear = ghostAt(d, size, 'armchair', 4, 5, false)
    expect(clear.valid).toBe(true)
    // Dropping where the preview said "fits" gives no warning for the new piece.
    const placed = designReducer(d, { type: 'addFloorItem', uid: 'n', catalogId: 'armchair', x: clear.item.x, z: clear.item.z })
    expect(floorWarnings(placed).filter((w) => w.ids.includes('n'))).toEqual([])
  })

  it('wall pieces dropped near a wall turn to face the room', () => {
    const { item } = ghostAt(fresh(), size, 'bed', 1, 7.4, true)
    expect(item.rotation).toBe(180)
    expect(item.z).toBeCloseTo(8 - FLOOR_ITEMS.bed.size.d / 2)
  })
})

describe('catalog search', () => {
  const catalog = { types: { sofa: { products: [{ name: 'KIVIK 3-seat sofa', price_inr: 50990 }, { name: 'GLOSTAD', price_inr: 12990 }] }, 'coffee-table': { products: [{ name: 'LACK Coffee table', price_inr: 3490 }] } } }

  it('matches names, categories and product names, ignoring case', () => {
    expect(searchCatalog({ query: 'SOFA' })).toContain('sofa')
    expect(searchCatalog({ query: 'kivik', catalog })).toEqual(['sofa'])
    expect(searchCatalog({ query: 'lamps' })).toEqual(['floor-lamp', 'table-lamp'])
    expect(searchCatalog({ category: 'beds' })).toEqual(['bed', 'bunk-bed'])
    expect(searchCatalog({ query: 'zzz' })).toEqual([])
  })

  it('sorts by verified price with unpriced items last', () => {
    expect(lowestPrice(catalog, 'sofa')).toBe(12990)
    const asc = searchCatalog({ sort: 'price-asc', catalog })
    expect(asc.slice(0, 2)).toEqual(['coffee-table', 'sofa'])
    const desc = searchCatalog({ sort: 'price-desc', catalog })
    expect(desc.slice(0, 2)).toEqual(['sofa', 'coffee-table'])
  })
})

describe('finishes', () => {
  it('keeps one texture tile the same real-world size in any room', () => {
    for (const span of [6, 12, 30]) expect(span / textureRepeat(span, 4)).toBeCloseTo(4)
    expect(12 / textureRepeat(12, 4, 2)).toBeCloseTo(8)
    expect(textureRepeat(0, 4)).toBeGreaterThan(0)
  })

  it('keeps floor roughness plausible for every finish', () => {
    expect(floorRoughness(0.25, 'polished')).toBeGreaterThanOrEqual(0.12)
    expect(floorRoughness(0.9, 'matte')).toBeLessThanOrEqual(1)
  })

  it('applies paint, wallpaper and sheen to one wall or all, ignoring invalid choices', () => {
    let d = fresh()
    d = designReducer(d, { type: 'setWallFinish', wall: 'left', kind: 'wallpaper', pattern: 'geometric', color: '#c98b6b' })
    expect(d.walls.left).toMatchObject({ kind: 'wallpaper', pattern: 'geometric', color: '#c98b6b' })
    expect(d.walls.back.kind).toBe('paint')
    d = designReducer(d, { type: 'setWallFinish', wall: 'all', kind: 'paint', sheen: 'satin' })
    expect(Object.values(d.walls).every((w) => w.kind === 'paint' && w.pattern === null && w.sheen === 'satin')).toBe(true)
    for (const bad of [{ pattern: 'tartan' }, { sheen: 'gloss' }, { color: 'blue' }, { kind: 'tiles' }]) {
      expect(designReducer(d, { type: 'setWallFinish', wall: 'all', ...bad })).toBe(d)
    }
  })

  it('sets floor material, rotation, pattern size and finish within limits', () => {
    let d = designReducer(fresh(), { type: 'setFloor', material: 'dark-wood', rotation: 45, scale: 9, sheen: 'polished' })
    expect(d.floor).toMatchObject({ material: 'dark-wood', rotation: 45, scale: 2, sheen: 'polished' })
    expect(designReducer(d, { type: 'setFloor', rotation: 30 })).toBe(d)
    expect(designReducer(d, { type: 'setFloor', sheen: 'wet' })).toBe(d)
    d = designReducer(d, { type: 'setFloor', material: 'stone' })
    expect(d.floor).toMatchObject({ material: 'stone', rotation: 45, sheen: 'polished' })
  })
})

describe('colours, flags and validation', () => {
  it('colours only items that offer colours', () => {
    let d = run(fresh(), [{ type: 'addFloorItem', uid: 's', catalogId: 'sofa' }, { type: 'addFloorItem', uid: 't', catalogId: 'coffee-table' }])
    d = designReducer(d, { type: 'setItemColor', uid: 's', color: '#5d6b7a' })
    expect(d.items[0].color).toBe('#5d6b7a')
    expect(designReducer(d, { type: 'setItemColor', uid: 't', color: '#5d6b7a' })).toBe(d)
    expect(designReducer(d, { type: 'setItemColor', uid: 's', color: 'red' })).toBe(d)
  })

  it('round-trips the new fields through validation', () => {
    let d = run(fresh(), [
      { type: 'addFloorItem', uid: 't', catalogId: 'coffee-table', x: 0, z: 0 },
      { type: 'addFloorItem', uid: 'l', catalogId: 'table-lamp', x: 0, z: 0 },
      { type: 'addFloorItem', uid: 'w', catalogId: 'wardrobe', productId: 'ikea-brimnes-wardrobe', size: { w: 2.56, d: 1.64, h: 6.23 } },
      { type: 'setWallFinish', wall: 'back', kind: 'wallpaper', pattern: 'linen' },
      { type: 'setFloor', material: 'tile', rotation: 90, scale: 1.5, sheen: 'satin' },
    ])
    const { design } = validateDesign(JSON.parse(JSON.stringify(d)))
    expect(design).toEqual(d)
  })
})

describe('fuzz: 1,000 random edits never leave anything outside the room', () => {
  it('holds for floor and wall items', () => {
    let seed = 42
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    const floorTypes = Object.keys(FLOOR_ITEMS)
    const wallTypes = Object.keys(WALL_ITEMS)
    const walls = ['back', 'right', 'front', 'left']
    let d = fresh()
    let n = 0
    for (let i = 0; i < 1000; i++) {
      const uids = [...d.items, ...d.openings].map((x) => x.uid)
      const pick = uids[Math.floor(rnd() * uids.length)]
      const r = rnd()
      let action
      if (r < 0.15 || !pick) action = { type: 'addFloorItem', uid: `f${n++}`, catalogId: floorTypes[Math.floor(rnd() * floorTypes.length)], ...(rnd() < 0.5 ? { x: rnd() * 80 - 40, z: rnd() * 80 - 40 } : {}) }
      else if (r < 0.25) action = { type: 'addWallItem', uid: `w${n++}`, wall: walls[Math.floor(rnd() * 4)], catalogId: wallTypes[Math.floor(rnd() * wallTypes.length)] }
      else if (r < 0.7) action = { type: 'updatePlaced', uid: pick, changes: { x: rnd() * 100 - 50, z: rnd() * 100 - 50, y: rnd() * 30 - 5, w: rnd() * 20, h: rnd() * 20, rotation: rnd() * 720 - 360, scale: rnd() * 3 } }
      else if (r < 0.8) action = { type: 'alignToWall', uid: pick }
      else if (r < 0.88) action = { type: 'setDimension', key: ['width', 'length', 'height'][Math.floor(rnd() * 3)], value: 4 + rnd() * 30 }
      else if (r < 0.94) action = { type: 'duplicatePlaced', uid: pick, newUid: `d${n++}` }
      else action = { type: 'removePlaced', uid: pick }
      d = designReducer(d, action)
      const room = roomSize(d)
      for (const item of d.items.filter((x) => !x.wall)) {
        const { hx, hz } = floorHalfExtents(item)
        if (hx * 2 <= room.width) expect(Math.abs(item.x) + hx).toBeLessThanOrEqual(room.width / 2 + 1e-6)
        if (hz * 2 <= room.length) expect(Math.abs(item.z) + hz).toBeLessThanOrEqual(room.length / 2 + 1e-6)
        expect(item.elevation || 0).toBeGreaterThanOrEqual(0)
      }
      for (const item of [...d.items, ...d.openings].filter((x) => x.wall)) {
        const b = bounds(item)
        const dims = wallDims(room, item.wall)
        const why = JSON.stringify({ i, action: action.type, item, b, dims })
        expect(b.left, why).toBeGreaterThanOrEqual(-1e-6)
        expect(b.right, why).toBeLessThanOrEqual(dims.span + 1e-6)
        expect(b.bottom, why).toBeGreaterThanOrEqual(-1e-6)
        expect(b.top, why).toBeLessThanOrEqual(dims.height + 1e-6)
      }
    }
    expect(n).toBeGreaterThan(100)
  })
})
