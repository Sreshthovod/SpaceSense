import { useState } from 'react'
import {
  Armchair, BedDouble, Flower2, Lamp, Layers, Library, Search, Sofa, Table, X,
} from 'lucide-react'
import { formatINR } from '../../utils/format'
import { safeHttpsUrl } from '../../utils/productPlan'
import { FLOOR_CATEGORIES, FLOOR_ITEMS } from '../model/catalog'
import { lowestPrice, searchCatalog } from '../model/catalogSearch'
import { formatFeet } from '../model/wallPlacement'

const ICONS = { 'sofas-chairs': Sofa, tables: Table, beds: BedDouble, storage: Library, rugs: Layers, plants: Flower2, lamps: Lamp, decor: Armchair }
const sizeLabel = ({ w, d, h }) => (h < 1 / 12 ? `${formatFeet(w)} × ${formatFeet(d)}` : `${formatFeet(w)} × ${formatFeet(d)} × ${formatFeet(h)}`)

function Thumb({ id, catalog }) {
  const [failed, setFailed] = useState(false)
  const product = catalog?.types?.[id]?.products?.find((p) => safeHttpsUrl(p.image_url))
  const src = product && safeHttpsUrl(product.image_url)
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" />
  }
  const Icon = ICONS[FLOOR_ITEMS[id].category] || Sofa
  return (
    <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ background: `${FLOOR_ITEMS[id].color}33` }}>
      <Icon className="h-5 w-5" style={{ color: FLOOR_ITEMS[id].color }} />
    </span>
  )
}

function Card({ id, catalog, onPick, recent = false }) {
  const spec = FLOOR_ITEMS[id]
  const low = lowestPrice(catalog, id)
  const count = catalog?.types?.[id]?.products?.length || 0
  return (
    <li>
      <button
        type="button"
        // A mouse click starts a placement preview; Enter or Space (detail 0) adds it straight away.
        onClick={(e) => onPick(id, e.detail === 0)}
        aria-label={`Add ${spec.name.toLowerCase()}${recent ? ' (recently used)' : ''}`}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-white p-2 text-left hover:border-sage hover:bg-sand/50"
      >
        <Thumb id={id} catalog={catalog} />
        <span className="min-w-0">
          <span className="block text-xs font-medium">{spec.name}</span>
          <span className="block text-[10px] text-muted">{sizeLabel(spec.size)}</span>
          {catalog && (
            <span className={`block text-[10px] ${low === null ? 'text-muted' : 'text-sage-dark'}`}>
              {low === null ? 'Generic shape · not a catalog product' : `${count} verified product${count > 1 ? 's' : ''} from ${formatINR(low)}`}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

/** The furniture catalog: search, category filters, price sort and recently used pieces. */
export default function CatalogPanel({ catalog, recent, onPick, placingName, onCancelPlacing }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('recommended')
  const ids = searchCatalog({ query, category, sort, catalog })
  const recentIds = recent.filter((id) => FLOOR_ITEMS[id])
  const filtered = Boolean(query.trim()) || category !== 'all'

  return (
    <section aria-labelledby="catalog-heading">
      <h3 id="catalog-heading" className="font-display text-xl font-semibold">Add furniture</h3>
      {placingName ? (
        <p role="status" className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-sage/15 px-3 py-2 text-xs">
          <span>Click the floor to place the {placingName}. Esc cancels.</span>
          <button type="button" onClick={onCancelPlacing} className="rounded-full border border-line bg-white px-2 py-0.5 font-semibold">Cancel</button>
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">Click a piece, then click the floor to place it (Enter adds it to a free spot). Simple 3D shapes at typical sizes; pick a product in the inspector to price it.</p>
      )}

      <div className="relative mt-3">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <label htmlFor="catalog-search" className="sr-only">Search furniture</label>
        <input
          id="catalog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sofas, lamps, KIVIK…"
          className="w-full rounded-full border border-line bg-white py-1.5 pl-8 pr-3 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark"
        />
      </div>
      <div role="group" aria-label="Category" className="mt-2 flex flex-wrap gap-1">
        {[{ id: 'all', label: 'All' }, ...FLOOR_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${category === c.id ? 'border-ink bg-ink text-cream' : 'border-line bg-white hover:bg-sand'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        Sort
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-line bg-white px-1.5 py-0.5 text-[11px] text-ink">
          <option value="recommended">Recommended</option>
          <option value="price-asc">Verified price: low to high</option>
          <option value="price-desc">Verified price: high to low</option>
        </select>
      </label>

      {!filtered && recentIds.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Recently used</p>
          <ul className="mt-1 grid grid-cols-1 gap-1.5">
            {recentIds.map((id) => <Card key={`r-${id}`} id={id} catalog={catalog} onPick={onPick} recent />)}
          </ul>
        </div>
      )}

      {ids.length ? (
        <>
        {!filtered && recentIds.length > 0 && <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">All furniture</p>}
        <ul className={`${!filtered && recentIds.length > 0 ? 'mt-1' : 'mt-3'} grid grid-cols-1 gap-1.5`} aria-label="Furniture">
          {ids.map((id) => <Card key={id} id={id} catalog={catalog} onPick={onPick} />)}
        </ul>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
          <p>No furniture matches “{query.trim() || FLOOR_CATEGORIES.find((c) => c.id === category)?.label}”.</p>
          <button type="button" onClick={() => { setQuery(''); setCategory('all') }} className="mt-2 inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 font-semibold text-ink hover:bg-sand">
            <X aria-hidden="true" className="h-3 w-3" /> Clear filters
          </button>
        </div>
      )}
    </section>
  )
}
