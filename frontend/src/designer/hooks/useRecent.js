import { useCallback, useEffect, useState } from 'react'

const KEY = 'spacesense-recent-items'
const MAX = 6
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

/** The last few catalog items used, newest first, remembered in this browser. */
export default function useRecent() {
  const [recent, setRecent] = useState(read)
  const remember = useCallback((id) => {
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, MAX))
  }, [])
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(recent)) } catch { /* not remembered */ }
  }, [recent])
  return [recent, remember]
}
