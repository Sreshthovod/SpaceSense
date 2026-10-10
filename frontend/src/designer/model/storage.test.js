import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, createDesign } from './design'
import { designReducer } from './reducer'
import {
  KEYS, MAX_DESIGNS, StorageError, deleteDesign, duplicateDesign, listDesigns, loadDesign, readDraft, readLastCleared,
  renameDesign, saveDesign, saveLastCleared, writeDraft,
} from './storage'

/** A Storage-like object; `fullAfter` makes setItem throw like a full localStorage. */
function fakeStore({ fullAfter = Infinity } = {}) {
  const data = new Map()
  let writes = 0
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      if (++writes > fullAfter) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
      data.set(k, String(v))
    },
    removeItem: (k) => data.delete(k),
  }
}

const furnished = () => {
  let d = createDesign({ form: { width: '12', length: '16', height: '9' } })
  d = designReducer(d, { type: 'addFloorItem', uid: 'sofa', catalogId: 'sofa', productId: 'ikea-kivik-sofa' })
  return designReducer(d, { type: 'addWallItem', uid: 'door', wall: 'back', catalogId: 'door' })
}

describe('draft', () => {
  it('round-trips a design identically (as after a page refresh)', () => {
    const store = fakeStore()
    const d = furnished()
    writeDraft(d, { name: 'Bedroom' }, store)
    const back = readDraft(store)
    expect(back.design).toEqual(d)
    expect(back.name).toBe('Bedroom')
    expect(back.savedAt).toMatch(/^\d{4}-/)
  })

  it('reports unreadable, foreign or newer data instead of crashing', () => {
    const store = fakeStore()
    expect(readDraft(store)).toBeNull()
    store.data.set(KEYS.draft, '{oops')
    expect(readDraft(store).error).toMatch(/could not be read/)
    store.data.set(KEYS.draft, JSON.stringify({ design: { schemaVersion: SCHEMA_VERSION + 1 } }))
    expect(readDraft(store).error).toMatch(/newer version/)
    store.data.set(KEYS.draft, JSON.stringify({ design: 'nope' }))
    expect(readDraft(store).error).toBeTruthy()
  })

  it('works when storage is unavailable', () => {
    expect(readDraft(null)).toBeNull()
    expect(() => writeDraft(furnished(), {}, null)).toThrow(StorageError)
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
    expect(readDraft(throwing).error).toBeTruthy()
    expect(() => writeDraft(furnished(), {}, throwing)).toThrow(/isn't letting/)
  })

  it('keeps a design cleared by a reset', () => {
    const store = fakeStore()
    saveLastCleared(furnished(), store)
    expect(readLastCleared(store).design).toEqual(furnished())
  })
})

describe('named designs', () => {
  it('saves, lists newest first, renames, duplicates, loads and deletes', () => {
    const store = fakeStore()
    const a = saveDesign({ name: 'Living room — Warm & cozy', design: furnished() }, store)
    const b = saveDesign({ name: '  ', design: createDesign() }, store)
    expect(b.name).toBe('Untitled design')
    expect(listDesigns(store).map((e) => e.id)).toContain(a.id)

    expect(renameDesign(a.id, 'Living room — Minimal', store).name).toBe('Living room — Minimal')
    const copy = duplicateDesign(a.id, 'Living room — Modern', store)
    expect(loadDesign(copy.id, store).design).toEqual(furnished())
    expect(listDesigns(store).map((e) => e.name).sort()).toEqual(['Living room — Minimal', 'Living room — Modern', 'Untitled design'])

    // Overwriting keeps the id.
    const changed = designReducer(furnished(), { type: 'setBudget', value: 99000 })
    saveDesign({ id: a.id, name: 'Living room — Minimal', design: changed }, store)
    expect(loadDesign(a.id, store).design.budget).toBe(99000)
    expect(listDesigns(store)).toHaveLength(3)

    deleteDesign(a.id, store)
    expect(listDesigns(store).map((e) => e.id)).not.toContain(a.id)
    expect(loadDesign(a.id, store)).toBeNull()
  })

  it('validates what it loads and survives a damaged index', () => {
    const store = fakeStore()
    const { id } = saveDesign({ name: 'x', design: furnished() }, store)
    const raw = JSON.parse(store.data.get(KEYS.design(id)))
    raw.design.items.push({ uid: 'zz', catalogId: 'spaceship', wall: null })
    store.data.set(KEYS.design(id), JSON.stringify(raw))
    const loaded = loadDesign(id, store)
    expect(loaded.design.items.map((i) => i.uid)).toEqual(['sofa'])
    expect(loaded.notices.join(' ')).toMatch(/spaceship/)
    store.data.set(KEYS.index, '"not a list"')
    expect(listDesigns(store)).toEqual([])
  })

  it('explains a full storage and the saved-design limit', () => {
    expect(() => saveDesign({ name: 'x', design: furnished() }, fakeStore({ fullAfter: 0 }))).toThrow(/full/)
    const store = fakeStore()
    for (let i = 0; i < MAX_DESIGNS; i++) saveDesign({ name: `d${i}`, design: createDesign() }, store)
    expect(() => saveDesign({ name: 'one more', design: createDesign() }, store)).toThrow(/up to 30/)
  })
})
