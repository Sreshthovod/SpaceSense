import { describe, expect, it } from 'vitest'
import { createDesign } from './design'
import { designReducer } from './reducer'
import { validateDesign } from './validate'
import { emptyRoom } from './templates'
import { bearingOfVector, roseRotation, vastuReport, wallDirections, zoneOf } from './compass'

const SIZE = { width: 12, length: 14, height: 9 }
let n = 0
const item = (catalogId, x, z, rotation = 0) => ({
  uid: `i${++n}`, catalogId, wall: null, x, z, rotation, scale: 1, color: null, productId: null, label: null, hidden: false, locked: false,
})
const room = (facing, items = [], openings = []) => ({ ...createDesign({ form: { width: 12, length: 14, height: 9 } }), facing, items, openings })

describe('room direction', () => {
  it('names the compass side of every wall', () => {
    expect(wallDirections('north')).toEqual({ back: 'north', right: 'east', front: 'south', left: 'west' })
    expect(wallDirections('east')).toEqual({ back: 'east', right: 'south', front: 'west', left: 'north' })
    expect(wallDirections('north-east')).toEqual({ back: 'north-east', right: 'south-east', front: 'south-west', left: 'north-west' })
    expect(wallDirections(null)).toBeNull()
  })

  it('gives the compass bearing of a direction in the room', () => {
    expect(bearingOfVector('north', 0, -1)).toBe(0) // towards the back wall
    expect(bearingOfVector('north', 1, 0)).toBe(90) // towards the right wall
    expect(bearingOfVector('north', 0, 1)).toBe(180)
    expect(bearingOfVector('east', 0, -1)).toBe(90)
    expect(bearingOfVector('west', -1, 0)).toBe(180)
  })

  it('turns the compass rose so N points to real north on screen', () => {
    // Looking at the back wall of a north-facing room: north is straight ahead, so the rose is not turned.
    expect(Math.abs(roseRotation('north', 0, -1))).toBe(0)
    // Looking at the right (east) wall: north is on the left of the screen.
    expect(roseRotation('north', 1, 0)).toBe(-90)
    // A room whose back wall faces south, seen from the default view: north is behind the camera.
    expect(Math.abs(roseRotation('south', 0, -1))).toBe(180)
  })

  it('finds the compass zone of a spot, also in rooms turned diagonally', () => {
    expect(zoneOf('north', SIZE, 5, -6)).toBe('north-east') // back-right corner
    expect(zoneOf('south', SIZE, 5, -6)).toBe('south-west')
    expect(zoneOf('north', SIZE, 0, 0)).toBe('centre')
    expect(zoneOf('north', SIZE, -5, 0)).toBe('west')
    expect(zoneOf('north-east', SIZE, 0, -6.5)).toBe('north-east') // the middle of the back wall
  })

  it('comes from the brief, is stored, survives templates and a reload, and can be undone', () => {
    expect(createDesign({ form: { entryDirection: 'south-west' } }).facing).toBe('south-west')
    expect(createDesign({ form: { entryDirection: 'up' } }).facing).toBeNull()
    const d = designReducer(createDesign({}), { type: 'setFacing', facing: 'west' })
    expect(d.facing).toBe('west')
    expect(designReducer(d, { type: 'setFacing', facing: 'west' })).toBe(d) // no-op is not a change
    expect(designReducer(d, { type: 'setFacing', facing: 'sideways' }).facing).toBeNull()
    expect(emptyRoom(d).facing).toBe('west')
    expect(validateDesign(JSON.parse(JSON.stringify(d))).design.facing).toBe('west')
    expect(validateDesign({ ...JSON.parse(JSON.stringify(d)), facing: 42 }).design.facing).toBeNull()
  })
})

describe('Vastu check', () => {
  const byId = (report, id) => report.checks.find((c) => c.id === id)

  it('needs the room direction', () => {
    expect(vastuReport(room(null, [item('sofa', 0, 5.5, 180)]), 'Living room', SIZE)).toBeNull()
  })

  it('living room: heavy pieces south and west, north-east clear, TV south-east, seats facing north or east', () => {
    const sofa = item('sofa', 0, 5.4, 180) // against the front (south) wall, facing north
    const tv = item('tv-unit', 4, 5.6, 180) // front-right = south-east
    const good = vastuReport(room('north', [sofa, tv]), 'Living room', SIZE)
    expect(good.checks.filter((c) => c.status !== 'na').map((c) => [c.id, c.status])).toEqual([['heavy-sw', 'ok'], ['ne-clear', 'ok'], ['tv-se', 'ok'], ['seat-face', 'ok']])
    expect(good).toMatchObject({ followed: 4, total: 4 })

    const shelf = item('bookshelf', 4.5, -6.3) // tall, in the back-right = north-east corner
    const bad = vastuReport(room('north', [sofa, shelf]), 'Living room', SIZE)
    expect(byId(bad, 'heavy-sw')).toMatchObject({ status: 'warn', uids: [shelf.uid] })
    expect(byId(bad, 'ne-clear')).toMatchObject({ status: 'warn', uids: [shelf.uid] })
    expect(byId(bad, 'tv-se').status).toBe('na') // no TV: nothing to judge
  })

  it('the same layout judged in a room facing the other way', () => {
    const sofa = item('sofa', 0, 5.4, 180)
    const r = vastuReport(room('south', [sofa]), 'Living room', SIZE)
    expect(byId(r, 'heavy-sw').status).toBe('warn') // the front wall is now north
    expect(byId(r, 'seat-face').status).toBe('warn') // and the sofa faces south
  })

  it('bedroom: bed in the south-west with the headboard south, feet not at the door', () => {
    const bed = item('bed', -2.5, 3.5, 180) // front-left = south-west; headboard towards the front (south)
    const r = vastuReport(room('north', [bed]), 'Bedroom', SIZE)
    expect(byId(r, 'bed-sw').status).toBe('ok')
    expect(byId(r, 'bed-head').status).toBe('ok')
    expect(byId(r, 'bed-door').status).toBe('ok')

    const door = { uid: 'd1', catalogId: 'door', wall: 'back', x: 3.5, y: 3.4, w: 3, h: 6.8 } // straight ahead of the bed's foot
    const atDoor = vastuReport(room('north', [bed], [door]), 'Bedroom', SIZE)
    expect(byId(atDoor, 'bed-door')).toMatchObject({ status: 'warn', uids: [bed.uid] })

    const wrongWay = item('bed', -2.5, -3.5, 0) // headboard to the back (north) wall
    expect(byId(vastuReport(room('north', [wrongWay]), 'Bedroom', SIZE), 'bed-head').status).toBe('warn')
  })

  it('kitchen: stove south-east, sink north-east and apart from each other', () => {
    const stove = item('stove', 4.5, 5.9, 180)
    const sink = item('sink-cabinet', 4.5, -5.9, 0)
    const r = vastuReport(room('north', [stove, sink]), 'Kitchen', SIZE)
    expect(['stove-se', 'sink-ne', 'stove-sink'].map((id) => byId(r, id).status)).toEqual(['ok', 'ok', 'ok'])
    const close = vastuReport(room('north', [stove, item('sink-cabinet', 1.7, 5.9, 180)]), 'Kitchen', SIZE)
    expect(byId(close, 'stove-sink').status).toBe('warn')
    expect(byId(close, 'sink-ne').status).toBe('warn')
  })

  it('home office: you face north or east while working at the desk', () => {
    const desk = item('study-desk', -4.8, 0, 90) // against the left (west) wall, its front facing east: you face west
    expect(byId(vastuReport(room('north', [desk]), 'Home office', SIZE), 'desk-face').status).toBe('warn')
    const turned = item('study-desk', 0, -6.2, 0) // against the back (north) wall: you face north
    expect(byId(vastuReport(room('north', [turned]), 'Home office', SIZE), 'desk-face').status).toBe('ok')
  })

  it('hidden pieces are ignored and an empty room has nothing to judge', () => {
    const r = vastuReport(room('north', [{ ...item('bookshelf', 4.5, -6.3), hidden: true }]), 'Living room', SIZE)
    expect(r.total).toBe(0)
  })

  it('a pooja unit belongs in the north-east and does not count as clutter there', () => {
    const pooja = item('pooja-unit', 4.7, -6.2) // back-right = north-east when the back wall faces north
    const r = vastuReport(room('north', [pooja]), 'Living room', SIZE)
    expect(byId(r, 'pooja-ne').status).toBe('ok')
    expect(byId(r, 'ne-clear').status).toBe('ok')
    expect(byId(vastuReport(room('south', [pooja]), 'Living room', SIZE), 'pooja-ne').status).toBe('warn')
  })

  it('each check reports what fraction of its pieces pass', () => {
    const good = item('wardrobe', -5, 3, 90) // west wall
    const bad = item('bookshelf', 4.6, -6.3)
    const r = vastuReport(room('north', [good, bad]), 'Living room', SIZE)
    expect(byId(r, 'heavy-sw').fraction).toBe(0.5)
  })
})
