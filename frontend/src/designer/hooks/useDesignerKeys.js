import { useEffect, useRef } from 'react'
import { findPlaced } from '../model/design'
import { ROTATE_STEP } from '../model/floorPlacement'
import { newUid } from '../model/ids'
import { GRID } from '../model/wallPlacement'

const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName))

/**
 * Designer shortcuts. Ignored while typing in a field (the browser's own undo works there).
 *   Cmd/Ctrl+Z undo · Cmd/Ctrl+Shift+Z or Ctrl+Y redo
 *   Esc deselects, then leaves the wall · Delete/Backspace removes
 *   arrows nudge 3 in (Shift: 1 ft) · R / Shift+R turns 15° · Cmd/Ctrl+D duplicates
 * `blocked` (e.g. an open dialog) switches them all off.
 */
export default function useDesignerKeys({ design, selected, activeWall, dispatch, undo, redo, setSelected, setActiveWall, blocked }) {
  const ctx = useRef(null)
  useEffect(() => {
    ctx.current = { design, selected, activeWall, dispatch, undo, redo, setSelected, setActiveWall, blocked }
  })

  useEffect(() => {
    const onKey = (e) => {
      const c = ctx.current
      if (!c || c.blocked || isTyping(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) c.redo()
        else c.undo()
        return
      }
      if (e.ctrlKey && key === 'y') {
        e.preventDefault()
        c.redo()
        return
      }
      if (e.key === 'Escape') {
        if (c.selected) c.setSelected(null)
        else if (c.activeWall) c.setActiveWall(null)
        return
      }
      const item = c.selected ? findPlaced(c.design, c.selected)?.item : null
      if (!item) return
      const uid = item.uid
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (item.locked) return
        c.dispatch({ type: 'removePlaced', uid })
        c.setSelected(null)
        return
      }
      if (mod && key === 'd') {
        e.preventDefault()
        const copy = newUid()
        c.dispatch({ type: 'duplicatePlaced', uid, newUid: copy })
        c.setSelected(copy)
        return
      }
      if (key === 'r' && !mod) {
        e.preventDefault()
        c.dispatch({ type: 'updatePlaced', uid, changes: { rotation: item.rotation + (e.shiftKey ? -ROTATE_STEP : ROTATE_STEP) } })
        return
      }
      const step = e.shiftKey ? 1 : GRID
      const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]
      if (!nudge) return
      e.preventDefault()
      // On a wall, up is up; on the floor, up moves towards the back wall. Repeated nudges are one undo step.
      const changes = item.wall ? { x: item.x + nudge[0], y: item.y + nudge[1] } : { x: item.x + nudge[0], z: item.z - nudge[1] }
      c.dispatch({ type: 'updatePlaced', uid, changes, coalesce: `nudge:${uid}` })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
