import { describe, expect, it } from 'vitest'
import { fileFromDataUrl } from './dataUrlFile'

describe('fileFromDataUrl', () => {
  it('turns a base64 image data URL into a named File', () => {
    const file = fileFromDataUrl('data:image/png;base64,aGVsbG8=', 'edited-room')
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('edited-room.png')
    expect(file.type).toBe('image/png')
    expect(file.size).toBe(5)
  })

  it('returns null for anything that is not an image data URL', () => {
    expect(fileFromDataUrl(null)).toBeNull()
    expect(fileFromDataUrl('https://example.com/a.png')).toBeNull()
    expect(fileFromDataUrl('data:text/plain;base64,aGVsbG8=')).toBeNull()
  })
})
