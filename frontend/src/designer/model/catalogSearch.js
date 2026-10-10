/** Filtering and sorting the furniture catalog. Pure, so it's easy to test. */
import { FLOOR_CATEGORIES, FLOOR_ITEMS } from './catalog'

/** Cheapest verified price for a type, or null when there's no verified product. */
export function lowestPrice(catalog, id) {
  const products = catalog?.types?.[id]?.products || []
  return products.length ? Math.min(...products.map((p) => p.price_inr)) : null
}

/**
 * Catalog ids matching a search and category, sorted. Search matches the item name, its category
 * and the names of its verified products, ignoring case. Price sorts put items without a verified
 * price last.
 */
export function searchCatalog({ query = '', category = 'all', sort = 'recommended', catalog = null } = {}) {
  const q = query.trim().toLowerCase()
  const label = Object.fromEntries(FLOOR_CATEGORIES.map((c) => [c.id, c.label.toLowerCase()]))
  const ids = Object.keys(FLOOR_ITEMS).filter((id) => {
    const spec = FLOOR_ITEMS[id]
    if (category !== 'all' && spec.category !== category) return false
    if (!q) return true
    const products = (catalog?.types?.[id]?.products || []).map((p) => p.name.toLowerCase())
    return [spec.name.toLowerCase(), label[spec.category] || '', ...products].some((t) => t.includes(q))
  })
  if (sort === 'price-asc' || sort === 'price-desc') {
    const dir = sort === 'price-asc' ? 1 : -1
    ids.sort((a, b) => {
      const pa = lowestPrice(catalog, a)
      const pb = lowestPrice(catalog, b)
      if (pa === null && pb === null) return 0
      if (pa === null) return 1
      if (pb === null) return -1
      return (pa - pb) * dir
    })
  }
  return ids
}
