import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { defaultView } from '../model/design'

/**
 * Orbit, zoom and pan. The scene renders on demand, so every camera change asks for a new frame.
 * The camera starts at the room's default view; changing `viewKey` returns to it (e.g. "Reset view").
 * The instance is shared through `controlsRef`, so a furniture drag can switch it off immediately.
 */
export default function Controls({ room, viewKey, focus, controlsRef: ref, reduced = false }) {
  const { camera, gl, invalidate, size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  const view = defaultView(room, aspect)
  const glide = useRef(null) // a focus transition in progress; any user camera input cancels it

  // The camera and renderer live as long as the canvas, so this runs once per designer session.
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    ref.current = controls
    const cancelGlide = () => { glide.current = null }
    controls.addEventListener('change', invalidate)
    controls.addEventListener('start', cancelGlide)
    return () => {
      controls.removeEventListener('change', invalidate)
      controls.removeEventListener('start', cancelGlide)
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

  // Focus: glide the camera so `focus.position` is centred, keeping the current viewing direction.
  useEffect(() => {
    const controls = ref.current
    if (!focus || !controls) return
    const target = new Vector3(...focus.position)
    const dir = camera.position.clone().sub(controls.target).normalize()
    const distance = Math.min(controls.maxDistance, Math.max(controls.minDistance, focus.radius * 3.2))
    const to = { target, position: target.clone().add(dir.multiplyScalar(distance)) }
    if (reduced) {
      controls.target.copy(to.target)
      camera.position.copy(to.position)
      controls.update()
      invalidate()
      return
    }
    glide.current = { start: performance.now(), from: { target: controls.target.clone(), position: camera.position.clone() }, to }
    invalidate()
    // Only a new focus request starts a glide.
  }, [focus?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const controls = ref.current
    if (!controls) return
    const g = glide.current
    if (g) {
      const t = Math.min(1, (performance.now() - g.start) / 450)
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2 // ease in-out
      controls.target.lerpVectors(g.from.target, g.to.target, e)
      camera.position.lerpVectors(g.from.position, g.to.position, e)
      controls.update()
      if (t < 1) invalidate()
      else glide.current = null
      return
    }
    if (controls.enableDamping) controls.update()
  })

  return null
}
