import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { defaultView } from '../model/design'

/**
 * Orbit, zoom and pan. The scene renders on demand, so every camera change asks for a new frame.
 * The camera starts at the room's default view; changing `viewKey` returns to it (e.g. "Reset view").
 * The instance is shared through `controlsRef`, so a furniture drag can switch it off immediately.
 */
export default function Controls({ room, viewKey, controlsRef: ref, reduced = false }) {
  const { camera, gl, invalidate, size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  const view = defaultView(room, aspect)

  // The camera and renderer live as long as the canvas, so this runs once per designer session.
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    ref.current = controls
    controls.addEventListener('change', invalidate)
    return () => {
      controls.removeEventListener('change', invalidate)
      controls.dispose()
      ref.current = null
    }
  }, [camera, gl, invalidate, ref])

  useEffect(() => {
    const controls = ref.current
    controls.enableDamping = !reduced
    controls.dampingFactor = 0.12
    controls.maxPolarAngle = Math.PI / 2 - 0.04 // never below the floor
    controls.minDistance = view.minDistance
    controls.maxDistance = view.maxDistance
  }, [ref, reduced, view.minDistance, view.maxDistance])

  useEffect(() => {
    const controls = ref.current
    camera.position.set(...view.position)
    controls.target.set(...view.target)
    controls.update()
    invalidate()
    // Only an explicit view request moves the camera, not every room resize.
  }, [viewKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (ref.current?.enableDamping) ref.current.update()
  })

  return null
}
