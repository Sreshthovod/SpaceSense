/**
 * Pure camera maths for the designer: framing the room, presets, limits and input classification.
 * Room space: feet, floor centre at the origin, x across the width, z along the length, y up.
 */
import { WALL_THICKNESS } from './design'

export const FOV = 45
export const GLIDE_MS = 600
const rad = (d) => (d * Math.PI) / 180
const norm = (v) => {
  const l = Math.hypot(...v) || 1
  return v.map((c) => c / l)
}

/** Radius of a sphere that encloses the room's walls. */
export const roomRadius = ({ width, length, height }) => Math.hypot(width + WALL_THICKNESS * 2, length + WALL_THICKNESS * 2, height) / 2

/** Camera distance at which a sphere of `radius` fits the view, whichever of width or height is tighter. */
export function fitDistance(radius, aspect, fov = FOV, margin = 1.08) {
  const v = rad(fov) / 2
  const h = Math.atan(Math.tan(v) * aspect)
  return (radius * margin) / Math.sin(Math.min(v, h))
}

// Viewing directions (from the target towards the camera).
const DIRECTIONS = {
  perspective: [0.62, 0.62, 0.9], // over the front-right corner
  top: [0, 1, 0.0001], // straight down, a hair off vertical so "up" stays defined
  front: [0, 0.32, 1], // from the front, looking at the back wall
  left: [-1, 0.32, 0], // from the left, looking at the right wall
  right: [1, 0.32, 0],
}
export const PRESETS = ['perspective', 'top', 'front', 'left', 'right']
export const PRESET_LABELS = { perspective: 'Perspective', top: 'Top view', front: 'Front view', left: 'Left view', right: 'Right view' }

/** Where the camera goes for a preset, framing the whole room for this canvas shape. */
export function presetPose(name, room, aspect) {
  const target = [0, room.height * 0.35, 0]
  const dir = norm(DIRECTIONS[name] || DIRECTIONS.perspective)
  const distance = fitDistance(roomRadius(room), aspect)
  return { position: target.map((t, i) => t + dir[i] * distance), target }
}

/** Frame one object (its centre and radius), keeping the current viewing direction. */
export function focusPose({ position, radius }, camera, target, limits) {
  const dir = norm(camera.map((c, i) => c - target[i]))
  const distance = Math.min(limits.maxDistance, Math.max(limits.minDistance, fitDistance(radius, 1.2)))
  return { position: position.map((p, i) => p + dir[i] * distance), target: [...position] }
}

/** Zoom limits that scale with the room: from close-up to well outside it. */
export function distanceLimits(room, aspect) {
  const r = roomRadius(room)
  return { minDistance: Math.max(2, r * 0.35), maxDistance: fitDistance(r, aspect) * 2.5 }
}

/** The point the camera orbits around stays over the room (plus a foot), between floor and ceiling. */
export function clampTarget([x, y, z], room, margin = 1) {
  const cx = room.width / 2 + margin
  const cz = room.length / 2 + margin
  return [Math.min(cx, Math.max(-cx, x)), Math.min(room.height, Math.max(0, y)), Math.min(cz, Math.max(-cz, z))]
}

/**
 * Keeps the camera out of the wall slabs, where it would see the inside of a wall. Inside the room it
 * stays half a foot from the walls; outside it stays clear of the outer face. Above the walls it is free.
 */
export function keepOutOfWalls([x, y, z], room, inset = 0.5, outset = 0.35) {
  if (y > room.height + 0.25) return [x, y, z]
  const fix = (v, half, otherInside) => {
    if (!otherInside) return v
    const a = Math.abs(v)
    const inner = half - inset
    const outer = half + WALL_THICKNESS + outset
    if (a <= inner || a >= outer) return v
    return Math.sign(v || 1) * (a - inner < outer - a ? inner : outer)
  }
  const insideZ = Math.abs(z) < room.length / 2 + WALL_THICKNESS + outset
  const insideX = Math.abs(x) < room.width / 2 + WALL_THICKNESS + outset
  return [fix(x, room.width / 2, insideZ), y, fix(z, room.length / 2, insideX)]
}

/** Pixels per foot so the whole room (and its labels) fits the floor-plan view. */
export function planZoom(room, widthPx, heightPx, margin = 3) {
  return Math.max(1, Math.min(widthPx / (room.width + margin * 2), heightPx / (room.length + margin * 2)))
}

/**
 * Plan framing that leaves room for the toolbar strip over the top of the canvas: the zoom that fits
 * the room in the area below it, and how far to shift the camera (towards the back wall, -z) so the
 * room is centred in that area.
 */
export function planFit(room, widthPx, heightPx, overlayPx = 110) {
  const zoom = planZoom(room, widthPx, Math.max(100, heightPx - overlayPx))
  return { zoom, z: -overlayPx / 2 / zoom }
}

/**
 * Wheel events: a pinch arrives as a wheel with ctrlKey (zoom). With "auto", whole-line steps or big
 * steps are a mouse wheel (zoom); small, fractional or sideways pixel steps are a trackpad's
 * two-finger scroll (pan). The user can force either in the help menu.
 */
export function classifyWheel({ ctrlKey, deltaMode, deltaX, deltaY }, setting = 'auto') {
  if (ctrlKey) return 'zoom'
  if (setting === 'zoom' || setting === 'pan') return setting
  if (deltaMode !== 0) return 'zoom'
  if (deltaX !== 0) return 'pan'
  if (!Number.isInteger(deltaY)) return 'pan'
  return Math.abs(deltaY) >= 50 ? 'zoom' : 'pan'
}

/** Zoom factor for one wheel event (>1 zooms in). Pinches send small deltas, so they're amplified. */
export function wheelZoomFactor({ ctrlKey, deltaMode, deltaY }) {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY
  return Math.exp(-px * (ctrlKey ? 0.01 : 0.0015))
}

/** A press becomes a drag only after it travels this far, so a click never nudges anything. */
export const DRAG_THRESHOLD_PX = 4
export const isDrag = (dx, dy) => Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX

export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** Interaction modes and what a press on an object does in each. */
export const MODES = [
  { id: 'navigate', label: 'Navigate', key: 'h', hint: 'Drag to orbit, right-drag or two fingers to pan, scroll or pinch to zoom. Objects are not selected.' },
  { id: 'select', label: 'Select', key: 'v', hint: 'Click an object to select it. Dragging always moves the camera.' },
  { id: 'move', label: 'Move', key: 'm', hint: 'Drag an object to move it along the floor. Drag empty space to orbit.' },
  { id: 'rotate', label: 'Rotate', key: 'e', hint: 'Drag left or right on an object to turn it (15° steps; hold Alt to turn freely).' },
]
