import { useEffect, useState } from 'react'
import { getStudioCatalog } from '../../services/api'
import { formatINR } from '../../utils/format'

/** The verified products each designer item type can stand for. Fetched once per session. */
export default function useStudioCatalog() {
  const [state, setState] = useState({ catalog: null, error: '' })
  useEffect(() => {
    const controller = new AbortController()
    getStudioCatalog(controller.signal)
      .then((catalog) => setState({ catalog, error: '' }))
      .catch((err) => {
        if (!controller.signal.aborted) setState({ catalog: null, error: err.message || 'Prices are unavailable.' })
      })
    return () => controller.abort()
  }, [])
  return state
}

/** Looks a product up by type and id in a loaded catalog. */
export const findProduct = (catalog, type, productId) =>
  (productId && catalog?.types?.[type]?.products.find((p) => p.product_id === productId)) || null

/** "2 products from ₹1,990" for a catalog card, or a plain note when nothing verified exists. */
export function priceHint(catalog, type) {
  if (!catalog) return null
  const products = catalog.types?.[type]?.products || []
  if (!products.length) return 'No verified product'
  const low = Math.min(...products.map((p) => p.price_inr))
  return `${products.length} product${products.length > 1 ? 's' : ''} from ${formatINR(low)}`
}
