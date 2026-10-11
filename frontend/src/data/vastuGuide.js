// What the landing page says about Vastu. Every line here matches a rule the app actually applies:
// the written notes (backend/services/vastu.py) and the designer's Vastu check (designer/model/compass.js).
// Plain data, so the landing page doesn't pull in any 3D code.

/** The eight directions, clockwise from north, with what SpaceSense suggests for each zone. */
export const VASTU_ZONES = [
  { id: 'north', short: 'N', name: 'North', title: 'A good way to face', text: 'Main seating and work desks are turned so you face north or east where the layout allows. An aquarium can sit here too.' },
  { id: 'north-east', short: 'NE', name: 'North-east', title: 'Light and clear', text: 'Kept open and uncluttered: no wardrobes, tall shelves or the bed. A pooja unit, a plant, an aquarium or the kitchen sink suit this corner.' },
  { id: 'east', short: 'E', name: 'East', title: 'Face the morning', text: 'The other direction to face when sitting, studying or cooking. A dining table can sit towards the east or west.' },
  { id: 'south-east', short: 'SE', name: 'South-east', title: 'Fire and electronics', text: 'The TV, electronics and the cooking range go here.' },
  { id: 'south', short: 'S', name: 'South', title: 'Weight and storage', text: 'Heavy furniture, tall storage, the fridge and files sit along the south. Headboards point south, with west the next best.' },
  { id: 'south-west', short: 'SW', name: 'South-west', title: 'Rest and weight', text: 'The strongest corner: the bed in a bedroom, the desk in a home office, and the heaviest pieces.' },
  { id: 'west', short: 'W', name: 'West', title: 'Wardrobes and desks', text: 'Wardrobes, bookshelves and toy storage go along the west, and the desk in a study or home office.' },
  { id: 'north-west', short: 'NW', name: 'North-west', title: 'Flexible', text: "No strong rule here in what SpaceSense checks, so it's a good place for whatever the room still needs." },
]

/** Where Vastu shows up in SpaceSense. */
export const VASTU_FEATURES = [
  { id: 'notes', icon: 'notes', title: 'Vastu notes in your plan', text: 'Turn on "Vastu preferences" in the brief and the written plan adds notes for your room type, naming your actual walls ("the wall with the door") once you give your entry direction.' },
  { id: 'compass', icon: 'compass', title: 'A live compass in 3D', text: "Set which way the room faces and a compass in the 3D designer turns with the camera. The floor plan labels each wall's direction." },
  { id: 'ai', icon: 'ai', title: 'Vastu mode for AI arrange', text: 'The AI is told the guidelines in terms of your walls, suggests three layouts, and the one that scores best is placed.' },
  { id: 'check', icon: 'check', title: 'A guideline-by-guideline check', text: 'The Vastu panel lists each guideline for the room as followed or not. Click one to select the piece it is about.' },
  { id: 'score', icon: 'score', title: 'Scored with everything else', text: 'Vastu can be part of the layout score, next to walkways, spacing and light. "Improve layout" moves pieces to raise it.' },
  { id: 'pieces', icon: 'pieces', title: 'Pieces that belong', text: 'A pooja unit, an aquarium and plants are in the furniture library, and the check knows they suit the north-east.' },
]

/** Why someone would use it. */
export const VASTU_REASONS = [
  { title: 'Your walls, not generic tips', text: 'Guidance is worked out from the direction your room faces, so "south-west" means a real corner you can point at.' },
  { title: 'Comfort still counts', text: 'Vastu is one part of the layout score, next to walkways, spacing and daylight, so the designer balances them instead of chasing Vastu alone.' },
  { title: 'Optional and undoable', text: "It's off unless you turn it on, every change can be undone, and the guidelines are applied only where the room allows." },
]

/** How to turn it on. */
export const VASTU_STEPS = [
  'In the brief, switch on "Vastu preferences".',
  'Pick the direction you face as you walk in (a phone compass helps).',
  'Open the 3D designer and switch on Vastu mode in AI arrange.',
]
