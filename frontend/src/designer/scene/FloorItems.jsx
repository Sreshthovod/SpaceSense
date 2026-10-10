import { useMemo, useState } from 'react'
import { Plane, Vector3 } from 'three'
import { floorItemSpec } from '../model/catalog'
import { clampToRoom, footprint, snapFloor } from '../model/floorPlacement'
import FloorItemShape from './FloorItemShape'
import Part from './Part'
import { useResources } from './useResources'

const FLOOR = new Plane(new Vector3(0, 1, 0), 0)

/** A flat outline under the item: sage when selected, red when it has a warning. */
function Halo({ w, d, warned }) {
  const { material } = useResources()
  return <Part position={[0, 0.006, 0]} scale={[w + 0.3, 0.01, d + 0.3]} mat={material(warned ? '#c0392b' : '#5b6650', { roughness: 1 })} />
}

/**
 * Furniture on the floor, with drag-to-move. The orbit controls are switched off synchronously on
 * pointer down, so dragging an item never moves the camera. A drag is previewed locally and committed
 * on release as one edit.
 */
export default function FloorItems({ design, size, selected, warned, setOrbitEnabled, onSelect, dispatch }) {
  const [drag, setDrag] = useState(null) // { uid, dx, dz, draft }
  const items = design.items.filter((i) => !i.wall)
  const hit = useMemo(() => new Vector3(), [])

  const floorPoint = (e) => (e.ray.intersectPlane(FLOOR, hit) ? { x: hit.x, z: hit.z } : null)

  const down = (item) => (e) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect(item)
    const p = floorPoint(e)
    if (!p) return
    setOrbitEnabled(false)
    e.target.setPointerCapture(e.pointerId)
    setDrag({ uid: item.uid, dx: item.x - p.x, dz: item.z - p.z, draft: item })
  }

  const move = (e) => {
    if (!drag) return
    e.stopPropagation()
    const p = floorPoint(e)
    if (!p) return
    const moved = { ...drag.draft, x: p.x + drag.dx, z: p.z + drag.dz }
    const others = items.filter((i) => i.uid !== drag.uid)
    const snapped = e.altKey ? moved : { ...moved, ...snapFloor(moved, others, size) }
    setDrag({ ...drag, draft: clampToRoom(snapped, size) })
  }

  const up = (e) => {
    if (!drag) return
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    setOrbitEnabled(true)
    dispatch({ type: 'updatePlaced', uid: drag.uid, changes: { x: drag.draft.x, z: drag.draft.z } })
    setDrag(null)
  }

  return items.map((stored) => {
    const item = drag?.uid === stored.uid ? drag.draft : stored
    const spec = floorItemSpec(item.catalogId)
    if (!spec) return null
    const { w, d, h } = footprint(item)
    return (
      <group
        key={item.uid}
        name={`floor-${item.catalogId}`}
        position={[item.x, 0, item.z]}
        rotation={[0, (item.rotation * Math.PI) / 180, 0]}
        onPointerDown={down(stored)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab' }}
        onPointerOut={() => { document.body.style.cursor = '' }}
      >
        <FloorItemShape catalogId={item.catalogId} w={w} d={d} h={h} color={spec.color} />
        {(item.uid === selected || warned.has(item.uid)) && <Halo w={w} d={d} warned={warned.has(item.uid)} />}
      </group>
    )
  })
}
