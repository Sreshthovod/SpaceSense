import { formatINR } from '../../utils/format'
import Card from '../ui/Card'

export default function FurniturePanel({ items, budget }) {
  const total = items.reduce((sum, i) => sum + i.price, 0)
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">Furniture suggestions</h3>
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-clay">Sample data</span>
      </div>
      <p className="mt-1 text-xs text-muted">Illustrative items and prices only; these are not real product recommendations.</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm">Your budget is below the cheapest sample item. Try increasing it.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-semibold">{i.name}</p>
                <p className="text-xs text-muted">{i.category} · {i.size}</p>
              </div>
              <p className="font-semibold">{formatINR(i.price)}</p>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Estimated total</dt><dd className="font-semibold">{formatINR(total)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Your budget</dt><dd className="font-semibold">{formatINR(budget)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Remaining</dt><dd className="font-semibold">{formatINR(budget - total)}</dd></div>
      </dl>
    </Card>
  )
}
