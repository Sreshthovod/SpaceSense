import { useResources } from './useResources'

/**
 * One mesh made from the shared unit geometry (a box unless given) and a shared material, sized by
 * `scale`. dispose={null}: the geometry and material are shared, and ResourcesProvider disposes them.
 */
export default function Part({ geometry, position, scale, mat, rotation }) {
  const { box } = useResources()
  return (
    <mesh geometry={geometry || box} material={mat} position={position} scale={scale} rotation={rotation} castShadow receiveShadow dispose={null} />
  )
}
