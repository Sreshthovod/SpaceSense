/**
 * Planned spend for the products the user ticked. Only items with a verified line total can be
 * selected or counted; unpriced suggestions never change the total.
 */
export function planTotals(items, selectedIds, budget) {
  const chosen = items.filter((i) => selectedIds.has(i.id) && Number.isInteger(i.line_total_inr))
  const total = chosen.reduce((sum, i) => sum + i.line_total_inr, 0)
  const remaining = budget - total
  return { count: chosen.length, total, remaining, overBudget: remaining < 0 }
}

export const isPriced = (item) => item.kind === 'verified_product' && Number.isInteger(item.line_total_inr)

/** The backend's suggested in-budget plan, as the initial selection. */
export const initialSelection = (items) => new Set(items.filter((i) => i.selected && isPriced(i)).map((i) => i.id))

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** "10 Oct 2026" from an ISO date (YYYY-MM-DD), or '' if missing/invalid. */
export function formatChecked(isoDate) {
  if (!isoDate) return ''
  const d = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
}

/** Only https links leave the app; anything else is dropped rather than rendered. */
export const safeHttpsUrl = (url) => {
  try {
    return new URL(url).protocol === 'https:' ? url : null
  } catch {
    return null
  }
}
