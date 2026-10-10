import { describe, expect, it } from 'vitest'
import { filterCommands, fuzzyScore } from './fuzzy'

const cmds = [
  { id: 'a', label: 'Open the 3D room designer', group: 'Actions' },
  { id: 'b', label: 'Dark theme', group: 'Appearance', keywords: 'mode night' },
  { id: 'c', label: 'Design styles', group: 'Go to' },
]

describe('fuzzy matching', () => {
  it('needs every letter in order', () => {
    expect(fuzzyScore('drk', 'Dark theme')).toBeGreaterThan(0)
    expect(fuzzyScore('krd', 'Dark theme')).toBe(0)
  })

  it('ranks word starts and runs higher', () => {
    expect(fuzzyScore('des', 'Design styles')).toBeGreaterThan(fuzzyScore('des', 'Open the 3D room designer'))
  })

  it('keeps the original order when there is no query', () => {
    expect(filterCommands(cmds, '  ').map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('matches keywords and groups as well as labels', () => {
    expect(filterCommands(cmds, 'night').map((c) => c.id)).toEqual(['b'])
    expect(filterCommands(cmds, 'xyz')).toEqual([])
  })
})
