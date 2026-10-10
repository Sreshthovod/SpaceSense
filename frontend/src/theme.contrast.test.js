import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Reads the colour tokens straight from index.css, so a palette change is checked automatically.
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const block = (selector) => css.slice(css.indexOf(selector)).split('}')[0]
const tokens = (text) => Object.fromEntries([...text.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))

const light = tokens(block('@theme {'))
light.white = '#ffffff'
const dark = { ...light, ...tokens(block(":root[data-theme='dark'] {")) }

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Text colour on background, and the WCAG AA minimum for normal-size text.
const PAIRS = [
  ['ink', 'cream'], ['ink', 'white'], ['ink', 'sand'],
  ['muted', 'cream'], ['muted', 'white'],
  ['sage-dark', 'cream'], ['sage-dark', 'white'],
  ['cream', 'ink'], // buttons: cream text on ink
]

describe('theme contrast', () => {
  it.each([['light', light], ['dark', dark]])('%s theme text is readable (at least 4.5:1)', (_, t) => {
    for (const [fg, bg] of PAIRS) {
      expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
