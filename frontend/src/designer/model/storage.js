/**
 * Designs are kept in this browser's localStorage (the backend has no database). Nothing here
 * leaves the device.
 *
 *   spacesense-draft            the session being edited, autosaved
 *   spacesense-designs          index of named designs: [{ id, name, savedAt }]
 *   spacesense-design:<id>      one named design
 *   spacesense-last-cleared     the design that was there before a reset or "start fresh"
 *
 * Every read is validated (and migrated) before use; every access is guarded, because storage can be
 * disabled, full or hold anything.
 */
import { DesignLoadError, validateDesign } from './validate'

export const KEYS = {
  draft: 'spacesense-draft',
  index: 'spacesense-designs',
  design: (id) => `spacesense-design:${id}`,
  lastCleared: 'spacesense-last-cleared',
}
export const MAX_DESIGNS = 30

export class StorageError extends Error {}

const defaultStore = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // access itself can throw when storage is blocked
  }
}

function readJSON(store, key) {
  try {
    const raw = store?.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return undefined // unreadable or blocked
  }
}

function writeJSON(store, key, value) {
  if (!store) throw new StorageError("This browser isn't letting SpaceSense save designs (storage is turned off).")
  try {
    store.setItem(key, JSON.stringify(value))
  } catch (err) {
    const full = err?.name === 'QuotaExceededError' || err?.code === 22
    throw new StorageError(full
      ? "Your browser's storage for this site is full. Delete a saved design and try again."
      : "This browser isn't letting SpaceSense save designs right now.")
  }
}

/** A stored { design, ... } record, validated. Returns null if absent, { error } if unusable. */
function readRecord(store, key) {
  const raw = readJSON(store, key)
  if (raw === null) return null
  if (raw === undefined || typeof raw !== 'object') return { error: 'The saved design could not be read.' }
  try {
    const { design, notices } = validateDesign(raw.design)
    return { ...raw, design, notices }
  } catch (err) {
    return { error: err instanceof DesignLoadError ? err.message : 'The saved design could not be read.' }
  }
}

export const now = () => new Date().toISOString()

// --- draft -------------------------------------------------------------------------------------

export const readDraft = (store = defaultStore()) => readRecord(store, KEYS.draft)

export function writeDraft(design, meta = {}, store = defaultStore()) {
  writeJSON(store, KEYS.draft, { savedAt: now(), designId: meta.designId ?? null, name: meta.name ?? null, design })
}

export function clearDraft(store = defaultStore()) {
  try { store?.removeItem(KEYS.draft) } catch { /* nothing to clear */ }
}

// --- reset / start-fresh safety net ----------------------------------------------------------------

export function saveLastCleared(design, store = defaultStore()) {
  writeJSON(store, KEYS.lastCleared, { savedAt: now(), design })
}

export const readLastCleared = (store = defaultStore()) => readRecord(store, KEYS.lastCleared)

// --- named designs -----------------------------------------------------------------------------------

export function listDesigns(store = defaultStore()) {
  const index = readJSON(store, KEYS.index)
  if (!Array.isArray(index)) return []
  return index
    .filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string')
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const cleanName = (name) => (String(name || '').trim() || 'Untitled design').slice(0, 60)

/** Saves (or overwrites, when `id` is given) a named design. Returns its index entry. */
export function saveDesign({ id, name, design }, store = defaultStore()) {
  const index = listDesigns(store)
  if (!id && index.length >= MAX_DESIGNS) throw new StorageError(`You can keep up to ${MAX_DESIGNS} saved designs. Delete one first.`)
  const entry = { id: id || newId(), name: cleanName(name), savedAt: now() }
  writeJSON(store, KEYS.design(entry.id), { design })
  writeJSON(store, KEYS.index, [entry, ...index.filter((e) => e.id !== entry.id)])
  return entry
}

export const loadDesign = (id, store = defaultStore()) => readRecord(store, KEYS.design(id))

export function renameDesign(id, name, store = defaultStore()) {
  const index = listDesigns(store)
  if (!index.some((e) => e.id === id)) return null
  const next = index.map((e) => (e.id === id ? { ...e, name: cleanName(name) } : e))
  writeJSON(store, KEYS.index, next)
  return next.find((e) => e.id === id)
}

export function duplicateDesign(id, name, store = defaultStore()) {
  const record = loadDesign(id, store)
  if (!record || record.error) throw new StorageError('That saved design could not be read, so it was not copied.')
  return saveDesign({ name, design: record.design }, store)
}

export function deleteDesign(id, store = defaultStore()) {
  writeJSON(store, KEYS.index, listDesigns(store).filter((e) => e.id !== id))
  try { store?.removeItem(KEYS.design(id)) } catch { /* index already updated */ }
}
