import { useEffect, useMemo, useRef, useState } from 'react'
import { Plane, Vector3 } from 'three'
import { floorItemSpec } from '../model/catalog'
import { isDrag } from '../model/camera'
import { clampToRoom, footprint, snapFloor, snapRotationStep } from '../model/floorPlacement'
import FloorItemShape from './FloorItemShape'
import Part from './Part'
import { useResources } from './useResources'

const FLOOR = new Plane(new Vector3(0, 1, 0), 0)
const DEG_PER_PX = 0.6

/** A flat outline under the item: sage when selected, red when it has a warning. */
function Halo({ w, d, warned }) {
  const { material } = useResources()
  return <Part position={[0, 0.006, 0]} scale={[w + 0.3, 0.01, d + 0.3]} mat={material(warned ? '#c0392b' : '#5b6650', { roughness: 1 })} />
}

function FloorItem({ item, selected, warned, handlers }) {
  const spec = floorItemSpec(item.catalogId)
  if (!spec) return null
  const { w, d, h } = footprint(item)
  return (
    <group
      name={`floor-${item.catalogId}`}
      userData={{ uid: item.uid }}
      position={[item.x, 0, item.z]}
      rotation={[0, (item.rotation * Math.PI) / 180, 0]}
      {...handlers(item)}
    >
      <FloorItemShape catalogId={item.catalogId} w={w} d={d} h={h} color={item.color || spec.color} />
      {(selected || warned) && <Halo w={w} d={d} warned={warned} />}
    </group>
  )
}

/**
 * Furniture on the floor and what a press on it does, by mode:
 *   navigate  nothing (the camera always moves)
 *   select    a click selects; a drag moves the camera
 *   move      a drag moves the item along the floor (after 4 px, so clicks never nudge it)
 *   rotate    a drag left/right turns it (15° steps; Alt turns freely)
 * In move and rotate the camera is switched off on press, so a drag never moves both. Esc cancels a
 * drag in progress. Locked items can be selected but not moved. One drag is one undo step.
 */
export default function FloorItems({ design, size, mode, snap, selected, warned, setOrbitEnabled, onSelect, onFocus, dispatch }) {
  const [drag, setDrag] = useState(null) // { uid, kind, startX, startY, dx, dz, origin, draft, active }
  const dragRef = useRef(null)
  useEffect(() => { dragRef.current = drag }, [drag])
  const items = design.items.filter((i) => !i.wall && !i.hidden)
  const hit = useMemo(() => new Vector3(), [])
  const floorPoint = (e) => (e.ray.intersectPlane(FLOOR, hit) ? { x: hit.x, z: hit.z } : null)

  // Esc cancels a drag: the item goes back and the camera is switched on again. Captured before the
  // designer's own Esc (deselect), so one press does one thing.
  useEffect(() => {
    if (!drag) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape' || !dragRef.current) return
      e.stopPropagation()
      dragRef.current = null
      setDrag(null)
      setOrbitEnabled(true)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [drag, setOrbitEnabled])

  const editable = mode === 'move' || mode === 'rotate'

  const handlers = (item) => ({
    onPointerDown: (e) => {
      if (mode === 'navigate' || e.button !== 0) return
      if (!editable) return // select mode: a click selects (onClick); a drag orbits
      e.stopPropagation()
      onSelect(item)
      if (item.locked) return
      const p = floorPoint(e)
      if (!p) return
      setOrbitEnabled(false)
      e.target.setPointerCapture(e.pointerId)
      const next = { uid: item.uid, kind: mode, startX: e.clientX, startY: e.clientY, dx: item.x - p.x, dz: item.z - p.z, origin: item, draft: item, active: false }
      dragRef.current = next
      setDrag(next)
    },
    onPointerMove: (e) => {
      const current = dragRef.current
      if (!current || current.uid !== item.uid) return
      e.stopPropagation()
      const active = current.active || isDrag(e.clientX - current.startX, e.clientY - current.startY)
      if (!active) return
      let draft
      if (current.kind === 'rotate') {
        const turned = current.origin.rotation + (e.clientX - current.startX) * DEG_PER_PX
        draft = clampToRoom({ ...current.origin, rotation: e.altKey ? Math.round(turned) : snapRotationStep(turned) }, size)
      } else {
        const p = floorPoint(e)
        if (!p) return
        const moved = { ...current.origin, x: p.x + current.dx, z: p.z + current.dz }
        const others = items.filter((i) => i.uid !== current.uid)
        const snapped = snap && !e.altKey ? { ...moved, ...snapFloor(moved, others, size) } : moved
        draft = clampToRoom(snapped, size)
      }
      const next = { ...current, active: true, draft }
      dragRef.current = next
      setDrag(next)
    },
    onPointerUp: (e) => {
      const current = dragRef.current
      if (!current || current.uid !== item.uid) return
      e.stopPropagation()
      e.target.releasePointerCapture?.(e.pointerId)
      setOrbitEnabled(true)
      if (current.active) {
        const { x, z, rotation } = current.draft
        dispatch({ type: 'updatePlaced', uid: current.uid, changes: current.kind === 'rotate' ? { rotation } : { x, z } })
      }
      dragRef.current = null
      setDrag(null)
    },
    onPointerCancel: () => {
      if (!dragRef.current) return
      setOrbitEnabled(true)
      dragRef.current = null
      setDrag(null)
    },
    onClick: (e) => {
      if (mode !== 'select' || e.delta > 4) return
      e.stopPropagation()
      onSelect(item)
    },
    onDoubleClick: (e) => {
      if (mode === 'navigate') return
      e.stopPropagation()
      onFocus(item)
    },
    onPointerOver: (e) => {
      if (mode === 'navigate') return
      e.stopPropagation()
      document.body.style.cursor = editable ? (item.locked ? 'not-allowed' : mode === 'rotate' ? 'ew-resize' : 'grab') : 'pointer'
    },
    onPointerOut: () => { document.body.style.cursor = '' },
  })

  return items.map((stored) => {
    const item = drag?.uid === stored.uid ? drag.draft : stored
    return <FloorItem key={item.uid} item={item} selected={item.uid === selected} warned={warned.has(item.uid)} handlers={handlers} />
  })
}
