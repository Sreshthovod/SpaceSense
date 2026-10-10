import { describe, expect, it } from 'vitest'
import { WALL_THICKNESS } from './design'
import {
  classifyWheel, clampTarget, distanceLimits, fitDistance, focusPose, isDrag, keepOutOfWalls, planFit, planZoom, presetPose,
  roomRadius, wheelZoomFactor,
} from './camera'

const room = { width: 12, length: 16, height: 9 }
const sub = (a, b) => a.map((v, i) => v - b[i])
const len = (v) => Math.hypot(...v)
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)

describe('framing', () => {
  it('fits a sphere using the tighter field of view', () => {
    const wide = fitDistance(10, 2)
    const tall = fitDistance(10, 0.5)
    expect(tall).toBeGreaterThan(wide) // a narrow canvas needs the camera further back
    // At the fitted distance the sphere's angular radius equals the vertical half-FOV (aspect >= 1).
    expect(Math.asin((10 * 1.08) / wide)).toBeCloseTo((45 * Math.PI) / 360)
  })

  it('every preset frames the whole room: all corners inside the view', () => {
    for (const aspect of [390 / 500, 768 / 600, 1440 / 800]) {
      for (const name of ['perspective', 'top', 'front', 'left', 'right']) {
        const { position, target } = presetPose(name, room, aspect)
        const fwd = sub(target, position).map((v) => v / len(sub(target, position)))
        const upRef = Math.abs(fwd[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0]
        const right = [fwd[1] * upRef[2] - fwd[2] * upRef[1], fwd[2] * upRef[0] - fwd[0] * upRef[2], fwd[0] * upRef[1] - fwd[1] * upRef[0]]
        const r = right.map((v) => v / len(right))
        const up = [r[1] * fwd[2] - r[2] * fwd[1], r[2] * fwd[0] - r[0] * fwd[2], r[0] * fwd[1] - r[1] * fwd[0]]
        const t = Math.tan((45 * Math.PI) / 360)
        for (const x of [-6, 6]) for (const z of [-8, 8]) for (const y of [0, 9]) {
          const v = sub([x, y, z], position)
          const depth = dot(v, fwd)
          expect(Math.abs(dot(v, up) / depth), `${name} ${aspect}`).toBeLessThanOrEqual(t + 1e-9)
          expect(Math.abs(dot(v, r) / depth), `${name} ${aspect}`).toBeLessThanOrEqual(t * aspect + 1e-9)
        }
      }
    }
  })

  it('front view looks at the back wall; left view looks towards the right wall', () => {
    expect(presetPose('front', room, 1.5).position[2]).toBeGreaterThan(8)
    expect(presetPose('left', room, 1.5).position[0]).toBeLessThan(-6)
    const top = presetPose('top', room, 1.5)
    expect(top.position[1]).toBeGreaterThan(room.height * 2)
  })

  it('focus keeps the viewing direction and respects zoom limits', () => {
    const limits = distanceLimits(room, 1.5)
    const pose = focusPose({ position: [2, 1, -3], radius: 2 }, [20, 20, 20], [0, 0, 0], limits)
    expect(pose.target).toEqual([2, 1, -3])
    const d = len(sub(pose.position, pose.target))
    expect(d).toBeGreaterThanOrEqual(limits.minDistance)
    expect(sub(pose.position, pose.target).every((c) => c > 0)).toBe(true)
  })

  it('zoom limits scale with the room', () => {
    const small = distanceLimits({ width: 6, length: 6, height: 8 }, 1.5)
    const big = distanceLimits({ width: 40, length: 50, height: 12 }, 1.5)
    expect(big.minDistance).toBeGreaterThan(small.minDistance)
    expect(big.maxDistance).toBeGreaterThan(small.maxDistance)
    expect(small.maxDistance).toBeGreaterThan(fitDistance(roomRadius({ width: 6, length: 6, height: 8 }), 1.5))
  })

  it('plan framing leaves room for the toolbar and centres the room below it', () => {
    const fit = planFit(room, 1000, 710)
    expect(fit.zoom).toBeCloseTo(600 / 22)
    expect(fit.z * fit.zoom).toBeCloseTo(-55) // the room's centre lands 55 px below the canvas centre
  })

  it('plan zoom fits the room with a margin', () => {
    expect(planZoom(room, 1000, 600)).toBeCloseTo(600 / 22)
    expect(planZoom(room, 300, 900)).toBeCloseTo(300 / 18)
  })
})

describe('limits', () => {
  it('keeps the orbit target over the room', () => {
    expect(clampTarget([100, -5, -100], room)).toEqual([7, 0, -9])
    expect(clampTarget([1, 4, 2], room)).toEqual([1, 4, 2])
  })

  it('moves a camera out of a wall slab to the nearer side', () => {
    const half = room.width / 2
    expect(keepOutOfWalls([half - 0.2, 4, 0], room)[0]).toBeCloseTo(half - 0.5) // just inside → inside
    expect(keepOutOfWalls([half + WALL_THICKNESS, 4, 0], room)[0]).toBeCloseTo(half + WALL_THICKNESS + 0.35) // in the slab → outside
    expect(keepOutOfWalls([0, 4, -(8 + 0.1)], room)[2]).toBeCloseTo(-7.5)
    expect(keepOutOfWalls([half + 0.1, 20, 0], room)).toEqual([half + 0.1, 20, 0]) // above the walls: free
    expect(keepOutOfWalls([half + 0.1, 4, 30], room)).toEqual([half + 0.1, 4, 30]) // well beyond the front wall
    expect(keepOutOfWalls([1, 4, 2], room)).toEqual([1, 4, 2])
  })
})

describe('input', () => {
  it('classifies wheel input from mice, trackpads and pinches', () => {
    expect(classifyWheel({ ctrlKey: true, deltaMode: 0, deltaX: 0, deltaY: 3.2 })).toBe('zoom') // pinch
    expect(classifyWheel({ ctrlKey: false, deltaMode: 1, deltaX: 0, deltaY: 3 })).toBe('zoom') // line-based mouse
    expect(classifyWheel({ ctrlKey: false, deltaMode: 0, deltaX: 0, deltaY: 100 })).toBe('zoom') // mouse notch
    expect(classifyWheel({ ctrlKey: false, deltaMode: 0, deltaX: 4, deltaY: 2 })).toBe('pan') // two-finger diagonal
    expect(classifyWheel({ ctrlKey: false, deltaMode: 0, deltaX: 0, deltaY: 1.5 })).toBe('pan') // fractional
    expect(classifyWheel({ ctrlKey: false, deltaMode: 0, deltaX: 0, deltaY: 6 })).toBe('pan') // small step
    expect(classifyWheel({ ctrlKey: false, deltaMode: 0, deltaX: 0, deltaY: 6 }, 'zoom')).toBe('zoom')
    expect(classifyWheel({ ctrlKey: false, deltaMode: 1, deltaX: 0, deltaY: 3 }, 'pan')).toBe('pan')
    expect(classifyWheel({ ctrlKey: true, deltaMode: 0, deltaX: 0, deltaY: 3 }, 'pan')).toBe('zoom') // pinch always zooms
  })

  it('zooms in for negative deltas, gently for mice and faster for pinches', () => {
    expect(wheelZoomFactor({ deltaMode: 0, deltaY: -100 })).toBeGreaterThan(1)
    expect(wheelZoomFactor({ deltaMode: 0, deltaY: 100 })).toBeLessThan(1)
    expect(wheelZoomFactor({ deltaMode: 0, deltaY: 100 })).toBeCloseTo(Math.exp(-0.15))
    expect(wheelZoomFactor({ deltaMode: 1, deltaY: 3 })).toBeCloseTo(wheelZoomFactor({ deltaMode: 0, deltaY: 48 }))
    expect(wheelZoomFactor({ ctrlKey: true, deltaMode: 0, deltaY: -10 })).toBeCloseTo(Math.exp(0.1))
  })

  it('a press only becomes a drag after 4 px', () => {
    expect(isDrag(2, 2)).toBe(false)
    expect(isDrag(3, 3)).toBe(true)
  })
})
