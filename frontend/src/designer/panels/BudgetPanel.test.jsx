// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { budgetTone, pricingPayload } from '../hooks/useBudget'
import { createDesign } from '../model/design'
import { designReducer } from '../model/reducer'
import BudgetPanel, { BudgetMeter } from './BudgetPanel'

afterEach(cleanup)

const product = (id, price) => ({ product_id: id, name: `${id} name`, retailer: 'IKEA India', product_url: `https://www.ikea.com/in/en/p/${id}/`, image_url: null, price_inr: price, last_checked: '2026-10-10', listed_size: null, availability: 'in_stock', styles: [] })
const data = (extra = {}) => ({
  currency: 'INR', budget_inr: 25000, total_inr: 15000, remaining_inr: 10000, over_budget_inr: null, used_ratio: 0.6, unpriced_count: 2,
  categories: [
    { id: 'furniture', label: 'Furniture', total_inr: 15000, priced_count: 1, unpriced_count: 1 },
    { id: 'flooring', label: 'Flooring', total_inr: 0, priced_count: 0, unpriced_count: 1 },
  ],
  lines: [
    { uid: 'a', type: 'sofa', label: 'Sofa', category: 'furniture', product: product('kivik', 15000), price_inr: 15000, price_status: 'verified', reason: null },
    { uid: 'b', type: 'pouf', label: 'Pouf', category: 'furniture', product: null, price_inr: null, price_status: 'unavailable', reason: 'no_products' },
    { uid: null, type: 'floor', label: 'Flooring: Wood', category: 'flooring', product: null, price_inr: null, price_status: 'unavailable', reason: 'finish' },
  ],
  suggestions: [{ type: 'floor-lamp', product: product('hektar', 6990) }],
  excluded_costs: 'Delivery is not included.',
  ...extra,
})

describe('budget tone', () => {
  it('stays calm until 90%, then brass, then clay when over', () => {
    expect([budgetTone(0.2), budgetTone(0.89), budgetTone(0.9), budgetTone(1), budgetTone(1.01), budgetTone(null)])
      .toEqual(['sage', 'sage', 'brass', 'brass', 'clay', 'sage'])
  })

  it('the meter matches total / budget', () => {
    render(<BudgetMeter data={data()} />)
    const meter = screen.getByRole('meter', { name: 'Budget used' })
    expect(meter.getAttribute('aria-valuenow')).toBe('60')
    expect(meter.firstChild.style.width).toBe('60%')
    expect(screen.getByTestId('budget-meter').textContent).toBe('₹15,000 of ₹25,000 · ₹10,000 left')
  })

  it('caps the bar and reports the overrun when over budget', () => {
    render(<BudgetMeter data={data({ total_inr: 30000, remaining_inr: -5000, over_budget_inr: 5000, used_ratio: 1.2 })} />)
    expect(screen.getByRole('meter').firstChild.style.width).toBe('100%')
    expect(screen.getByRole('meter').firstChild.dataset.tone).toBe('clay')
    expect(screen.getByTestId('budget-meter').textContent).toBe('₹30,000 · ₹5,000 over budget')
  })
})

describe('BudgetPanel', () => {
  const design = createDesign({ form: { budget: '25000' } })
  const props = (extra = {}) => ({ design, dispatch: vi.fn(), budget: { data: data(), error: '', loading: false }, selected: null, onSelectLine: vi.fn(), onAddSuggestion: vi.fn(), ...extra })

  it('separates priced lines from unpriced ones and explains why', () => {
    render(<BudgetPanel {...props()} />)
    const inTotal = screen.getByText('In your total').nextElementSibling
    const notInTotal = screen.getByText('Not in the total').nextElementSibling
    expect(within(inTotal).getByText('kivik name')).toBeTruthy()
    expect(within(notInTotal).getByText('No verified product for this item')).toBeTruthy()
    expect(within(notInTotal).getByText('No verified paint or flooring products')).toBeTruthy()
    expect(screen.getByText('Furniture').parentElement.textContent).toMatch('1 unpriced')
  })

  it('selects an item from its cost row and adds a suggestion only on request', () => {
    const p = props()
    render(<BudgetPanel {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /kivik name/ }))
    expect(p.onSelectLine).toHaveBeenCalledWith('a')
    expect(p.onAddSuggestion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Add hektar name' }))
    expect(p.onAddSuggestion).toHaveBeenCalledWith(data().suggestions[0])
  })

  it('shows an offline note instead of numbers when pricing failed', () => {
    render(<BudgetPanel {...props({ budget: { data: null, error: 'down', loading: false } })} />)
    expect(screen.getByRole('status').textContent).toMatch("couldn't reach the server")
  })
})

describe('pricingPayload', () => {
  it('sends types and chosen product ids, never prices or positions', () => {
    let d = createDesign({ form: { budget: '30000', style: 'boho' } })
    d = designReducer(d, { type: 'addFloorItem', uid: 's', catalogId: 'sofa', productId: 'ikea-kivik-sofa' })
    d = designReducer(d, { type: 'addFloorItem', uid: 'p', catalogId: 'plant' })
    d = designReducer(d, { type: 'addWallItem', uid: 'd', wall: 'back', catalogId: 'door' })
    const payload = pricingPayload(d)
    expect(payload).toEqual({
      budget_inr: 30000,
      style: 'boho',
      items: [{ uid: 's', type: 'sofa', product_id: 'ikea-kivik-sofa' }, { uid: 'p', type: 'plant' }],
      surfaces: [{ id: 'walls', label: 'Walls: Warm white' }, { id: 'floor', label: 'Flooring: Wood' }],
    })
    // Moving an item doesn't change the request, so it doesn't re-price.
    const moved = designReducer(d, { type: 'updatePlaced', uid: 's', changes: { x: 1 } })
    expect(pricingPayload(moved)).toEqual(payload)
  })
})
