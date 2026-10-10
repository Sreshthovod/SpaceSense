import { useState } from 'react'

const KEY = 'spacesense-scroll-gesture'
const read = () => {
  try {
    const v = localStorage.getItem(KEY)
    return ['auto', 'zoom', 'pan'].includes(v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** What a two-finger scroll / wheel does: 'auto', 'zoom' or 'pan'. Remembered in this browser. */
export default function useGestureSetting() {
  const [gesture, setState] = useState(read)
  const setGesture = (v) => {
    setState(v)
    try { localStorage.setItem(KEY, v) } catch { /* not remembered, still applied */ }
  }
  return [gesture, setGesture]
}
