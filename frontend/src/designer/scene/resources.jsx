import { useEffect, useMemo } from 'react'
import {
  BoxGeometry, CanvasTexture, CylinderGeometry, EdgesGeometry, LineBasicMaterial, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, SphereGeometry,
} from 'three'
import { ResourcesContext } from './useResources'

/**
 * Geometries and materials shared by every placed item, so 30 items don't mean 30 copies on the GPU.
 * Shapes are unit-sized and scaled per mesh; materials are cached by colour. Everything is disposed
 * when the designer closes.
 */
export function ResourcesProvider({ children }) {
  const value = useMemo(() => {
    const box = new BoxGeometry(1, 1, 1)
    const cylinder = new CylinderGeometry(0.5, 0.5, 1, 32)
    cylinder.rotateX(Math.PI / 2) // axis out of the wall
    const cone = new CylinderGeometry(0.3, 0.5, 1, 24, 1, true)
    const upright = new CylinderGeometry(0.5, 0.5, 1, 24) // axis vertical, for floor items
    const sphere = new SphereGeometry(0.5, 16, 12)
    const materials = new Map()
    // Physically plausible finishes: nothing glossy enough to look like plastic, no mirror metals
    // (there's nothing in the scene for them to reflect).
    const PRESETS = {
      fabric: { roughness: 0.92 },
      wood: { roughness: 0.62 },
      lacquer: { roughness: 0.38 },
      metal: { roughness: 0.42, metalness: 0.55 },
      ceramic: { roughness: 0.32 },
    }
    const material = (color, options = {}) => {
      const { roughness = 0.75, metalness = 0, transparent = false, opacity = 1 } = typeof options === 'string' ? PRESETS[options] || {} : options
      const key = `${color}|${roughness}|${metalness}|${opacity}`
      if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({ color, roughness, metalness, transparent, opacity }))
      return materials.get(key)
    }
    // A soft dark blob laid under each floor piece, so furniture reads as standing on the floor.
    const plane = new PlaneGeometry(1, 1)
    plane.rotateX(-Math.PI / 2)
    const blob = document.createElement('canvas')
    blob.width = 64
    blob.height = 64
    const g = blob.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32)
      grad.addColorStop(0, 'rgba(0,0,0,0.55)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
    }
    const blobTexture = new CanvasTexture(blob)
    const contact = new MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, opacity: 0.5 })
    // Outline boxes: sage for the selection, a light version for hover.
    const edges = new EdgesGeometry(box)
    const outline = new LineBasicMaterial({ color: '#5b6650' })
    const hoverOutline = new LineBasicMaterial({ color: '#5b6650', transparent: true, opacity: 0.4 })
    return { box, cylinder, cone, upright, sphere, plane, contact, edges, outline, hoverOutline, material, dispose: () => {
      for (const geo of [box, cylinder, cone, upright, sphere, plane, edges]) geo.dispose()
      outline.dispose()
      hoverOutline.dispose()
      for (const m of materials.values()) m.dispose()
      contact.dispose()
      blobTexture.dispose()
    } }
  }, [])
  useEffect(() => () => value.dispose(), [value])
  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>
}
