import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Vector2, Vector3 } from 'three'
import { isDrag } from '../model/camera'
import { footprint, isRound, localParts } from '../model/floorPlacement'
import { ghostAt } from '../model/placement'

const FLOOR = new Plane(new Vector3(0, 1, 0), 0)
/**
 * The see-through preview that follows the pointer while placing a new piece: green where it fits,
 * red where it would collide or block a door. A click (not a drag, which still orbits) places it.
 */
export default function PlacementGhost({ design, size, placing, snap, onPlace, onCancel }) {
  const { gl, camera, raycaster } = useThree()
  const [point, setPoint] = useState(null)
  const press = useRef(null)
  const hit = useMemo(() => new Vector3(), [])
  const ndc = useMemo(() => new Vector2(), [])
  const ghost = point ? ghostAt(design, size, placing.catalogId, point.x, point.z, snap, placing.size ? { size: placing.size } : {}) : null
  const latest = useRef(null)
  useEffect(() => { latest.current = ghost })

  useEffect(() => {
    const el = gl.domElement
    const floorPoint = (e) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      return raycaster.ray.intersectPlane(FLOOR, hit) ? { x: hit.x, z: hit.z } : null
    }
    const onMove = (e) => setPoint(floorPoint(e))
    const onDown = (e) => {
      if (e.button === 2) { onCancel(); return }
      if (e.button === 0) press.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e) => {
      const p = press.current
      press.current = null
      if (!p || e.button !== 0 || isDrag(e.clientX - p.x, e.clientY - p.y)) return // a drag orbits instead
      const at = floorPoint(e)
      if (!at) return
      const { item } = ghostAt(design, size, placing.catalogId, at.x, at.z, snap, placing.size ? { size: placing.size } : {})
      // The browser's click follows this pointerup; swallow it so it doesn't land on the floor
      // underneath (which would deselect the piece that was just placed).
      const swallow = (ev) => ev.stopPropagation()
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400)
      onPlace({ x: item.x, z: item.z, rotation: item.rotation })
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel()
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey, { capture: true })
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey, { capture: true })
    }
  }, [gl, camera, raycaster, hit, ndc, design, size, placing, snap, onPlace, onCancel])

  if (!ghost) return null
  const { w, d, h } = footprint(ghost.item)
  const color = ghost.valid ? '#5b8a5a' : '#c0392b'
  const round = isRound(ghost.item.catalogId)
  const parts = round ? [] : localParts(ghost.item.catalogId, w, d)
  return (
    <group position={[ghost.item.x, (ghost.item.elevation || 0) + h / 2, ghost.item.z]} rotation={[0, (ghost.item.rotation * Math.PI) / 180, 0]} name="placement-ghost">
      {round ? (
        <>
          <mesh scale={[w, Math.max(h, 0.05), d]} raycast={() => null}>
            <cylinderGeometry args={[0.5, 0.5, 1, 24]} />
            <meshStandardMaterial color={color} transparent opacity={0.35} depthWrite={false} />
          </mesh>
          <mesh position={[0, -h / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <circleGeometry args={[Math.max(w, d) / 2 + 0.15, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </>
      ) : parts.map((p, i) => (
        <group key={i} position={[p.cx, 0, p.cz]}>
          <mesh raycast={() => null}>
            <boxGeometry args={[p.w, Math.max(h, 0.05), p.d]} />
            <meshStandardMaterial color={color} transparent opacity={0.35} depthWrite={false} />
          </mesh>
          <mesh position={[0, -h / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <planeGeometry args={[p.w + 0.3, p.d + 0.3]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
