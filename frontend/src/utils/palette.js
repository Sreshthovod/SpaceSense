function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function bucketColor(data, i) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const a = data[i + 3]
  if (a < 80) return null
  const q = (n) => Math.round(n / 24) * 24
  return rgbToHex(q(r), q(g), q(b))
}

export function samplePalette(url, fallback = []) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(fallback)
      return
    }
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 24
        canvas.height = 24
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, 24, 24)
        const { data } = ctx.getImageData(0, 0, 24, 24)
        const counts = new Map()
        for (let i = 0; i < data.length; i += 4) {
          const hex = bucketColor(data, i)
          if (!hex || hex === '#000000' || hex === '#ffffff') continue
          counts.set(hex, (counts.get(hex) || 0) + 1)
        }
        const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([hex]) => hex)
        resolve(ranked.length ? ranked : fallback)
      } catch {
        resolve(fallback)
      }
    }
    img.onerror = () => resolve(fallback)
    img.src = url
  })
}
