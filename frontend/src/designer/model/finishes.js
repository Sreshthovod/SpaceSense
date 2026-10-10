/** Wall and floor finish options, and the maths that keeps textures at a real-world size. */

export const WALL_PALETTES = [
  { id: 'neutral', label: 'Neutral', colors: ['#efe9df', '#e6e0d4', '#d8d2c6', '#c9c2b5', '#a9a49a', '#5d5f5a'] },
  { id: 'warm', label: 'Warm', colors: ['#f1e4d0', '#e3d5bf', '#e8c9a8', '#d9a98b', '#c98b6b', '#a65f3c'] },
  { id: 'cool', label: 'Cool', colors: ['#e6ece8', '#c5cdb6', '#b9c6cf', '#9fb3bf', '#7f9a8c', '#4f6470'] },
]

// Procedural wallpapers. `tileFt` is the size of one pattern repeat on the wall.
export const WALLPAPERS = {
  stripe: { label: 'Stripe', tileFt: 1.5 },
  grasscloth: { label: 'Grasscloth', tileFt: 2 },
  geometric: { label: 'Geometric', tileFt: 1.25 },
  linen: { label: 'Linen', tileFt: 1 },
}

// How shiny a painted wall is. Rougher reads matte; walls are never glossy enough to look like plastic.
export const WALL_SHEENS = {
  matte: { label: 'Matte', roughness: 0.95 },
  eggshell: { label: 'Eggshell', roughness: 0.8 },
  satin: { label: 'Satin', roughness: 0.6 },
}

// Floor finish multiplies the material's own roughness.
export const FLOOR_SHEENS = {
  matte: { label: 'Matte', factor: 1.15 },
  satin: { label: 'Satin', factor: 0.8 },
  polished: { label: 'Polished', factor: 0.45 },
}

export const FLOOR_ROTATIONS = [0, 45, 90]
export const FLOOR_SCALE = [0.5, 2]

/**
 * How many times a texture repeats across a surface so one tile always covers `tileFt × scale` feet,
 * whatever the room size. Never zero.
 */
export function textureRepeat(spanFt, tileFt, scale = 1) {
  return Math.max(0.05, spanFt / (tileFt * scale))
}

/** Roughness for a floor material with a finish, kept in a physically plausible range. */
export function floorRoughness(materialRoughness, sheen = 'matte') {
  return Math.min(1, Math.max(0.12, materialRoughness * (FLOOR_SHEENS[sheen]?.factor ?? 1)))
}

export const wallRoughness = (sheen) => WALL_SHEENS[sheen]?.roughness ?? WALL_SHEENS.matte.roughness
