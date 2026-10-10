import { useState } from 'react'
import { ChevronDown, ExternalLink, Loader2, Plus, Wallet } from 'lucide-react'
import { STYLES } from '../../data/sampleData'
import { formatINR } from '../../utils/format'
import { safeHttpsUrl } from '../../utils/productPlan'
import { itemSpec } from '../model/catalog'
import { styleLabel } from '../model/design'
import { budgetTone } from '../hooks/useBudget'

const REASONS = {
  generic: 'Generic shape — pick a product to price it',
  no_products: 'No verified product for this item',
  unverified: 'Product price no longer verified',
  finish: 'No verified paint or flooring products',
}

const BAR = { sage: 'bg-sage', brass: 'bg-brass', clay: 'bg-clay' }

/** The thin bar and one line of text. Also used, compact, in the designer header. */
export function BudgetMeter({ data, compact = false }) {
  if (!data) return null
  const ratio = data.used_ratio
  const tone = budgetTone(ratio)
  const width = ratio === null ? (data.total_inr > 0 ? 100 : 0) : Math.min(100, ratio * 100)
  return (
    <div className={compact ? 'w-40' : ''}>
      <div
        role="meter"
        aria-label="Budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-valuetext={data.over_budget_inr ? `${formatINR(data.over_budget_inr)} over budget` : `${formatINR(data.total_inr)} of ${formatINR(data.budget_inr)}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      >
        <div className={`h-full rounded-full transition-[width] duration-300 ${BAR[tone]}`} style={{ width: `${width}%` }} data-tone={tone} />
      </div>
      <p className={`mt-1 ${compact ? 'text-[11px]' : 'text-xs'} ${tone === 'clay' ? 'text-clay' : 'text-muted'}`} data-testid={compact ? 'budget-meter-compact' : 'budget-meter'}>
        {compact
          ? (data.over_budget_inr ? `${formatINR(data.over_budget_inr)} over budget` : `${formatINR(data.total_inr)} of ${formatINR(data.budget_inr)}`)
          : data.over_budget_inr
            ? `${formatINR(data.total_inr)} · ${formatINR(data.over_budget_inr)} over budget`
            : `${formatINR(data.total_inr)} of ${formatINR(data.budget_inr)} · ${formatINR(data.remaining_inr)} left`}
      </p>
    </div>
  )
}

function BudgetInputs({ design, dispatch }) {
  const [draft, setDraft] = useState(null)
  const commit = (text) => {
    const v = Number(text)
    if (text !== '' && Number.isFinite(v) && v >= 0) dispatch({ type: 'setBudget', value: Math.round(v) })
    setDraft(null)
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label htmlFor="designer-budget" className="block text-xs font-semibold">Budget (₹)</label>
        <div className="relative mt-1">
          <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">₹</span>
          <input
            id="designer-budget"
            type="number"
            min="0"
            step="1000"
            value={draft ?? design.budget}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget.value) }}
            className="w-full rounded-lg border border-line bg-white py-1.5 pl-6 pr-2 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark"
          />
        </div>
      </div>
      <div>
        <label htmlFor="designer-style" className="block text-xs font-semibold">Style</label>
        <select
          id="designer-style"
          value={design.style}
          onChange={(e) => dispatch({ type: 'setStyle', style: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark"
        >
          {STYLES.map((s) => <option key={s.id} value={s.id}>{styleLabel(s.id, s.name)}</option>)}
        </select>
      </div>
    </div>
  )
}

function Line({ line, selected, onSelect }) {
  const url = line.product && safeHttpsUrl(line.product.product_url)
  const clickable = Boolean(line.uid)
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{line.product?.name || line.label}</span>
        <span className="block truncate text-[10px] text-muted">
          {line.product ? line.label : REASONS[line.reason] || 'No verified price'}
        </span>
      </span>
      <span className={`shrink-0 text-xs ${line.price_inr === null ? 'text-muted' : 'font-semibold'}`}>
        {line.price_inr === null ? '—' : formatINR(line.price_inr)}
      </span>
    </>
  )
  return (
    <li className="flex items-center gap-1">
      {clickable ? (
        <button
          type="button"
          onClick={() => onSelect(line.uid)}
          aria-pressed={selected}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-sand/70 ${selected ? 'bg-sage/15' : ''}`}
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5">{body}</div>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded p-1 text-muted hover:text-ink" aria-label={`View ${line.product.name} on ${line.product.retailer} (opens in a new tab)`}>
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  )
}

/**
 * The design's cost, all computed by the server from verified catalog prices. Items without a
 * verified product are listed separately and never counted.
 */
export default function BudgetPanel({ design, dispatch, budget, selected, onSelectLine, onAddSuggestion, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const { data, error, loading } = budget
  const priced = data?.lines.filter((l) => l.price_inr !== null) || []
  const unpriced = data?.lines.filter((l) => l.price_inr === null) || []

  return (
    <section aria-labelledby="budget-heading" className="rounded-xl border border-line bg-white">
      <h3 id="budget-heading">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
          <Wallet aria-hidden="true" className="h-4 w-4 text-sage-dark" />
          <span className="flex-1 font-display text-lg font-semibold">Budget</span>
          {loading && <Loader2 aria-label="Updating prices" className="h-3.5 w-3.5 animate-spin text-muted" />}
          <ChevronDown aria-hidden="true" className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      <div className="px-3 pb-3">
        {error && !data && <p role="status" className="rounded-lg bg-sand p-2 text-xs">Prices unavailable — couldn't reach the server. You can keep designing.</p>}
        {error && data && <p role="status" className="mb-2 text-[11px] text-clay">Couldn't update prices; showing the last result.</p>}
        <BudgetMeter data={data} />
        {open && (
          <div className="mt-3 space-y-4">
            <BudgetInputs design={design} dispatch={dispatch} />
            {data && (
              <>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">By category</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {data.categories.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span>{c.label}{c.unpriced_count > 0 && <span className="text-muted"> · {c.unpriced_count} unpriced</span>}</span>
                        <span className={c.priced_count ? 'font-semibold' : 'text-muted'}>{c.priced_count ? formatINR(c.total_inr) : '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {priced.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">In your total</p>
                    <ul className="mt-1 space-y-0.5">{priced.map((l) => <Line key={l.uid} line={l} selected={l.uid === selected} onSelect={onSelectLine} />)}</ul>
                  </div>
                )}
                {unpriced.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Not in the total</p>
                    <ul className="mt-1 space-y-0.5">{unpriced.map((l) => <Line key={l.uid || l.type} line={l} selected={l.uid === selected} onSelect={onSelectLine} />)}</ul>
                  </div>
                )}
                {data.suggestions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fits your remaining budget</p>
                    <ul className="mt-1 space-y-1">
                      {data.suggestions.map((s) => (
                        <li key={s.product.product_id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">{s.product.name}</span>
                            <span className="block text-[10px] text-muted">{itemSpec(s.type)?.name} · {formatINR(s.product.price_inr)}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => onAddSuggestion(s)}
                            aria-label={`Add ${s.product.name}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[11px] font-semibold hover:bg-sand"
                          >
                            <Plus aria-hidden="true" className="h-3 w-3" /> Add
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[10px] leading-snug text-muted">Listed prices from the retailer on the date checked. {data.excluded_costs}</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
