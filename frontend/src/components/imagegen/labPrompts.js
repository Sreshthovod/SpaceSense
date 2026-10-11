// Starting points for the Image Lab prompt. The first five are offered as chips; "Inspire me" picks
// from all of them. They're only prompt text: nothing here is a product or a promise about the result.
export const LAB_PROMPTS = [
  { id: 'japandi', label: 'Sunlit Japandi', text: 'A sunlit Japandi living room with natural oak furniture, a low linen sofa, paper lantern lighting and soft morning light through sheer curtains.' },
  { id: 'warm-minimal', label: 'Warm minimalism', text: 'A warm minimalist bedroom with limewashed walls, a low timber bed, wool throws in oat and clay tones, and a single sculptural floor lamp.' },
  { id: 'mediterranean', label: 'Mediterranean retreat', text: 'A Mediterranean retreat with white plaster arches, terracotta floor tiles, a rattan lounge chair and olive branches in a stoneware vase.' },
  { id: 'organic', label: 'Modern organic', text: 'A modern organic dining room with a round travertine table, curved boucle chairs, a woven pendant light and large leafy plants.' },
  { id: 'dreamy', label: 'Dreamy interiors', text: 'A dreamy reading nook in a bay window, piled with soft cushions, warm fairy lights, a sheepskin rug and rain on the glass at dusk.' },
  { id: 'modern-indian', label: 'Modern Indian', text: 'A modern Indian living room with carved teak details, a brass floor lamp, indigo block-print cushions and a jute rug in warm afternoon light.' },
  { id: 'industrial', label: 'Industrial loft', text: 'An industrial loft with exposed brick, black steel windows, a cognac leather sofa and Edison bulb pendants over a reclaimed wood table.' },
  { id: 'scandi-kids', label: 'Calm kids room', text: 'A calm Scandinavian kids room with a birch bunk bed, a canvas play tent, pastel wall shelves with picture books and soft daylight.' },
]

export const LAB_CHIPS = LAB_PROMPTS.slice(0, 5)
