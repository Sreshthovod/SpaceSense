import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MOUSE, OrthographicCamera, TOUCH, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  GLIDE_MS, classifyWheel, clampTarget, distanceLimits, easeInOut, focusPose, keepOutOfWalls, planFit, presetPose,
  wheelZoomFactor,
} from '../model/camera'

const PLAN_HEIGHT = 200

/**
 * The designer's camera. 3D view: orbit (left-drag), pan (right-drag, Shift+drag, two-finger scroll
 * on a trackpad), zoom (wheel, pinch). Plan view: a real top-down orthographic camera that pans and
 * zooms but never rotates. Limits keep the room in view and the camera out of the walls.
 *
 * `command` ({ kind: 'preset' | 'focus' | 'fit', ..., key }) moves the camera; a new key runs it.
 * The OrbitControls instance is shared through `controlsRef` so object drags can switch it off.
 */
export default function CameraRig({ room, view, command, reduced = false, wheelSetting = 'auto', controlsRef: ref }) {
  const { camera, gl, invalidate, size, set, get } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  const limits = distanceLimits(room, aspect)
  const glide = useRef(null) // { start, from, to } for a camera transition; any user input cancels it
  const perspective = useRef(null) // the 3D camera, kept while the plan camera is active
  const saved3d = useRef(null) // the 3D pose to come back to after the plan view
  const ortho = useRef(null) // the plan camera, created the first time it's needed
  const settings = useRef({ room, limits, wheelSetting, reduced })
  useEffect(() => { settings.current = { room, limits, wheelSetting, reduced } })

  // Switch between the 3D camera and the plan camera, remembering the 3D pose.
  useEffect(() => {
    if (view === 'plan' && !camera.isOrthographicCamera) {
      perspective.current = camera
      saved3d.current = { position: camera.position.clone(), target: ref.current?.target.clone() || new Vector3() }
      const plan = ortho.current ?? (ortho.current = new OrthographicCamera())
      const fit = planFit(room, size.width, size.height)
      plan.position.set(0, PLAN_HEIGHT, fit.z)
      plan.up.set(0, 0, -1) // the back wall at the top of the screen
      plan.near = 1
      plan.far = PLAN_HEIGHT + 50
      plan.zoom = fit.zoom
      plan.lookAt(0, 0, fit.z)
      set({ camera: plan })
    } else if (view !== 'plan' && camera.isOrthographicCamera && perspective.current) {
      set({ camera: perspective.current })
    }
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the plan camera's frustum matched to the canvas (R3F sizes it in pixels; zoom = px per foot).
  useEffect(() => {
    const cam = get().camera
    if (!cam.isOrthographicCamera) return
    Object.assign(cam, { left: -size.width / 2, right: size.width / 2, top: size.height / 2, bottom: -size.height / 2 })
    cam.updateProjectionMatrix()
    invalidate()
  }, [camera, get, size.width, size.height, invalidate])

  // One OrbitControls per camera. Zoom by wheel is handled below, so the controls never see wheels.
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    ref.current = controls
    const plan = camera.isOrthographicCamera
    controls.enableDamping = !settings.current.reduced
    controls.dampingFactor = 0.1
    controls.rotateSpeed = 0.8
    controls.screenSpacePanning = true
    if (plan) {
      controls.enableRotate = false
      controls.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
      controls.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }
      controls.target.set(camera.position.x, 0, camera.position.z)
      controls.minZoom = 2
      controls.maxZoom = 400
    } else {
      controls.maxPolarAngle = Math.PI / 2 - 0.04 // never below the floor
      const back = saved3d.current
      if (back) {
        camera.position.copy(back.position)
        controls.target.copy(back.target)
        saved3d.current = null
      } else {
        const pose = presetPose('perspective', settings.current.room, aspect)
        camera.position.set(...pose.position)
        controls.target.set(...pose.target)
      }
    }
    controls.update()
    const cancelGlide = () => { glide.current = null }
    controls.addEventListener('change', invalidate)
    controls.addEventListener('start', cancelGlide)

    // Wheel and trackpad: captured on the canvas wrapper before OrbitControls can see it.
    const host = gl.domElement.parentElement
    const onWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      glide.current = null
      const s = settings.current
      const kind = classifyWheel(e, s.wheelSetting)
      if (kind === 'zoom') {
        const factor = wheelZoomFactor(e)
        if (camera.isOrthographicCamera) {
          camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * factor))
          camera.updateProjectionMatrix()
        } else {
          const offset = camera.position.clone().sub(controls.target)
          const distance = Math.min(s.limits.maxDistance, Math.max(s.limits.minDistance, offset.length() / factor))
          camera.position.copy(controls.target).add(offset.setLength(distance))
        }
      } else {
        // Two-finger scroll pans, like scrolling a page: the view moves with the fingers.
        const h = gl.domElement.clientHeight || 1
        const perPixel = camera.isOrthographicCamera
          ? 1 / camera.zoom
          : (2 * camera.position.distanceTo(controls.target) * Math.tan((camera.fov * Math.PI) / 360)) / h
        const right = new Vector3().setFromMatrixColumn(camera.matrix, 0)
        const up = new Vector3().setFromMatrixColumn(camera.matrix, 1)
        const move = right.multiplyScalar(e.deltaX * perPixel).add(up.multiplyScalar(-e.deltaY * perPixel))
        camera.position.add(move)
        controls.target.add(move)
      }
      controls.update()
      invalidate()
    }
    host?.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      host?.removeEventListener('wheel', onWheel, { capture: true })
      controls.removeEventListener('change', invalidate)
      controls.removeEventListener('start', cancelGlide)
      controls.dispose()
      ref.current = null
    }
  }, [camera, gl, invalidate, ref]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ref.current) ref.current.enableDamping = !reduced
  }, [reduced, ref])

  useEffect(() => {
    const controls = ref.current
    if (!controls || camera.isOrthographicCamera) return
    controls.minDistance = limits.minDistance
    controls.maxDistance = limits.maxDistance
  }, [camera, ref, limits.minDistance, limits.maxDistance])

  // Camera commands: presets, fit room, focus on an object.
  useEffect(() => {
    const controls = ref.current
    if (!command || !controls) return
    let to
    if (camera.isOrthographicCamera) {
      // Plan view: centre on the room or the object and zoom to fit it.
      const fit = planFit(room, size.width, size.height)
      const centre = command.kind === 'focus' ? command.position : [0, 0, fit.z]
      const zoom = command.kind === 'focus'
        ? Math.min(controls.maxZoom, Math.min(size.width, size.height) / (command.radius * 3))
        : fit.zoom
      to = { position: new Vector3(centre[0], PLAN_HEIGHT, centre[2]), target: new Vector3(centre[0], 0, centre[2]), zoom }
    } else {
      const pose = command.kind === 'focus'
        ? focusPose(command, camera.position.toArray(), controls.target.toArray(), limits)
        : presetPose(command.kind === 'fit' ? 'perspective' : command.name, room, aspect)
      to = { position: new Vector3(...pose.position), target: new Vector3(...pose.target) }
    }
    const from = { position: camera.position.clone(), target: controls.target.clone(), zoom: camera.zoom }
    if (reduced) {
      glide.current = { start: -Infinity, from, to }
    } else {
      glide.current = { start: performance.now(), from, to }
    }
    invalidate()
  }, [command?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state) => {
    const controls = ref.current
    if (!controls) return
    const cam = state.camera
    const g = glide.current
    if (g) {
      const t = Math.min(1, (performance.now() - g.start) / GLIDE_MS)
      const k = easeInOut(t)
      controls.target.lerpVectors(g.from.target, g.to.target, k)
      cam.position.lerpVectors(g.from.position, g.to.position, k)
      if (g.to.zoom) {
        cam.zoom = g.from.zoom + (g.to.zoom - g.from.zoom) * k
        cam.updateProjectionMatrix()
      }
      controls.update()
      if (t < 1) invalidate()
      else glide.current = null
    } else if (controls.enableDamping) {
      controls.update()
    }
    if (import.meta.env.DEV) {
      // Read by the browser tests to check where the camera is.
      state.gl.domElement.dataset.camera = [...cam.position.toArray(), ...controls.target.toArray(), cam.zoom].map((v) => v.toFixed(2)).join(',')
    }
    if (cam.isOrthographicCamera) return
    // Limits: orbit around the room, never inside a wall.
    const { room: r } = settings.current
    const t = clampTarget(controls.target.toArray(), r)
    const p = keepOutOfWalls(cam.position.toArray(), r)
    const tChanged = t.some((v, i) => Math.abs(v - controls.target.getComponent(i)) > 1e-6)
    const pChanged = p.some((v, i) => Math.abs(v - cam.position.getComponent(i)) > 1e-6)
    if (tChanged) controls.target.set(...t)
    if (pChanged) cam.position.set(...p)
    if (tChanged || pChanged) {
      controls.update()
      invalidate()
    }
  })

  return null
}
