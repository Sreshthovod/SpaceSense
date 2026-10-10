import { formatINR } from '../../utils/format'
import Card from '../ui/Card'

export default function FurniturePanel({ products }) {
  const { items, total_inr, budget_inr, remaining_inr, note } = products
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl font-semibold">Furniture suggestions</h3>
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-clay">Sample catalog</span>
      </div>
      <p className="mt-1 text-xs text-muted">Illustrative items and prices from a small sample catalog; not real product listings.</p>
      {items.length === 0 ? (
        <p role="status" className="mt-4 rounded-xl bg-sand p-3 text-sm">{note || 'No sample products fit this budget.'}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-semibold">{i.name}</p>
                <p className="text-xs text-muted"><span className="capitalize">{i.category}</span> · {i.dimensions}</p>
              </div>
              <p className="font-semibold">{formatINR(i.price_inr)}</p>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Recommended total</dt><dd className="font-semibold">{formatINR(total_inr)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Your budget</dt><dd className="font-semibold">{formatINR(budget_inr)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Remaining</dt><dd className="font-semibold">{formatINR(remaining_inr)}</dd></div>
      </dl>
    </Card>
  )
}
