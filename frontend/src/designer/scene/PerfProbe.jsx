import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * Performance numbers for `?perf`: frames per second (while the scene is rendering), draw calls and
 * triangles of the last frame, and the geometries and textures held on the GPU. Reported to the
 * page every half second and mirrored on the canvas for browser tests.
 */
export default function PerfProbe({ onStats }) {
  const { gl } = useThree()
  const frames = useRef({ count: 0, since: 0, last: null })

  useFrame(() => {
    frames.current.count += 1
    const { calls, triangles } = gl.info.render
    frames.current.last = { calls, triangles }
  })

  useEffect(() => {
    frames.current.since = performance.now()
    const timer = setInterval(() => {
      const f = frames.current
      const now = performance.now()
      const fps = Math.round((f.count * 1000) / (now - f.since))
      f.count = 0
      f.since = now
      const stats = {
        fps,
        calls: f.last?.calls ?? 0,
        triangles: f.last?.triangles ?? 0,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      }
      gl.domElement.dataset.perf = JSON.stringify(stats)
      onStats?.(stats)
    }, 500)
    return () => clearInterval(timer)
  }, [gl, onStats])

  return null
}
