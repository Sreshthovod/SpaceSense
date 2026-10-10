import { useState } from 'react'

const KEY = 'spacesense-designer-tips-seen'
const seen = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Whether to show the first-run tips; dismissing remembers it in this browser. */
export default function useTips() {
  const [show, setShow] = useState(() => !seen())
  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(KEY, '1') } catch { /* shown again next time */ }
  }
  return { show, dismiss, reopen: () => setShow(true) }
}
