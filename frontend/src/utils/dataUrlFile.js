const EXTENSIONS = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }

/** Turns a base64 `data:image/...` URL (as returned by /generate-design) into a File, or null if it isn't one. */
export function fileFromDataUrl(dataUrl, baseName = 'edited-room') {
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl || '')
  if (!match) return null
  try {
    const type = match[1].toLowerCase()
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], `${baseName}.${EXTENSIONS[type] || 'jpg'}`, { type })
  } catch {
    return null
  }
}
