import Part from './Part'
import { useResources } from './useResources'
import { L_SOFA_CHAISE, L_SOFA_SEAT } from '../model/catalog'

const WOOD = '#8b6a45'
const DARK = '#3b2f2a'
const COUNTER = '#d8d4cc'
// Brushed steel: only slightly metallic, since there's no environment for a true metal to reflect.
const STEEL = { metalness: 0.3, roughness: 0.4 }
const DRAWER_LINES = { 'tv-unit': 1, 'bedside-table': 2, dresser: 3 }

/**
 * Low-poly furniture built from shared unit shapes. Local space: origin at the centre of the footprint
 * on the floor, y up, front facing +z. Sizes are already scaled.
 */
// The main finish of each piece's body.
const FINISH = {
  sofa: 'fabric', armchair: 'fabric', 'desk-chair': 'fabric', bed: 'fabric', pouf: 'fabric', rug: 'fabric',
  'tv-unit': 'lacquer', 'bedside-table': 'lacquer', dresser: 'lacquer', 'study-desk': 'lacquer',
  'l-sofa': 'fabric', 'bean-bag': 'fabric', 'single-bed': 'fabric', 'shoe-cabinet': 'lacquer', 'dressing-table': 'lacquer',
  'filing-cabinet': 'metal', 'work-lamp': 'metal', 'toy-storage': 'lacquer', 'base-cabinet': 'lacquer', 'sink-cabinet': 'lacquer',
  'corner-cabinet': 'lacquer', 'tall-cabinet': 'lacquer', stove: 'lacquer', fridge: 'lacquer', 'bar-stool': 'metal', 'kitchen-trolley': 'metal',
  bench: 'fabric', recliner: 'fabric', divan: 'fabric', 'pooja-unit': 'lacquer', 'upright-piano': 'lacquer', crib: 'lacquer',
  vase: 'ceramic', 'table-lamp': 'fabric', 'floor-lamp': 'fabric', plant: 'fabric', 'small-plant': 'fabric',
}

export default function FloorItemShape({ catalogId, w, d, h, color }) {
  const { upright, sphere, cone, material } = useResources()
  const m = material(color, FINISH[catalogId] || 'wood')
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
    // Kitchen base units: a counter on a carcass with a recessed plinth, doors drawn on the front.
    case 'base-cabinet':
    case 'sink-cabinet':
    case 'corner-cabinet':
    case 'stove': {
      const top = 0.12
      const plinth = 0.33
      const doors = Math.max(1, Math.round(w / 1.5))
      const lineMat = material('#9a9a94')
      return (
        <>
          <Part position={[0, plinth / 2, -0.08]} scale={[w, plinth, d - 0.16]} mat={material(DARK)} />
          <Part position={[0, (plinth + h - top) / 2, 0]} scale={[w, h - top - plinth, d]} mat={m} />
          <Part position={[0, h - top / 2, 0.03]} scale={[w, top, d + 0.06]} mat={material(COUNTER, 'ceramic')} />
          {Array.from({ length: doors - 1 }, (_, i) => (
            <Part key={i} position={[-w / 2 + (w * (i + 1)) / doors, (plinth + h - top) / 2, d / 2 + 0.005]} scale={[0.02, h - top - plinth - 0.1, 0.01]} mat={lineMat} />
          ))}
          {Array.from({ length: doors }, (_, i) => (
            <Part key={`h${i}`} position={[-w / 2 + (w * (i + 0.5)) / doors, h - top - 0.3, d / 2 + 0.03]} scale={[Math.min(0.5, w / doors - 0.4), 0.04, 0.04]} mat={material('#5c5f55', STEEL)} />
          ))}
          {catalogId === 'sink-cabinet' && (
            <>
              <Part position={[0, h - 0.06, 0.05]} scale={[w * 0.55, 0.02, d * 0.55]} mat={material('#b9bcbf', STEEL)} />
              <Part geometry={upright} position={[0, h + 0.35, -d / 2 + 0.3]} scale={[0.08, 0.7, 0.08]} mat={material('#b9bcbf', STEEL)} />
              <Part position={[0, h + 0.68, -d / 2 + 0.45]} scale={[0.07, 0.07, 0.35]} mat={material('#b9bcbf', STEEL)} />
            </>
          )}
          {catalogId === 'stove' && (
            <>
              <Part position={[0, h + 0.01, 0.03]} scale={[w * 0.85, 0.03, d * 0.75]} mat={material('#1f2120', { roughness: 0.25 })} />
              {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
                <Part key={`${sx}${sz}`} geometry={upright} position={[sx * w * 0.2, h + 0.035, sz * d * 0.17 + 0.03]} scale={[0.5, 0.02, 0.5]} mat={material('#3b3f3a', STEEL)} />
              ))}
            </>
          )}
        </>
      )
    }
    case 'tall-cabinet':
    case 'fridge': {
      const fridge = catalogId === 'fridge'
      const split = fridge ? h * 0.32 : h * 0.6
      return (
        <>
          <Part position={[0, h / 2, 0]} scale={[w, h, d]} mat={m} />
          <Part position={[0, split, d / 2 + 0.005]} scale={[w - 0.05, 0.03, 0.01]} mat={material(fridge ? '#8a8d90' : '#9a9a94')} />
          {!fridge && <Part position={[0, h / 2, d / 2 + 0.005]} scale={[0.02, h - 0.1, 0.01]} mat={material('#9a9a94')} />}
          {(fridge ? [split - 0.6, split + 0.7] : [split - 0.4, split + 0.4]).map((y) => (
            <Part key={y} position={[fridge ? w / 2 - 0.2 : 0.12, y, d / 2 + 0.05]} scale={[0.05, fridge ? 0.9 : 0.4, 0.06]} mat={material('#5c5f55', STEEL)} />
          ))}
        </>
      )
    }
    case 'kitchen-island': {
      const top = 0.14
      return (
        <>
          <Part position={[0, (h - top) / 2, -0.4]} scale={[w - 0.3, h - top, d - 1]} mat={m} />
          <Part position={[0, h - top / 2, 0]} scale={[w, top, d]} mat={material(COUNTER, 'ceramic')} />
        </>
      )
    }
    case 'bar-stool': {
      const seat = h - 0.12
      const metal = material(DARK, STEEL)
      return (
        <>
          <Part geometry={upright} position={[0, 0.03, 0]} scale={[w * 0.75, 0.06, d * 0.75]} mat={metal} />
          <Part geometry={upright} position={[0, seat / 2, 0]} scale={[0.12, seat, 0.12]} mat={metal} />
          <Part geometry={upright} position={[0, h * 0.32, 0]} scale={[w * 0.6, 0.04, d * 0.6]} mat={metal} />
          <Part geometry={upright} position={[0, seat + 0.06, 0]} scale={[w, 0.12, d]} mat={m} />
        </>
      )
    }
    case 'kitchen-trolley': {
      const post = 0.08
      return (
        <>
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
            <Part key={`${sx}${sz}`} position={[sx * (w / 2 - post / 2), h / 2, sz * (d / 2 - post / 2)]} scale={[post, h, post]} mat={m} />
          ))}
          {[0.4, h * 0.55, h - 0.04].map((y) => <Part key={y} position={[0, y, 0]} scale={[w, 0.06, d]} mat={m} />)}
        </>
      )
    }
    case 'sideboard':
    case 'shoe-cabinet':
    case 'toy-storage': {
      // A cabinet on short legs (sideboard, shoe cabinet) or a cube unit with coloured bins (toys).
      const toys = catalogId === 'toy-storage'
      const legs = toys ? 0 : 0.35
      const body = h - legs
      const cols = toys ? Math.max(2, Math.round(w / 1)) : catalogId === 'sideboard' ? 3 : 1
      const rows = toys ? 2 : catalogId === 'shoe-cabinet' ? 2 : 1
      const bins = ['#e0b25a', '#7f9a8c', '#d9a98b', '#9fb3bf']
      return (
        <>
          {legs > 0 && [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
            <Part key={`${sx}${sz}`} position={[sx * (w / 2 - 0.15), legs / 2, sz * (d / 2 - 0.15)]} scale={[0.08, legs, 0.08]} mat={material(DARK)} />
          ))}
          <Part position={[0, legs + body / 2, 0]} scale={[w, body, d]} mat={m} />
          {Array.from({ length: cols * rows }, (_, i) => {
            const c = i % cols
            const r = Math.floor(i / cols)
            const cw = w / cols
            const rh = body / rows
            const x = -w / 2 + cw * (c + 0.5)
            const y = legs + rh * (r + 0.5)
            return toys ? (
              <Part key={i} position={[x, y, d / 2 - 0.3]} scale={[cw - 0.15, rh - 0.15, 0.62]} mat={material(bins[i % bins.length], 'fabric')} />
            ) : (
              <group key={i}>
                <Part position={[x, y, d / 2 + 0.005]} scale={[cw - 0.06, rh - 0.06, 0.01]} mat={material(color, { roughness: 0.5 })} />
                <Part position={[x, y + rh / 2 - 0.2, d / 2 + 0.03]} scale={[Math.min(0.4, cw * 0.4), 0.04, 0.04]} mat={material('#c4a35a', STEEL)} />
              </group>
            )
          })}
        </>
      )
    }
    case 'filing-cabinet':
      return (
        <>
          <Part position={[0, h / 2 + 0.04, 0]} scale={[w, h - 0.08, d]} mat={m} />
          {Array.from({ length: 3 }, (_, i) => (
            <group key={i}>
              <Part position={[0, 0.08 + ((h - 0.1) * (i + 1)) / 3, d / 2 + 0.005]} scale={[w * 0.92, 0.02, 0.01]} mat={material(DARK)} />
              <Part position={[0, 0.08 + ((h - 0.1) * (i + 0.6)) / 3, d / 2 + 0.03]} scale={[0.35, 0.04, 0.04]} mat={material(DARK, STEEL)} />
            </group>
          ))}
          <Part geometry={upright} position={[0, 0.04, 0]} scale={[w * 0.9, 0.08, d * 0.9]} mat={material(DARK)} />
        </>
      )
    case 'dressing-table': {
      const leg = 0.12
      return (
        <>
          <Part position={[0, h - 0.06, 0]} scale={[w, 0.12, d]} mat={m} />
          <Part position={[w / 4, h - 0.4, 0]} scale={[w / 2 - 0.1, 0.5, d - 0.1]} mat={m} />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
            <Part key={`${sx}${sz}`} position={[sx * (w / 2 - 0.12), (h - 0.12) / 2, sz * (d / 2 - 0.12)]} scale={[leg, h - 0.12, leg]} mat={m} />
          ))}
          <Part position={[0, h + 1.1, -d / 2 + 0.1]} scale={[w * 0.6, 2.2, 0.08]} mat={m} />
          <Part position={[0, h + 1.1, -d / 2 + 0.15]} scale={[w * 0.52, 2.0, 0.01]} mat={material('#dfe8ec', { roughness: 0.15, metalness: 0.1 })} />
        </>
      )
    }
    case 'single-bed': {
      const frame = 1.0
      return (
        <>
          <Part position={[0, frame / 2, 0]} scale={[w, frame, d]} mat={material(WOOD)} />
          <Part position={[0, frame + 0.3, 0.1]} scale={[w - 0.2, 0.6, d - 0.4]} mat={m} />
          <Part position={[0, h / 2, -d / 2 + 0.12]} scale={[w, h, 0.24]} mat={material(WOOD)} />
          <Part position={[0, frame + 0.75, -d / 2 + 0.8]} scale={[w * 0.7, 0.28, 0.8]} mat={material('#f7f5f0')} />
          <Part position={[0, frame + 0.64, d * 0.18]} scale={[w - 0.1, 0.1, d * 0.55]} mat={material('#9fb3bf', 'fabric')} />
        </>
      )
    }
    case 'l-sofa': {
      // A three-seater along the back plus a chaise coming forward on the right.
      const arm = 0.45
      const back = 0.75
      const seatTop = h * 0.36
      const seatD = d * L_SOFA_SEAT // the same proportions the collision shape uses
      const chaise = w * L_SOFA_CHAISE
      return (
        <>
          <Part position={[0, 0.15, -d / 2 + seatD / 2]} scale={[w, 0.3, seatD]} mat={material(DARK)} />
          <Part position={[w / 2 - chaise / 2, 0.15, seatD / 2]} scale={[chaise, 0.3, d - seatD]} mat={material(DARK)} />
          <Part position={[-arm / 2, (0.3 + seatTop) / 2, -d / 2 + back + (seatD - back) / 2]} scale={[w - arm, seatTop - 0.3, seatD - back]} mat={m} />
          <Part position={[w / 2 - arm - (chaise - arm) / 2, (0.3 + seatTop) / 2, seatD / 2]} scale={[chaise - arm, seatTop - 0.3, d - seatD]} mat={m} />
          <Part position={[0, (0.3 + h) / 2, -d / 2 + back / 2]} scale={[w, h - 0.3, back]} mat={m} />
          <Part position={[-w / 2 + arm / 2, 0.3 + (h * 0.72 - 0.3) / 2, -d / 2 + seatD / 2]} scale={[arm, h * 0.72 - 0.3, seatD]} mat={m} />
          <Part position={[w / 2 - arm / 2, 0.3 + (h * 0.72 - 0.3) / 2, 0]} scale={[arm, h * 0.72 - 0.3, d]} mat={m} />
        </>
      )
    }
    case 'bean-bag':
      return (
        <>
          <Part geometry={sphere} position={[0, h * 0.38, 0.1]} scale={[w, h * 0.76, d * 0.92]} mat={m} />
          <Part geometry={sphere} position={[0, h * 0.62, -d * 0.22]} scale={[w * 0.8, h * 0.76, d * 0.5]} mat={m} />
        </>
      )
    case 'work-lamp': {
      const metal = material(color, STEEL)
      return (
        <>
          <Part geometry={upright} position={[0, 0.04, 0]} scale={[w * 0.8, 0.08, w * 0.8]} mat={metal} />
          <Part position={[0, h * 0.3, -0.1]} rotation={[-0.35, 0, 0]} scale={[0.05, h * 0.55, 0.05]} mat={metal} />
          <Part position={[0, h * 0.72, d * 0.12]} rotation={[0.9, 0, 0]} scale={[0.05, h * 0.45, 0.05]} mat={metal} />
          <Part geometry={cone} position={[0, h * 0.82, d / 2 - 0.15]} rotation={[Math.PI * 0.85, 0, 0]} scale={[0.4, 0.35, 0.4]} mat={metal} />
        </>
      )
    }
    case 'bench': {
      const leg = 0.14
      return (
        <>
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
            <Part key={`${sx}${sz}`} position={[sx * (w / 2 - 0.2), h * 0.3, sz * (d / 2 - 0.2)]} scale={[leg, h * 0.6, leg]} mat={material(WOOD)} />
          ))}
          <Part position={[0, h * 0.62, 0]} scale={[w, 0.12, d]} mat={material(WOOD)} />
          <Part position={[0, h * 0.82, 0]} scale={[w - 0.1, h * 0.3, d - 0.1]} mat={m} />
        </>
      )
    }
    case 'recliner': {
      const arm = 0.55
      const seatTop = h * 0.4
      return (
        <>
          <Part position={[0, 0.12, 0]} scale={[w * 0.9, 0.24, d * 0.85]} mat={material(DARK)} />
          <Part position={[0, seatTop / 2 + 0.1, 0.25]} scale={[w - arm * 2, seatTop, d - 0.9]} mat={m} />
          <Part position={[0, h * 0.55, -d / 2 + 0.45]} rotation={[-0.18, 0, 0]} scale={[w - arm * 2 + 0.1, h * 0.95, 0.75]} mat={m} />
          <Part position={[0, h * 0.62, -d / 2 + 0.3]} scale={[w * 0.4, 0.45, 0.4]} mat={m} />
          {[-1, 1].map((side) => (
            <Part key={side} position={[side * (w / 2 - arm / 2), h * 0.32, 0]} scale={[arm, h * 0.6, d * 0.92]} mat={m} />
          ))}
        </>
      )
    }
    case 'divan': {
      const base = h * 0.5
      return (
        <>
          <Part position={[0, base / 2, 0]} scale={[w, base, d]} mat={material(WOOD)} />
          <Part position={[0, base + 0.25, 0]} scale={[w - 0.15, 0.5, d - 0.15]} mat={m} />
          {[-1, 1].map((side) => (
            <Part key={side} geometry={upright} position={[side * (w / 2 - 0.4), base + 0.75, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.55, d - 0.4, 0.55]} mat={material('#e0b25a', 'fabric')} />
          ))}
          {[-0.28, 0, 0.28].map((f) => (
            <Part key={f} position={[f * w, base + 0.85, -d / 2 + 0.35]} rotation={[-0.2, 0, 0]} scale={[w * 0.24, 0.85, 0.3]} mat={material('#f2eadc', 'fabric')} />
          ))}
        </>
      )
    }
    case 'jhoola': {
      const post = 0.2
      const seatY = 1.6
      return (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              {[-1, 1].map((fz) => (
                <Part key={fz} position={[side * (w / 2 - post), h / 2, fz * (d / 2 - post) * 0.7]} rotation={[fz * 0.18, 0, 0]} scale={[post, h, post]} mat={m} />
              ))}
              <Part position={[side * (w / 2 - post), 0.06, 0]} scale={[post, 0.12, d]} mat={m} />
              <Part position={[side * (w / 2 - 0.6), (seatY + h - 0.2) / 2, 0]} scale={[0.04, h - 0.2 - seatY, 0.04]} mat={material('#9a9488', STEEL)} />
            </group>
          ))}
          <Part position={[0, h - 0.1, 0]} scale={[w, 0.2, post]} mat={m} />
          <Part position={[0, seatY, 0.1]} scale={[w - 1, 0.14, d * 0.6]} mat={m} />
          <Part position={[0, seatY + 0.7, -d * 0.2]} rotation={[-0.15, 0, 0]} scale={[w - 1, 1.3, 0.1]} mat={m} />
          <Part position={[0, seatY + 0.14, 0.1]} scale={[w - 1.2, 0.18, d * 0.55]} mat={material('#a4452c', 'fabric')} />
        </>
      )
    }
    case 'console-table':
      return (
        <>
          <Part position={[0, h - 0.06, 0]} scale={[w, 0.12, d]} mat={m} />
          <Part position={[0, 0.5, 0]} scale={[w - 0.3, 0.08, d - 0.15]} mat={m} />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
            <Part key={`${sx}${sz}`} position={[sx * (w / 2 - 0.12), (h - 0.12) / 2, sz * (d / 2 - 0.12)]} scale={[0.1, h - 0.12, 0.1]} mat={m} />
          ))}
        </>
      )
    case 'round-dining-table':
      return (
        <>
          <Part geometry={upright} position={[0, h - 0.06, 0]} scale={[w, 0.12, d]} mat={m} />
          <Part geometry={upright} position={[0, (h - 0.12) / 2, 0]} scale={[0.45, h - 0.12, 0.45]} mat={m} />
          <Part geometry={upright} position={[0, 0.06, 0]} scale={[w * 0.45, 0.12, d * 0.45]} mat={m} />
        </>
      )
    case 'crib': {
      const bars = Math.max(4, Math.round(d / 0.35))
      return (
        <>
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
            <Part key={`${sx}${sz}`} position={[sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08)]} scale={[0.16, h, 0.16]} mat={m} />
          ))}
          <Part position={[0, 1.2, 0]} scale={[w - 0.1, 0.15, d - 0.1]} mat={m} />
          <Part position={[0, 1.45, 0]} scale={[w - 0.2, 0.35, d - 0.2]} mat={material('#f7f5f0', 'fabric')} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <Part position={[side * (w / 2 - 0.08), h - 0.05, 0]} scale={[0.12, 0.1, d]} mat={m} />
              {Array.from({ length: bars }, (_, i) => (
                <Part key={i} position={[side * (w / 2 - 0.08), (1.2 + h) / 2, -d / 2 + ((i + 0.5) * d) / bars]} scale={[0.06, h - 1.2, 0.06]} mat={m} />
              ))}
            </group>
          ))}
          {[-1, 1].map((end) => (
            <Part key={end} position={[0, (1.2 + h) / 2, end * (d / 2 - 0.08)]} scale={[w, h - 1.2, 0.1]} mat={m} />
          ))}
        </>
      )
    }
    case 'pooja-unit': {
      const cabinet = h * 0.38
      const gold = material('#c9a35f', STEEL)
      return (
        <>
          <Part position={[0, cabinet / 2, 0]} scale={[w, cabinet, d]} mat={material(WOOD, 'lacquer')} />
          <Part position={[0, cabinet + 0.04, 0.05]} scale={[w, 0.08, d]} mat={material('#f2eadc')} />
          {[-1, 1].map((side) => (
            <Part key={side} position={[side * (w / 2 - 0.12), (cabinet + h * 0.88) / 2, d / 2 - 0.15]} scale={[0.2, h * 0.88 - cabinet, 0.2]} mat={material(WOOD, 'lacquer')} />
          ))}
          <Part position={[0, (cabinet + h * 0.88) / 2, -d / 2 + 0.06]} scale={[w - 0.1, h * 0.88 - cabinet, 0.12]} mat={m} />
          <Part position={[0, h * 0.9, 0]} scale={[w, 0.14, d]} mat={material(WOOD, 'lacquer')} />
          <Part geometry={cone} position={[0, h * 0.96, 0]} scale={[w * 0.55, h * 0.1, d * 0.55]} mat={gold} />
          <Part geometry={upright} position={[0, cabinet + 0.14, 0.2]} scale={[0.25, 0.12, 0.25]} mat={gold} />
          <Part geometry={sphere} position={[0, cabinet + 0.28, 0.2]} scale={[0.08, 0.14, 0.08]} mat={material('#f2b84b', { roughness: 0.3 })} />
        </>
      )
    }
    case 'upright-piano': {
      const keyH = h * 0.62
      return (
        <>
          <Part position={[0, h / 2, -0.25]} scale={[w, h, d - 0.5]} mat={m} />
          <Part position={[0, keyH - 0.1, d / 2 - 0.35]} scale={[w - 0.2, 0.2, 0.7]} mat={m} />
          <Part position={[0, keyH + 0.03, d / 2 - 0.3]} scale={[w - 0.6, 0.06, 0.5]} mat={material('#f7f5f0', 'lacquer')} />
          {Array.from({ length: 14 }, (_, i) => (
            <Part key={i} position={[-(w - 0.8) / 2 + (i + 0.5) * ((w - 0.8) / 14), keyH + 0.08, d / 2 - 0.42]} scale={[0.08, 0.05, 0.26]} mat={material('#1f1d1b')} />
          ))}
          {[-1, 1].map((side) => (
            <Part key={side} position={[side * (w / 2 - 0.15), keyH / 2, d / 2 - 0.3]} scale={[0.18, keyH, 0.18]} mat={m} />
          ))}
        </>
      )
    }
    case 'aquarium': {
      const stand = h * 0.48
      return (
        <>
          <Part position={[0, stand / 2, 0]} scale={[w, stand, d]} mat={material(color, 'lacquer')} />
          <Part position={[0, stand + (h - stand) / 2, 0]} scale={[w - 0.1, h - stand - 0.1, d - 0.1]} mat={material('#9fd0de', { roughness: 0.1, transparent: true, opacity: 0.45 })} />
          <Part position={[0, stand + (h - stand) * 0.42, 0]} scale={[w - 0.2, (h - stand) * 0.75, d - 0.2]} mat={material('#3f8fa6', { roughness: 0.2, transparent: true, opacity: 0.35 })} />
          <Part position={[0, stand + 0.08, 0]} scale={[w - 0.2, 0.12, d - 0.2]} mat={material('#d9c09a')} />
          <Part position={[0, h - 0.04, 0]} scale={[w, 0.08, d]} mat={material(color, 'lacquer')} />
        </>
      )
    }
    case 'room-divider': {
      const panels = 4
      const pw = w / panels
      return (
        <>
          {Array.from({ length: panels }, (_, i) => (
            <Part
              key={i}
              position={[-w / 2 + pw * (i + 0.5), h / 2 + 0.1, 0]}
              rotation={[0, i % 2 ? 0.35 : -0.35, 0]}
              scale={[pw * 0.95, h - 0.2, 0.08]}
              mat={i % 2 ? m : material(color, { roughness: 0.9 })}
            />
          ))}
        </>
      )
    }
    default:
      return <Part position={[0, h / 2, 0]} scale={[w, h, d]} mat={m} />
  }
}
