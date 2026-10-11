import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { roseRotation } from '../model/compass'

const up = new Vector3()
const forward = new Vector3()

/**
 * Works out how far the viewport compass should turn, every frame the scene renders (the canvas renders
 * on demand, so this costs nothing while the camera is still), and hands it to `onTurn`, which writes it
 * straight to the SVG: orbiting never re-renders React.
 */
export default function CompassTracker({ facing, onTurn }) {
  // A newly shown rose (direction just set) needs one frame to pick up the camera.
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => { invalidate() }, [facing, invalidate])
  useFrame(({ camera }) => {
    if (!facing || !onTurn) return
    // "Up the screen" across the floor: the camera's up vector for a top-down view, its forward vector
    // when looking across the room; for anything in between they point the same way, so add them.
    up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
    const x = up.x + forward.x
    const z = up.z + forward.z
    if (Math.hypot(x, z) < 1e-6) return
    onTurn(roseRotation(facing, x, z))
  })
  return null
}
