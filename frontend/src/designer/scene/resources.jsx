import { useEffect, useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry } from 'three'
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
    const material = (color, { roughness = 0.75, metalness = 0, transparent = false, opacity = 1 } = {}) => {
      const key = `${color}|${roughness}|${metalness}|${opacity}`
      if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({ color, roughness, metalness, transparent, opacity }))
      return materials.get(key)
    }
    return { box, cylinder, cone, upright, sphere, material, dispose: () => {
      for (const g of [box, cylinder, cone, upright, sphere]) g.dispose()
      for (const m of materials.values()) m.dispose()
    } }
  }, [])
  useEffect(() => () => value.dispose(), [value])
  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>
}
