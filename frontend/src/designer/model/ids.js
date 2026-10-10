let counter = 0

/** A unique id for a placed item. */
export function newUid() {
  counter += 1
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now().toString(36)}-${counter}`
}
