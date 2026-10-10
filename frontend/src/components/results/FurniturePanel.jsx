import { useMemo, useState } from 'react'
import {
  Archive, BedDouble, Blinds, ExternalLink, Flower2, Lamp, Layers, Lightbulb, RotateCw, Search, ShieldCheck,
  ShoppingBag, Sofa, Table, TriangleAlert,
} from 'lucide-react'
import { formatINR } from '../../utils/format'
import { formatChecked, initialSelection, isPriced, planTotals, safeHttpsUrl } from '../../utils/productPlan'
import Button from '../ui/Button'
import Card from '../ui/Card'

const CATEGORY_ICONS = {
  seating: Sofa, tables: Table, beds: BedDouble, storage: Archive, lighting: Lamp, rugs: Layers, curtains: Blinds,
  decor: Flower2,
}

const SOURCE_LABELS = { local_catalog: 'SpaceSense catalog', serpapi_google_shopping: 'Live shopping search' }

function ProductImage({ item }) {
  const [failed, setFailed] = useState(false)
  const src = safeHttpsUrl(item.image_url)
  const Icon = CATEGORY_ICONS[item.category] || ShoppingBag
  if (!src || failed) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl bg-sand text-sage-dark" data-testid="image-fallback">
        <Icon aria-hidden="true" className="h-8 w-8" />
        <span className="text-xs">{item.kind === 'suggestion' ? 'Idea — no product photo' : 'Photo unavailable'}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={item.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full rounded-xl bg-white object-contain"
    />
  )
}

function ProductCard({ item, checked, onToggle }) {
  const priced = isPriced(item)
  const checkedOn = formatChecked(item.last_checked)
  const links = item.links.filter((l) => safeHttpsUrl(l.url))
  const productLink = links.find((l) => l.kind === 'product')
  const searchLinks = links.filter((l) => l.kind === 'search')

  return (
    <li className={`flex flex-col rounded-2xl border p-4 transition ${checked ? 'border-sage bg-sage/5' : 'border-line bg-white'}`}>
      <ProductImage item={item} />
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
        {priced ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2 py-0.5 text-sage-dark">
            <ShieldCheck aria-hidden="true" className="h-3 w-3" /> Verified listing
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-clay">
            <Lightbulb aria-hidden="true" className="h-3 w-3" /> Idea · price not verified
          </span>
        )}
        <span className="rounded-full bg-cream px-2 py-0.5 capitalize text-muted">{item.category}</span>
      </div>
      <h4 className="mt-2 font-semibold leading-snug">{item.name}</h4>
      <p className="mt-0.5 text-xs text-muted">
        {[item.retailer, item.dimensions, item.quantity > 1 ? `Qty ${item.quantity}` : null].filter(Boolean).join(' · ')}
      </p>
      <p className="mt-2 text-sm">{item.why}</p>
      {item.matched_colors.length > 0 && (
        <p className="mt-1 text-xs text-sage-dark">Matches your palette: {item.matched_colors.join(', ')}</p>
      )}
      {item.notes.map((n) => <p key={n} className="mt-1 text-xs text-muted">{n}</p>)}

      <div className="mt-auto pt-3">
        {priced ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="text-lg font-semibold">
              {formatINR(item.line_total_inr)}
              {item.quantity > 1 && <span className="ml-1 text-xs font-normal text-muted">({item.quantity} × {formatINR(item.price_inr)})</span>}
            </p>
            {checkedOn && <p className="text-[11px] text-muted">Price checked {checkedOn}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted">Price varies — compare at retailers.</p>
        )}
        {priced && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={checked} onChange={() => onToggle(item.id)} className="h-4 w-4 accent-sage-dark" />
            Include in my plan
          </label>
        )}
        {productLink && (
          <a
            href={productLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            View product on {productLink.retailer} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        {searchLinks.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Search retailers</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {searchLinks.map((l) => (
                <li key={l.retailer}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs hover:border-sage focus-visible:outline-2 focus-visible:outline-sage"
                  >
                    <Search aria-hidden="true" className="h-3 w-3" /> {l.retailer}
                    <span className="sr-only">search results (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  )
}

function ProductList({ products }) {
  const { items, budget_inr: budget, note, notices = [], excluded_costs: excludedCosts, sources } = products
  const [selected, setSelected] = useState(() => initialSelection(items))
  const totals = useMemo(() => planTotals(items, selected, budget), [items, selected, budget])
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const sourceLabel = sources.map((s) => SOURCE_LABELS[s] || s).join(' + ') || 'No sources'

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl font-semibold">Shop the look</h3>
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-sage-dark">{sourceLabel}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        <strong className="font-semibold text-ink">Verified listings</strong> link to the retailer's product page, with the
        price we read there on the date shown. <strong className="font-semibold text-ink">Ideas</strong> have no verified
        product or price; their links open the retailer's own search.
      </p>
      {notices.map((n) => (
        <p key={n} role="status" className="mt-3 rounded-xl bg-sand p-3 text-sm">{n}</p>
      ))}
      {note && <p role="status" className="mt-3 rounded-xl border border-line bg-cream p-3 text-sm">{note}</p>}

      <div
        aria-live="polite"
        className={`sticky top-20 z-10 mt-4 grid grid-cols-3 gap-2 rounded-xl border p-3 text-sm shadow-sm ${totals.overBudget ? 'border-clay bg-[#fbefe9]' : 'border-line bg-white'}`}
      >
        <div>
          <p className="text-xs text-muted">Selected ({totals.count})</p>
          <p className="font-semibold" data-testid="plan-total">{formatINR(totals.total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Your budget</p>
          <p className="font-semibold">{formatINR(budget)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{totals.overBudget ? 'Over budget by' : 'Remaining'}</p>
          <p className={`font-semibold ${totals.overBudget ? 'text-clay' : ''}`} data-testid="plan-remaining">
            {formatINR(Math.abs(totals.remaining))}
          </p>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} checked={selected.has(item.id)} onToggle={toggle} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">{excludedCosts}</p>
    </Card>
  )
}

export default function FurniturePanel({ products, error, onRetry, retrying = false }) {
  if (!products) {
    return (
      <Card>
        <h3 className="font-display text-2xl font-semibold">Shop the look</h3>
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-sand p-3 text-sm">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
          {error || 'Product recommendations are unavailable right now.'}
        </p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry} disabled={retrying} className="mt-3">
            <RotateCw aria-hidden="true" className="h-4 w-4" /> {retrying ? 'Retrying…' : 'Try again'}
          </Button>
        )}
      </Card>
    )
  }
  return <ProductList products={products} />
}
