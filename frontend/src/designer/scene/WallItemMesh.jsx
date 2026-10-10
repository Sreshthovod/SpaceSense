import { wallItemSpec } from '../model/catalog'
import Part from './Part'
import { useResources } from './useResources'

/**
 * One wall item in the wall's local space: x along the wall, y up, z out of the wall into the room.
 * Doors and windows are drawn on the wall surface; the wall itself is not cut open.
 */
function Parts({ catalogId, w, h, d, color }) {
  const { cylinder, cone, material } = useResources()
  switch (catalogId) {
    case 'painting':
      return (
        <>
          <Part position={[0, 0, d / 2]} scale={[w, h, d]} mat={material('#3b2f2a')} />
          <Part position={[0, 0, d + 0.005]} scale={[Math.max(0.01, w - 0.24), Math.max(0.01, h - 0.24), 0.01]} mat={material(color, { roughness: 0.9 })} />
        </>
      )
    case 'mirror':
      return (
        <>
          <Part geometry={cylinder} position={[0, 0, d / 2]} scale={[w, h, d]} mat={material(color, { roughness: 0.35, metalness: 0.6 })} />
          <Part geometry={cylinder} position={[0, 0, d + 0.005]} scale={[w - 0.2, h - 0.2, 0.01]} mat={material('#dfe8ec', { roughness: 0.15, metalness: 0.1 })} />
        </>
      )
    case 'clock':
      return (
        <>
          <Part geometry={cylinder} position={[0, 0, d / 2]} scale={[w, h, d]} mat={material(color, { roughness: 0.5, metalness: 0.3 })} />
          <Part geometry={cylinder} position={[0, 0, d + 0.005]} scale={[w - 0.12, h - 0.12, 0.01]} mat={material('#f7f5f0')} />
          <Part position={[0, h * 0.12, d + 0.02]} scale={[0.04, h * 0.28, 0.01]} mat={material(color)} />
          <Part position={[w * 0.16, 0, d + 0.025]} rotation={[0, 0, Math.PI / 2]} scale={[0.035, w * 0.36, 0.01]} mat={material(color)} />
        </>
      )
    case 'shelf':
      return <Part position={[0, 0, d / 2]} scale={[w, h, d]} mat={material(color)} />
    case 'sconce':
      return (
        <>
          <Part position={[0, -0.15, 0.04]} scale={[0.16, h - 0.3, 0.08]} mat={material('#5c5f55', { metalness: 0.4, roughness: 0.5 })} />
          <Part geometry={cone} position={[0, h / 2 - 0.25, d / 2]} scale={[w, 0.45, w]} mat={material(color, { roughness: 0.6 })} />
        </>
      )
    case 'panel': {
      const slats = Math.max(2, Math.round(w / 0.35))
      const slat = w / slats
      return (
        <>
          <Part position={[0, 0, 0.02]} scale={[w, h, 0.04]} mat={material('#5e4636')} />
          {Array.from({ length: slats }, (_, i) => (
            <Part key={i} position={[-w / 2 + slat * (i + 0.5), 0, d / 2 + 0.02]} scale={[slat * 0.76, h, d]} mat={material(color)} />
          ))}
        </>
      )
    }
    case 'curtains': {
      // Two gathered panels hanging from a rod.
      const folds = Math.max(4, Math.round(w / 0.4))
      const fold = w / folds
      return (
        <>
          <Part position={[0, h / 2 + 0.05, d]} scale={[w + 0.4, 0.08, 0.08]} mat={material('#5c5f55', { metalness: 0.5, roughness: 0.4 })} />
          {Array.from({ length: folds }, (_, i) => (
            <Part key={i} position={[-w / 2 + fold * (i + 0.5), 0, d / 2 + (i % 2 ? 0.06 : -0.06)]} scale={[fold * 1.05, h, 0.08]} mat={material(color, { roughness: 1 })} />
          ))}
        </>
      )
    }
    case 'door':
      return (
        <>
          <Part position={[0, 0, 0.03]} scale={[w + 0.3, h + 0.15, 0.06]} mat={material('#f2f0eb')} />
          <Part position={[0, -0.04, d / 2 + 0.03]} scale={[w, h - 0.08, d]} mat={material(color, { roughness: 0.6 })} />
          <Part geometry={cylinder} position={[w / 2 - 0.35, -0.2, d + 0.08]} scale={[0.16, 0.16, 0.1]} mat={material('#c4a35a', { metalness: 0.7, roughness: 0.3 })} />
        </>
      )
    case 'window':
      return (
        <>
          <Part position={[0, 0, 0.04]} scale={[w, h, 0.08]} mat={material('#f2f0eb')} />
          <Part position={[0, 0, 0.085]} scale={[w - 0.3, h - 0.3, 0.01]} mat={material(color, { roughness: 0.1, metalness: 0.2 })} />
          <Part position={[0, 0, 0.1]} scale={[0.1, h - 0.3, 0.03]} mat={material('#f2f0eb')} />
          <Part position={[0, 0, 0.1]} scale={[w - 0.3, 0.1, 0.03]} mat={material('#f2f0eb')} />
          <Part position={[0, -h / 2 - 0.05, 0.25]} scale={[w + 0.2, 0.1, 0.5]} mat={material('#f2f0eb')} />
        </>
      )
    default:
      return <Part position={[0, 0, d / 2]} scale={[w, h, d]} mat={material(color)} />
  }
}

/** A sage frame just behind the selected item, visible against any wall colour. */
function SelectionHalo({ w, h }) {
  const { material } = useResources()
  return <Part position={[0, 0, 0.004]} scale={[w + 0.25, h + 0.25, 0.005]} mat={material('#5b6650', { roughness: 1 })} />
}

export default function WallItemMesh({ item, span, selected, onSelect }) {
  const spec = wallItemSpec(item.catalogId)
  if (!spec) return null
  return (
    <group
      position={[item.x - span / 2, item.y, 0]}
      rotation={[0, 0, (item.rotation * Math.PI) / 180]}
      onClick={(e) => {
        if (e.delta > 4) return // that was an orbit drag, not a click
        e.stopPropagation()
        onSelect(item)
      }}
    >
      <Parts catalogId={item.catalogId} w={item.w} h={item.h} d={spec.size.d} color={spec.color} />
      {selected && <SelectionHalo w={item.w} h={item.h} />}
    </group>
  )
}
