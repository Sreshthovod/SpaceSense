/**
 * Procedural items the designer can place. Sizes are in feet. Prices are not here: they come from
 * the backend catalog (phase 5), so an item without a priced catalog match is never given a price.
 *
 * Wall items: `size` is width × height on the wall plus depth out of it. `resize` is 'both', 'width'
 * or 'none'; `lockAspect` keeps the shape when resizing; `floorLocked` keeps the bottom on the floor.
 */
export const WALL_ITEMS = {
  painting: {
    name: 'Framed painting', category: 'paintings-mirrors', size: { w: 2, h: 1.5, d: 0.12 },
    min: { w: 0.75, h: 0.75 }, max: { w: 6, h: 4 }, resize: 'both', rotatable: true, defaultY: 5, color: '#b85c38',
  },
  mirror: {
    name: 'Round mirror', category: 'paintings-mirrors', size: { w: 2, h: 2, d: 0.1 },
    min: { w: 1, h: 1 }, max: { w: 4, h: 4 }, resize: 'both', lockAspect: true, rotatable: false, defaultY: 5, color: '#b8995a',
  },
  shelf: {
    name: 'Floating shelf', category: 'shelves', size: { w: 3, h: 0.15, d: 0.8 },
    min: { w: 1, h: 0.15 }, max: { w: 6, h: 0.15 }, resize: 'width', rotatable: false, defaultY: 4.5, color: '#8b6a45',
  },
  sconce: {
    name: 'Wall lamp', category: 'lamps', size: { w: 0.5, h: 1, d: 0.6 },
    min: { w: 0.5, h: 1 }, max: { w: 0.5, h: 1 }, resize: 'none', rotatable: false, defaultY: 5.5, color: '#c4a35a',
  },
  panel: {
    name: 'Slatted wall panel', category: 'decor', size: { w: 4, h: 7, d: 0.1 },
    min: { w: 1, h: 1 }, max: { w: 12, h: 12 }, resize: 'both', rotatable: false, defaultY: 3.5, color: '#9a6b4f',
  },
  curtains: {
    name: 'Curtains', category: 'curtains', size: { w: 4, h: 7, d: 0.35 },
    min: { w: 2, h: 3 }, max: { w: 12, h: 10 }, resize: 'both', rotatable: false, defaultY: 4, color: '#d8c3a5',
  },
  door: {
    name: 'Door', category: 'openings', opening: true, floorLocked: true, size: { w: 3, h: 7, d: 0.15 },
    min: { w: 2, h: 6 }, max: { w: 6, h: 8 }, resize: 'both', rotatable: false, defaultY: 3.5, color: '#8b6a45',
  },
  window: {
    name: 'Window', category: 'openings', opening: true, size: { w: 4, h: 4, d: 0.15 },
    min: { w: 1.5, h: 1.5 }, max: { w: 10, h: 7 }, resize: 'both', rotatable: false, defaultY: 5, color: '#cfe3ec',
  },
}

export const WALL_DECOR_IDS = ['painting', 'mirror', 'shelf', 'sconce', 'panel', 'curtains']
export const OPENING_IDS = ['door', 'window']

export const wallItemSpec = (catalogId) => WALL_ITEMS[catalogId]

/**
 * Floor items: `size` is width × depth × height in feet at scale 1, front facing +z. `scale` is the
 * allowed resize range (null: fixed size, like a real product). `layer: 'rug'` lies under furniture,
 * so rugs don't collide with it. `againstWall` items start with their back to a wall.
 */
export const FLOOR_ITEMS = {
  sofa: { name: 'Three-seater sofa', category: 'sofas-chairs', size: { w: 7, d: 3, h: 2.8 }, scale: null, againstWall: true, color: '#c9b9a6' },
  armchair: { name: 'Armchair', category: 'sofas-chairs', size: { w: 2.6, d: 2.7, h: 2.7 }, scale: null, color: '#9a6b52' },
  'coffee-table': { name: 'Coffee table', category: 'tables', size: { w: 3.5, d: 2, h: 1.4 }, scale: null, color: '#7a4e2d' },
  'side-table': { name: 'Round side table', category: 'tables', size: { w: 1.5, d: 1.5, h: 1.8 }, scale: null, color: '#b08968' },
  'dining-table': { name: 'Dining table', category: 'tables', size: { w: 5, d: 3, h: 2.5 }, scale: null, color: '#8b6a45' },
  bed: { name: 'Queen bed', category: 'beds', size: { w: 5.3, d: 7, h: 3.4 }, scale: null, againstWall: true, color: '#e4ddd2' },
  wardrobe: { name: 'Two-door wardrobe', category: 'storage', size: { w: 4, d: 2, h: 7 }, scale: null, againstWall: true, color: '#6b4f32' },
  bookshelf: { name: 'Open bookshelf', category: 'storage', size: { w: 3, d: 1.2, h: 6 }, scale: null, againstWall: true, color: '#8b6a45' },
  rug: { name: 'Area rug', category: 'rugs', size: { w: 5, d: 7, h: 0.04 }, scale: [0.5, 2], layer: 'rug', color: '#b85c38' },
  plant: { name: 'Potted plant', category: 'plants', size: { w: 1.5, d: 1.5, h: 4 }, scale: [0.6, 1.5], color: '#6f7f5b' },
  'floor-lamp': { name: 'Floor lamp', category: 'lamps', size: { w: 1.3, d: 1.3, h: 5.2 }, scale: null, color: '#e6dcc8' },
  pouf: { name: 'Woven pouf', category: 'decor', size: { w: 1.6, d: 1.6, h: 1.3 }, scale: null, color: '#cbb27a' },
}

export const FLOOR_CATEGORIES = [
  { id: 'sofas-chairs', label: 'Sofas and chairs' },
  { id: 'tables', label: 'Tables' },
  { id: 'beds', label: 'Beds' },
  { id: 'storage', label: 'Wardrobes and storage' },
  { id: 'rugs', label: 'Rugs' },
  { id: 'plants', label: 'Plants' },
  { id: 'lamps', label: 'Lamps' },
  { id: 'decor', label: 'Décor' },
]

export const floorItemSpec = (catalogId) => FLOOR_ITEMS[catalogId]
export const itemSpec = (catalogId) => FLOOR_ITEMS[catalogId] || WALL_ITEMS[catalogId]
