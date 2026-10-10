export const SECTIONS = [
  { key: 'layout', label: 'Layout' },
  { key: 'keep', label: 'Keep' },
  { key: 'replace', label: 'Replace or add' },
  { key: 'colors', label: 'Colours' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'decor', label: 'Decor' },
  { key: 'budget_tips', label: 'Budget tips' },
]

// Budget tips are advice, not visual changes, so they are never sent to the image editor.
const EDITABLE = ['layout', 'keep', 'replace', 'colors', 'lighting', 'decor']

/** Flattens recommendations into the changes a user can approve for the photo edit. */
export function toApprovableItems(recs) {
  return EDITABLE.flatMap((key) =>
    (recs?.[key] || []).map((text, i) => ({
      id: `${key}-${i}`,
      section: SECTIONS.find((s) => s.key === key).label,
      text,
      instruction: key === 'keep' ? `Keep as is: ${text}` : text,
    })),
  )
}
