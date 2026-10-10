const KEY = 'spacesense-looks'
const MAX = 8

export function encodeLook({ form, compareStyle, mood, lighting }) {
  const payload = { form, compareStyle: compareStyle || '', mood, lighting }
  return btoa(encodeURIComponent(JSON.stringify(payload)))
}

export function decodeLook(token) {
  try {
    return JSON.parse(decodeURIComponent(atob(token)))
  } catch {
    return null
  }
}

export function lookUrl(look) {
  const url = new URL(window.location.href)
  url.searchParams.set('look', encodeLook(look))
  url.hash = 'studio'
  return url.toString()
}

export function loadLooks() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLook(look) {
  const entry = {
    id: crypto.randomUUID?.() || String(Date.now()),
    savedAt: Date.now(),
    title: `${look.form.roomType || 'Room'} · ${look.form.style || 'style'}`,
    ...look,
  }
  const next = [entry, ...loadLooks().filter((item) => item.title !== entry.title)].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function lookFromSearch() {
  const token = new URLSearchParams(window.location.search).get('look')
  return token ? decodeLook(token) : null
}
