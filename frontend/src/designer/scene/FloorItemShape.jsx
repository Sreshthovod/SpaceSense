import Part from './Part'
import { useResources } from './useResources'

const WOOD = '#8b6a45'
const DARK = '#3b2f2a'
const DRAWER_LINES = { 'tv-unit': 1, 'bedside-table': 2, dresser: 3 }

/**
 * Low-poly furniture built from shared unit shapes. Local space: origin at the centre of the footprint
 * on the floor, y up, front facing +z. Sizes are already scaled.
 */
export default function FloorItemShape({ catalogId, w, d, h, color }) {
  const { upright, sphere, cone, material } = useResources()
  const m = material(color)
  switch (catalogId) {
    case 'sofa':
    case 'armchair': {
      const arm = Math.min(0.45, w * 0.14)
      const back = Math.min(0.7, d * 0.25)
      const seatTop = h * 0.36
      return (
        <>
          <Part position={[0, 0.15, 0]} scale={[w, 0.3, d]} mat={material(DARK)} />
          <Part position={[0, (0.3 + seatTop) / 2, back / 2]} scale={[w - arm * 2, seatTop - 0.3, d - back]} mat={m} />
          <Part position={[0, (0.3 + h) / 2, -d / 2 + back / 2]} scale={[w, h - 0.3, back]} mat={m} />
          {[-1, 1].map((side) => (
            <Part key={side} position={[side * (w / 2 - arm / 2), 0.3 + (h * 0.72 - 0.3) / 2, 0]} scale={[arm, h * 0.72 - 0.3, d]} mat={m} />
          ))}
        </>
      )
    }
    case 'coffee-table':
    case 'dining-table': {
      const leg = 0.16
      return (
        <>
          <Part position={[0, h - 0.07, 0]} scale={[w, 0.14, d]} mat={m} />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
            <Part key={`${sx}${sz}`} position={[sx * (w / 2 - 0.25), (h - 0.14) / 2, sz * (d / 2 - 0.25)]} scale={[leg, h - 0.14, leg]} mat={m} />
          ))}
        </>
      )
    }
    case 'side-table':
      return (
        <>
          <Part geometry={upright} position={[0, h - 0.05, 0]} scale={[w, 0.1, d]} mat={m} />
          <Part geometry={upright} position={[0, (h - 0.1) / 2, 0]} scale={[0.16, h - 0.1, 0.16]} mat={m} />
          <Part geometry={upright} position={[0, 0.03, 0]} scale={[w * 0.6, 0.06, d * 0.6]} mat={m} />
        </>
      )
    case 'bed': {
      const frame = 1.0
      return (
        <>
          <Part position={[0, frame / 2, 0]} scale={[w, frame, d]} mat={material(WOOD)} />
          <Part position={[0, frame + 0.35, 0.15]} scale={[w - 0.25, 0.7, d - 0.5]} mat={m} />
          <Part position={[0, h / 2, -d / 2 + 0.15]} scale={[w, h, 0.3]} mat={material(WOOD)} />
          {[-1, 1].map((side) => (
            <Part key={side} position={[side * w * 0.22, frame + 0.85, -d / 2 + 0.9]} scale={[w * 0.36, 0.3, 0.9]} mat={material('#f7f5f0')} />
          ))}
          <Part position={[0, frame + 0.74, d * 0.22]} scale={[w - 0.15, 0.1, d * 0.5]} mat={material('#78836a')} />
        </>
      )
    }
    case 'wardrobe':
      return (
        <>
          <Part position={[0, h / 2, 0]} scale={[w, h, d]} mat={m} />
          <Part position={[0, h / 2, d / 2 + 0.01]} scale={[0.03, h - 0.3, 0.02]} mat={material(DARK)} />
          {[-1, 1].map((side) => (
            <Part key={side} position={[side * 0.18, h * 0.5, d / 2 + 0.04]} scale={[0.05, 0.8, 0.06]} mat={material('#c4a35a', { metalness: 0.5, roughness: 0.4 })} />
          ))}
        </>
      )
    case 'bookshelf': {
      const shelves = 5
      const books = ['#a65f3c', '#5b6650', '#e0b25a', '#3d5a4a', '#c9b9a6']
      return (
        <>
          {[-1, 1].map((side) => (
            <Part key={side} position={[side * (w / 2 - 0.05), h / 2, 0]} scale={[0.1, h, d]} mat={m} />
          ))}
          <Part position={[0, h / 2, -d / 2 + 0.025]} scale={[w, h, 0.05]} mat={m} />
          {Array.from({ length: shelves + 1 }, (_, i) => (
            <Part key={i} position={[0, 0.04 + (i * (h - 0.08)) / shelves, 0]} scale={[w - 0.2, 0.08, d]} mat={m} />
          ))}
          {Array.from({ length: shelves }, (_, i) => (
            <Part key={`b${i}`} position={[-w / 4 + (i % 2) * 0.4, 0.08 + (i * (h - 0.08)) / shelves + 0.4, 0]} scale={[w * 0.35, 0.75, d * 0.7]} mat={material(books[i])} />
          ))}
        </>
      )
    }
    case 'rug':
      return (
        <>
          <Part position={[0, 0.015, 0]} scale={[w, 0.03, d]} mat={m} />
          <Part position={[0, 0.02, 0]} scale={[w * 0.82, 0.032, d * 0.86]} mat={material('#e0c9a6', { roughness: 1 })} />
          <Part position={[0, 0.025, 0]} scale={[w * 0.5, 0.034, d * 0.6]} mat={m} />
        </>
      )
    case 'plant':
      return (
        <>
          <Part geometry={upright} position={[0, h * 0.14, 0]} scale={[w * 0.55, h * 0.28, d * 0.55]} mat={material('#a65f3c')} />
          <Part geometry={sphere} position={[0, h * 0.58, 0]} scale={[w, h * 0.55, d]} mat={m} />
          <Part geometry={sphere} position={[w * 0.12, h * 0.84, -d * 0.08]} scale={[w * 0.7, h * 0.35, d * 0.7]} mat={material('#5b6650')} />
        </>
      )
    case 'floor-lamp':
      return (
        <>
          <Part geometry={upright} position={[0, 0.04, 0]} scale={[w * 0.55, 0.08, d * 0.55]} mat={material(DARK)} />
          <Part geometry={upright} position={[0, (h - 0.8) / 2, 0]} scale={[0.08, h - 0.8, 0.08]} mat={material(DARK)} />
          <Part geometry={cone} position={[0, h - 0.45, 0]} scale={[w, 0.9, d]} mat={m} />
        </>
      )
    case 'dining-chair':
    case 'desk-chair': {
      const seat = h * 0.45
      const desk = catalogId === 'desk-chair'
      return (
        <>
          {desk ? (
            <>
              <Part geometry={upright} position={[0, 0.06, 0]} scale={[w * 0.9, 0.08, d * 0.9]} mat={material(DARK)} />
              <Part geometry={upright} position={[0, seat / 2, 0]} scale={[0.15, seat, 0.15]} mat={material(DARK, { metalness: 0.4, roughness: 0.5 })} />
            </>
          ) : (
            [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
              <Part key={`${sx}${sz}`} position={[sx * (w / 2 - 0.12), seat / 2, sz * (d / 2 - 0.12)]} scale={[0.1, seat, 0.1]} mat={m} />
            ))
          )}
          <Part position={[0, seat + 0.1, 0]} scale={[w * (desk ? 0.85 : 1), 0.2, d * 0.85]} mat={m} />
          <Part position={[0, seat + (h - seat) / 2, -d / 2 + 0.12]} scale={[w * (desk ? 0.8 : 1), h - seat, 0.16]} mat={m} />
        </>
      )
    }
    case 'study-desk':
    case 'bedside-table':
    case 'dresser':
    case 'tv-unit': {
      // A cabinet or desk top on a body; drawers are drawn as thin lines on the front.
      const open = catalogId === 'study-desk'
      return (
        <>
          <Part position={[0, h - 0.06, 0]} scale={[w, 0.12, d]} mat={m} />
          {open ? (
            <>
              <Part position={[-w / 2 + 0.08, (h - 0.12) / 2, 0]} scale={[0.12, h - 0.12, d]} mat={m} />
              <Part position={[w / 2 - 0.45, (h - 0.12) / 2, 0]} scale={[0.9, h - 0.12, d]} mat={m} />
            </>
          ) : (
            <>
              <Part position={[0, (h - 0.12) / 2 + 0.08, 0]} scale={[w, h - 0.2, d]} mat={m} />
              {Array.from({ length: DRAWER_LINES[catalogId] }, (_, i) => (
                <Part key={i} position={[0, 0.08 + ((h - 0.2) * (i + 1)) / (DRAWER_LINES[catalogId] + 1), d / 2 + 0.005]} scale={[w * 0.9, 0.02, 0.01]} mat={material(DARK)} />
              ))}
              <Part position={[0, 0.04, 0]} scale={[w * 0.95, 0.08, d * 0.95]} mat={material(DARK)} />
            </>
          )}
        </>
      )
    }
    case 'bunk-bed': {
      const post = 0.25
      return (
        <>
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
            <Part key={`${sx}${sz}`} position={[sx * (w / 2 - post / 2), h / 2, sz * (d / 2 - post / 2)]} scale={[post, h, post]} mat={m} />
          ))}
          {[1.0, h * 0.62].map((y) => (
            <group key={y}>
              <Part position={[0, y, 0]} scale={[w, 0.2, d]} mat={m} />
              <Part position={[0, y + 0.25, 0]} scale={[w - 0.2, 0.35, d - 0.3]} mat={material('#f7f5f0')} />
            </group>
          ))}
          <Part position={[w / 2 - 0.05, h * 0.45, d / 2 - 0.6]} scale={[0.08, h * 0.8, 0.9]} mat={m} />
        </>
      )
    }
    case 'table-lamp':
      return (
        <>
          <Part geometry={upright} position={[0, 0.04, 0]} scale={[w * 0.55, 0.08, d * 0.55]} mat={material('#b8995a', { metalness: 0.5, roughness: 0.4 })} />
          <Part geometry={upright} position={[0, h * 0.35, 0]} scale={[0.07, h * 0.6, 0.07]} mat={material('#b8995a', { metalness: 0.5, roughness: 0.4 })} />
          <Part geometry={cone} position={[0, h - h * 0.2, 0]} scale={[w, h * 0.4, d]} mat={m} />
        </>
      )
    case 'small-plant':
      return (
        <>
          <Part geometry={upright} position={[0, h * 0.2, 0]} scale={[w * 0.7, h * 0.4, d * 0.7]} mat={material('#e9e4dc')} />
          <Part geometry={sphere} position={[0, h * 0.65, 0]} scale={[w, h * 0.65, d]} mat={m} />
        </>
      )
    case 'vase':
      return (
        <>
          <Part geometry={sphere} position={[0, h * 0.35, 0]} scale={[w, h * 0.7, d]} mat={m} />
          <Part geometry={upright} position={[0, h * 0.8, 0]} scale={[w * 0.45, h * 0.4, d * 0.45]} mat={m} />
        </>
      )
    case 'pouf':
      return (
        <>
          <Part geometry={upright} position={[0, h / 2, 0]} scale={[w, h, d]} mat={m} />
          <Part geometry={upright} position={[0, h + 0.01, 0]} scale={[w * 0.4, 0.02, d * 0.4]} mat={material('#a3834f')} />
        </>
      )
    default:
      return <Part position={[0, h / 2, 0]} scale={[w, h, d]} mat={m} />
  }
}
