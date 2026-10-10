import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Shadows only change when something in the room changes, not when the camera moves, so the shadow
 * map is re-rendered on demand instead of every frame. This roughly halves the draw calls while
 * orbiting. They refresh when the design changes (every edit makes a new design object) or `tick`
 * changes (a piece being dragged).
 */
export default function Shadows({ design, tick }) {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const { gl, invalidate } = get()
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [get, design, tick])
  return null
}
