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
  clock: {
    name: 'Wall clock', category: 'decor', size: { w: 1.2, h: 1.2, d: 0.15 },
    min: { w: 0.8, h: 0.8 }, max: { w: 2.5, h: 2.5 }, resize: 'both', lockAspect: true, rotatable: false, defaultY: 6, color: '#3b3f3a',
  },
  'wall-cabinet': {
    name: 'Kitchen wall cabinet', category: 'kitchen', size: { w: 2, h: 2.3, d: 1.1 },
    min: { w: 1, h: 1.5 }, max: { w: 4, h: 3 }, resize: 'both', rotatable: false, defaultY: 6, color: '#e9e4dc',
  },
  'range-hood': {
    name: 'Chimney hood', category: 'kitchen', size: { w: 2.5, h: 2, d: 1.5 },
    min: { w: 2, h: 1.5 }, max: { w: 3.5, h: 3 }, resize: 'width', rotatable: false, defaultY: 6.2, color: '#c9ccce',
  },
  'spice-rack': {
    name: 'Spice rack', category: 'kitchen', size: { w: 1.3, h: 0.9, d: 0.3 },
    min: { w: 1.3, h: 0.9 }, max: { w: 1.3, h: 0.9 }, resize: 'none', rotatable: false, defaultY: 4.5, color: '#d9c09a',
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

export const WALL_DECOR_IDS = ['painting', 'mirror', 'clock', 'shelf', 'sconce', 'panel', 'curtains']
export const WALL_KITCHEN_IDS = ['wall-cabinet', 'range-hood', 'spice-rack']
export const OPENING_IDS = ['door', 'window']

export const wallItemSpec = (catalogId) => WALL_ITEMS[catalogId]

// Colour choices offered for upholstered or woven pieces (the colour of the generic shape only).
export const FABRICS = ['#c9b9a6', '#e4ddd2', '#9a6b52', '#7f8a6e', '#5d6b7a', '#3b3f3a', '#b85c38', '#cbb27a']

/**
 * Floor items: `size` is width × depth × height in feet at scale 1, front facing +z. These are
 * typical sizes for a generic shape; a picked product with an unambiguous listed size can override
 * them. `scale` is the allowed resize range (null: fixed size). `layer: 'rug'` lies under furniture.
 * `againstWall` items start with their back to a wall. `surface` items have a top that `onSurface`
 * items (lamps, small plants, vases) sit on when placed over them. `colors` lists colour choices.
 */
export const FLOOR_ITEMS = {
  sofa: { name: 'Three-seater sofa', category: 'sofas-chairs', size: { w: 7, d: 3, h: 2.8 }, scale: null, againstWall: true, color: '#c9b9a6', colors: FABRICS },
  armchair: { name: 'Armchair', category: 'sofas-chairs', size: { w: 2.6, d: 2.7, h: 2.7 }, scale: null, color: '#9a6b52', colors: FABRICS },
  'dining-chair': { name: 'Dining chair', category: 'sofas-chairs', size: { w: 1.5, d: 1.7, h: 2.8 }, scale: null, color: '#3b3f3a' },
  'desk-chair': { name: 'Desk chair', category: 'sofas-chairs', size: { w: 2.1, d: 2.1, h: 3.4 }, scale: null, color: '#5c5f55', colors: FABRICS },
  'coffee-table': { name: 'Coffee table', category: 'tables', size: { w: 3.5, d: 2, h: 1.4 }, scale: null, color: '#7a4e2d', surface: true },
  'side-table': { name: 'Round side table', category: 'tables', size: { w: 1.5, d: 1.5, h: 1.8 }, scale: null, color: '#b08968', surface: true },
  'dining-table': { name: 'Dining table', category: 'tables', size: { w: 5, d: 3, h: 2.5 }, scale: null, color: '#8b6a45', surface: true },
  'study-desk': { name: 'Study desk', category: 'tables', size: { w: 4.6, d: 1.7, h: 2.5 }, scale: null, againstWall: true, color: '#e9e4dc', surface: true },
  'bedside-table': { name: 'Bedside table', category: 'tables', size: { w: 1.3, d: 1.35, h: 1.75 }, scale: null, color: '#e9e4dc', surface: true },
  bed: { name: 'Queen bed', category: 'beds', size: { w: 5.3, d: 7, h: 3.4 }, scale: null, againstWall: true, color: '#e4ddd2', colors: FABRICS },
  'bunk-bed': { name: 'Bunk bed', category: 'beds', size: { w: 3.3, d: 6.8, h: 5.3 }, scale: null, againstWall: true, color: '#e9e4dc' },
  wardrobe: { name: 'Two-door wardrobe', category: 'storage', size: { w: 4, d: 2, h: 7 }, scale: null, againstWall: true, color: '#6b4f32' },
  bookshelf: { name: 'Open bookshelf', category: 'storage', size: { w: 3, d: 1.2, h: 6 }, scale: null, againstWall: true, color: '#8b6a45' },
  dresser: { name: 'Chest of drawers', category: 'storage', size: { w: 2.6, d: 1.6, h: 2.6 }, scale: null, againstWall: true, color: '#e9e4dc', surface: true },
  'tv-unit': { name: 'TV unit', category: 'storage', size: { w: 4, d: 1.3, h: 1.6 }, scale: null, againstWall: true, color: '#3b2f2a', surface: true },
  rug: { name: 'Area rug', category: 'rugs', size: { w: 5, d: 7, h: 0.04 }, scale: [0.5, 2], layer: 'rug', color: '#b85c38', colors: FABRICS },
  plant: { name: 'Floor plant', category: 'plants', size: { w: 1.5, d: 1.5, h: 4 }, scale: [0.6, 1.5], color: '#6f7f5b' },
  'small-plant': { name: 'Small potted plant', category: 'plants', size: { w: 0.6, d: 0.6, h: 1.1 }, scale: [0.7, 1.5], color: '#6f7f5b', onSurface: true },
  'floor-lamp': { name: 'Floor lamp', category: 'lamps', size: { w: 1.3, d: 1.3, h: 5.2 }, scale: null, color: '#e6dcc8' },
  'table-lamp': { name: 'Table lamp', category: 'lamps', size: { w: 0.8, d: 0.8, h: 1.7 }, scale: null, color: '#f2eadc', onSurface: true },
  pouf: { name: 'Woven pouf', category: 'decor', size: { w: 1.6, d: 1.6, h: 1.3 }, scale: null, color: '#cbb27a', colors: FABRICS },
  vase: { name: 'Vase', category: 'decor', size: { w: 0.5, d: 0.5, h: 1 }, scale: [0.6, 1.6], color: '#a65f3c', onSurface: true },
  // Living room
  'l-sofa': { name: 'L-shaped sofa', category: 'sofas-chairs', size: { w: 8, d: 5.5, h: 2.8 }, scale: null, againstWall: true, color: '#7f8a6e', colors: FABRICS },
  'bean-bag': { name: 'Bean bag', category: 'sofas-chairs', size: { w: 2.5, d: 2.5, h: 2.2 }, scale: null, color: '#b85c38', colors: FABRICS },
  'shoe-cabinet': { name: 'Shoe cabinet', category: 'storage', size: { w: 1.65, d: 0.95, h: 3.4 }, scale: null, againstWall: true, color: '#3b2f2a', surface: true },
  // Dining room
  sideboard: { name: 'Sideboard', category: 'storage', size: { w: 5, d: 1.5, h: 2.7 }, scale: null, againstWall: true, color: '#8b6a45', surface: true },
  // Bedroom
  'single-bed': { name: 'Single bed', category: 'beds', size: { w: 3.3, d: 6.8, h: 3 }, scale: null, againstWall: true, color: '#c9b9a6', colors: FABRICS },
  'dressing-table': { name: 'Dressing table', category: 'tables', size: { w: 3.3, d: 1.5, h: 2.5 }, scale: null, againstWall: true, color: '#e9e4dc', surface: true },
  // Home office and kids' room
  'filing-cabinet': { name: 'Filing cabinet', category: 'storage', size: { w: 1.4, d: 1.9, h: 2.3 }, scale: null, againstWall: true, color: '#9a9a94', surface: true },
  'work-lamp': { name: 'Work lamp', category: 'lamps', size: { w: 0.6, d: 1, h: 1.8 }, scale: null, color: '#3b3f3a', onSurface: true },
  'toy-storage': { name: 'Toy storage unit', category: 'storage', size: { w: 3, d: 1.2, h: 2.5 }, scale: null, againstWall: true, color: '#f2eadc', surface: true },
  // Kitchen. Cabinets are 2 ft deep with a counter at 3 ft, the usual Indian modular kitchen size.
  'base-cabinet': { name: 'Kitchen base cabinet', category: 'kitchen', size: { w: 2, d: 2, h: 3 }, scale: null, againstWall: true, color: '#e9e4dc', surface: true },
  'sink-cabinet': { name: 'Sink cabinet', category: 'kitchen', size: { w: 3, d: 2, h: 3 }, scale: null, againstWall: true, color: '#e9e4dc', surface: true },
  'corner-cabinet': { name: 'Corner cabinet', category: 'kitchen', size: { w: 3, d: 3, h: 3 }, scale: null, againstWall: true, color: '#e9e4dc', surface: true },
  'tall-cabinet': { name: 'Tall pantry cabinet', category: 'kitchen', size: { w: 2, d: 2, h: 7 }, scale: null, againstWall: true, color: '#e9e4dc' },
  stove: { name: 'Cooktop cabinet', category: 'kitchen', size: { w: 2.5, d: 2, h: 3 }, scale: null, againstWall: true, color: '#e9e4dc', surface: true },
  fridge: { name: 'Refrigerator', category: 'kitchen', size: { w: 2.3, d: 2.3, h: 5.8 }, scale: null, againstWall: true, color: '#dfe2e4' },
  'kitchen-island': { name: 'Kitchen island', category: 'kitchen', size: { w: 5, d: 2.7, h: 3 }, scale: null, color: '#8b6a45', surface: true },
  'bar-stool': { name: 'Bar stool', category: 'kitchen', size: { w: 1.3, d: 1.3, h: 2.5 }, scale: null, color: '#3b3f3a' },
  'kitchen-trolley': { name: 'Kitchen trolley', category: 'kitchen', size: { w: 1.9, d: 1.4, h: 3 }, scale: null, color: '#b9bcbf', surface: true },
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
  { id: 'kitchen', label: 'Kitchen' },
]

export const floorItemSpec = (catalogId) => FLOOR_ITEMS[catalogId]
export const itemSpec = (catalogId) => FLOOR_ITEMS[catalogId] || WALL_ITEMS[catalogId]
