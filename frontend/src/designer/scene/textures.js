/**
 * Procedural textures drawn on a 512 px canvas: no image files, nothing downloaded. Each is tinted
 * from the chosen colour, so the swatch the user picked stays the dominant colour on screen.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

const SIZE = 512

// A small deterministic random generator, so a pattern looks the same every time it's drawn.
function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amount * 255))))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function canvas(draw) {
  const el = document.createElement('canvas')
  el.width = SIZE
  el.height = SIZE
  const ctx = el.getContext('2d')
  if (ctx) draw(ctx, SIZE)
  const texture = new CanvasTexture(el)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = 4
  return texture
}

const WALLPAPER_DRAW = {
  stripe: (ctx, s, color) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = shade(color, -0.06)
    for (let x = 0; x < s; x += s / 4) ctx.fillRect(x, 0, s / 8, s)
  },
  grasscloth: (ctx, s, color) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, s, s)
    const r = rng(7)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = shade(color, (r() - 0.5) * 0.12)
      ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 8 + r() * 40)
    }
  },
  geometric: (ctx, s, color) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = shade(color, -0.12)
    ctx.lineWidth = 6
    const step = s / 4
    for (let y = 0; y < s; y += step) {
      for (let x = 0; x < s; x += step) {
        ctx.beginPath()
        ctx.moveTo(x + step / 2, y + 8)
        ctx.lineTo(x + step - 8, y + step / 2)
        ctx.lineTo(x + step / 2, y + step - 8)
        ctx.lineTo(x + 8, y + step / 2)
        ctx.closePath()
        ctx.stroke()
      }
    }
  },
  linen: (ctx, s, color) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, s, s)
    const r = rng(11)
    for (let i = 0; i < s; i += 2) {
      ctx.fillStyle = shade(color, (r() - 0.5) * 0.06)
      ctx.fillRect(0, i, s, 1)
      ctx.fillStyle = shade(color, (r() - 0.5) * 0.06)
      ctx.fillRect(i, 0, 1, s)
    }
  },
}

const FLOOR_DRAW = {
  planks: (ctx, s, color) => {
    const r = rng(3)
    const rows = 8 // one texture tile = 4 ft, so planks are 6 in wide
    const h = s / rows
    for (let row = 0; row < rows; row++) {
      let x = -r() * s * 0.5
      while (x < s) {
        const len = s * (0.35 + r() * 0.4)
        ctx.fillStyle = shade(color, (r() - 0.5) * 0.12)
        ctx.fillRect(x, row * h, len, h)
        // Grain lines.
        ctx.strokeStyle = shade(color, -0.06)
        ctx.lineWidth = 1
        for (let g = 0; g < 4; g++) {
          const gy = row * h + 4 + r() * (h - 8)
          ctx.beginPath()
          ctx.moveTo(x, gy)
          ctx.bezierCurveTo(x + len / 3, gy + (r() - 0.5) * 6, x + (2 * len) / 3, gy + (r() - 0.5) * 6, x + len, gy)
          ctx.stroke()
        }
        ctx.fillStyle = shade(color, -0.18)
        ctx.fillRect(x + len - 1, row * h, 2, h) // plank end joint
        x += len
      }
      ctx.fillStyle = shade(color, -0.16)
      ctx.fillRect(0, row * h, s, 1.5) // board edge
    }
  },
  marble: (ctx, s, color) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, s, s)
    const r = rng(5)
    ctx.strokeStyle = shade(color, -0.14)
    for (let v = 0; v < 9; v++) {
      ctx.lineWidth = 0.6 + r() * 1.8
      ctx.globalAlpha = 0.25 + r() * 0.4
      let x = r() * s
      let y = 0
      ctx.beginPath()
      ctx.moveTo(x, y)
      while (y < s) {
        x += (r() - 0.5) * 40
        y += 12 + r() * 20
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },
  concrete: (ctx, s, color) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, s, s)
    const r = rng(9)
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = shade(color, (r() - 0.5) * 0.1)
      ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2)
    }
  },
  tile: (ctx, s, color) => {
    const n = 4 // one texture tile = 4 ft, so tiles are 1 ft
    const t = s / n
    const r = rng(13)
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = shade(color, (r() - 0.5) * 0.04)
        ctx.fillRect(x * t, y * t, t, t)
      }
    }
    ctx.fillStyle = shade(color, -0.2)
    for (let i = 0; i <= n; i++) {
      ctx.fillRect(i * t - 1.5, 0, 3, s)
      ctx.fillRect(0, i * t - 1.5, s, 3)
    }
  },
  stone: (ctx, s, color) => {
    const r = rng(17)
    const rows = 3
    const h = s / rows
    for (let row = 0; row < rows; row++) {
      let x = -(row % 2) * s * 0.25
      while (x < s) {
        const w = s * (0.3 + r() * 0.25)
        ctx.fillStyle = shade(color, (r() - 0.5) * 0.1)
        ctx.fillRect(x, row * h, w, h)
        ctx.fillStyle = shade(color, -0.18)
        ctx.fillRect(x + w - 2, row * h, 3, h)
        x += w
      }
      ctx.fillStyle = shade(color, -0.18)
      ctx.fillRect(0, row * h, s, 3)
    }
  },
}

export const makeWallpaper = (pattern, color) => canvas((ctx, s) => (WALLPAPER_DRAW[pattern] || WALLPAPER_DRAW.stripe)(ctx, s, color))
export const makeFloorTexture = (pattern, color) => canvas((ctx, s) => (FLOOR_DRAW[pattern] || FLOOR_DRAW.planks)(ctx, s, color))
