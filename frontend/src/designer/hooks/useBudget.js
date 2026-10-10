import { useEffect, useMemo, useState } from 'react'
import { priceDesign } from '../../services/api'
import { FLOOR_MATERIALS, PAINTS } from '../model/design'

export const PRICE_DEBOUNCE_MS = 400

/** What the server needs to price a design: types and chosen product ids only, never prices. */
export function pricingPayload(design) {
  const paint = (color) => PAINTS.find((p) => p.color === color)?.label || 'Custom colour'
  const wallNames = [...new Set(Object.values(design.walls).map((w) => (w.kind === 'wallpaper' ? 'Wallpaper' : paint(w.color))))]
  return {
    budget_inr: design.budget,
    style: design.style,
    items: design.items.map((i) => ({
      uid: i.uid,
      type: i.catalogId,
      ...(i.productId ? { product_id: i.productId } : {}),
      ...(i.label ? { label: i.label } : {}),
    })),
    surfaces: [
      { id: 'walls', label: `Walls: ${wallNames.join(', ')}`.slice(0, 80) },
      { id: 'floor', label: `Flooring: ${FLOOR_MATERIALS[design.floor.material]?.label || 'Floor'}` },
    ],
  }
}

/**
 * Prices the design on the server shortly after it stops changing. Moving items doesn't change the
 * request, so it doesn't re-price. Keeps the last good result while a new one loads.
 */
export default function useBudget(design) {
  const payload = useMemo(() => JSON.stringify(pricingPayload(design)), [design])
  const [state, setState] = useState({ data: null, error: '', loading: true })

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, loading: true }))
      priceDesign(JSON.parse(payload), controller.signal)
        .then((data) => setState({ data, error: '', loading: false }))
        .catch((err) => {
          if (controller.signal.aborted) return
          setState((s) => ({ ...s, error: err.message || 'Prices are unavailable.', loading: false }))
        })
    }, PRICE_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [payload])

  return state
}

/** Sage while comfortably within budget, brass when close (90%+), muted clay when over. */
export function budgetTone(ratio) {
  if (ratio === null || ratio === undefined) return 'sage'
  if (ratio > 1) return 'clay'
  return ratio >= 0.9 ? 'brass' : 'sage'
}
