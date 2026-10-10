import { describe, expect, it } from 'vitest'
import { formatChecked, initialSelection, planTotals, safeHttpsUrl } from './productPlan'

const items = [
  { id: 'sofa', kind: 'verified_product', line_total_inr: 25990, selected: true },
  { id: 'chairs', kind: 'verified_product', line_total_inr: 11800, selected: false },
  { id: 'rug-idea', kind: 'suggestion', line_total_inr: null, selected: false },
]

describe('planTotals', () => {
  it('sums only selected, priced items', () => {
    expect(planTotals(items, new Set(['sofa', 'rug-idea']), 30000)).toEqual({ count: 1, total: 25990, remaining: 4010, overBudget: false })
  })

  it('flags going over budget', () => {
    const t = planTotals(items, new Set(['sofa', 'chairs']), 30000)
    expect(t.total).toBe(37790)
    expect(t.remaining).toBe(-7790)
    expect(t.overBudget).toBe(true)
  })

  it('is zero with nothing selected', () => {
    expect(planTotals(items, new Set(), 5000)).toEqual({ count: 0, total: 0, remaining: 5000, overBudget: false })
  })
})

describe('initialSelection', () => {
  it("starts from the backend's plan and never preselects unpriced items", () => {
    expect([...initialSelection([...items, { id: 'x', kind: 'suggestion', line_total_inr: null, selected: true }])]).toEqual(['sofa'])
  })
})

describe('helpers', () => {
  it('formats the last-checked date', () => {
    expect(formatChecked('2026-10-10')).toBe('10 Oct 2026')
    expect(formatChecked(null)).toBe('')
    expect(formatChecked('nope')).toBe('')
  })

  it('only allows https links', () => {
    expect(safeHttpsUrl('https://www.ikea.com/in/en/p/x/')).toBe('https://www.ikea.com/in/en/p/x/')
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpsUrl('http://example.com')).toBeNull()
    expect(safeHttpsUrl(undefined)).toBeNull()
  })
})
