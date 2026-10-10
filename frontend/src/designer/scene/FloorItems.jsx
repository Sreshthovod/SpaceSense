import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Matrix4, Plane, Quaternion, Vector3 } from 'three'
import { floorItemSpec } from '../model/catalog'
import { isDrag } from '../model/camera'
import { clampToRoom, footprint, isRound, localParts, snapFloor, snapRotationStep } from '../model/floorPlacement'
import FloorItemShape from './FloorItemShape'
import Part from './Part'
import { useResources } from './useResources'

const FLOOR = new Plane(new Vector3(0, 1, 0), 0)
const DEG_PER_PX = 0.6

/** A flat outline under the item: sage when selected, red when it has a warning. */
function Halo({ catalogId, w, d, warned }) {
  const { material, upright } = useResources()
  const mat = material(warned ? '#c0392b' : '#5b6650', { roughness: 1 })
  if (isRound(catalogId)) return <Part geometry={upright} position={[0, 0.006, 0]} scale={[w + 0.3, 0.01, d + 0.3]} mat={mat} />
  return localParts(catalogId, w, d).map((p, i) => <Part key={i} position={[p.cx, 0.006, p.cz]} scale={[p.w + 0.3, 0.01, p.d + 0.3]} mat={mat} />)
}

const MAX_SHADOWS = 200
const UP = new Vector3(0, 1, 0)

/**
 * Soft shadows on the floor under every piece standing on it, drawn as ONE instanced mesh: the same
 * blob repeated, so 30 pieces cost one draw call instead of 30.
 */
function ContactShadows({ items }) {
  const { plane, contact } = useResources()
  const ref = useRef(null)
  const grounded = items.filter((i) => !i.elevation && floorItemSpec(i.catalogId)?.layer !== 'rug')
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const q = new Quaternion()
    // One soft shadow per rectangle of the footprint, so an L-shaped sofa doesn't shade its empty corner.
    let count = 0
    for (const item of grounded) {
      const { w, d } = footprint(item)
      const rad = (item.rotation * Math.PI) / 180
      const c = Math.cos(rad)
      const s = Math.sin(rad)
      q.setFromAxisAngle(UP, rad)
      for (const p of localParts(item.catalogId, w, d)) {
        if (count >= MAX_SHADOWS) break
        m.compose(new Vector3(item.x + p.cx * c + p.cz * s, 0.005, item.z - p.cx * s + p.cz * c), q, new Vector3(p.w * 1.25, 1, p.d * 1.25))
        mesh.setMatrixAt(count++, m)
      }
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  })
  return <instancedMesh ref={ref} args={[plane, contact, MAX_SHADOWS]} renderOrder={1} raycast={() => null} dispose={null} frustumCulled={false} />
}

/** A thin box outline around a piece: solid when selected, faint on hover. */
function Outline({ catalogId, w, d, h, hover }) {
  const { edges, roundEdges, outline, hoverOutline } = useResources()
  const material = hover ? hoverOutline : outline
  if (isRound(catalogId)) {
    return <lineSegments geometry={roundEdges} material={material} position={[0, h / 2, 0]} scale={[w + 0.12, h + 0.12, d + 0.12]} raycast={() => null} dispose={null} />
  }
  return localParts(catalogId, w, d).map((p, i) => (
    <lineSegments key={i} geometry={edges} material={material} position={[p.cx, h / 2, p.cz]} scale={[p.w + 0.12, h + 0.12, p.d + 0.12]} raycast={() => null} dispose={null} />
  ))
}

function FloorItem({ item, selected, hovered, warned, handlers }) {
  const spec = floorItemSpec(item.catalogId)
  if (!spec) return null
  const { w, d, h } = footprint(item)
  return (
    <group
      name={`floor-${item.catalogId}`}
      userData={{ uid: item.uid }}
      position={[item.x, item.elevation || 0, item.z]}
      rotation={[0, (item.rotation * Math.PI) / 180, 0]}
      {...handlers(item)}
    >
      <FloorItemShape catalogId={item.catalogId} w={w} d={d} h={h} color={item.color || spec.color} />
      {warned && <Halo catalogId={item.catalogId} w={w} d={d} warned />}
      {(selected || hovered) && <Outline catalogId={item.catalogId} w={w} d={d} h={Math.max(h, 0.05)} hover={!selected} />}
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
export default function FloorItems({ design, size, mode, snap, selected, warned, setOrbitEnabled, onSelect, onFocus, dispatch, onDragFrame }) {
  const [drag, setDrag] = useState(null) // { uid, kind, startX, startY, dx, dz, origin, draft, active }
  const [hovered, setHovered] = useState(null)
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
      let guides = []
      if (current.kind === 'rotate') {
        const turned = current.origin.rotation + (e.clientX - current.startX) * DEG_PER_PX
        draft = clampToRoom({ ...current.origin, rotation: e.altKey ? Math.round(turned) : snapRotationStep(turned) }, size)
      } else {
        const p = floorPoint(e)
        if (!p) return
        const moved = { ...current.origin, x: p.x + current.dx, z: p.z + current.dz }
        const others = items.filter((i) => i.uid !== current.uid)
        const snapped = snap && !e.altKey ? snapFloor(moved, others, size) : { x: moved.x, z: moved.z, guides: [] }
        draft = clampToRoom({ ...moved, x: snapped.x, z: snapped.z }, size)
        // Only show guides the item still sits on after clamping.
        guides = snapped.guides.filter((g) => (g.axis === 'x' ? draft.x === snapped.x : draft.z === snapped.z))
      }
      const next = { ...current, active: true, draft, guides }
      dragRef.current = next
      setDrag(next)
      onDragFrame?.()
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
      setHovered(item.uid)
      document.body.style.cursor = editable ? (item.locked ? 'not-allowed' : mode === 'rotate' ? 'ew-resize' : 'grab') : 'pointer'
    },
    onPointerOut: () => {
      setHovered((h) => (h === item.uid ? null : h))
      document.body.style.cursor = ''
    },
  })

  return (
    <>
      <ContactShadows items={items.map((stored) => (drag?.uid === stored.uid ? drag.draft : stored))} />
      {items.map((stored) => {
        const item = drag?.uid === stored.uid ? drag.draft : stored
        return <FloorItem key={item.uid} item={item} selected={item.uid === selected} hovered={item.uid === hovered && mode !== 'navigate'} warned={warned.has(item.uid)} handlers={handlers} />
      })}
      {drag?.active && drag.guides?.map((g) => <Guide key={`${g.axis}${g.at}`} guide={g} size={size} />)}
    </>
  )
}

/** A thin line across the floor at the edge or centre a dragged item snapped to. */
function Guide({ guide, size }) {
  const { material } = useResources()
  const along = guide.axis === 'x'
  return (
    <Part
      position={along ? [guide.at, 0.03, 0] : [0, 0.03, guide.at]}
      scale={along ? [0.04, 0.01, size.length] : [size.width, 0.01, 0.04]}
      mat={material('#5b6650', { roughness: 1 })}
    />
  )
}
