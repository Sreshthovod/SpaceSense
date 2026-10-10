// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FurniturePanel from './FurniturePanel'

const verified = (id, total, extra = {}) => ({
  id, name: `${id} name`, category: 'seating', kind: 'verified_product', selected: false, quantity: 1,
  price_inr: total, line_total_inr: total, retailer: 'IKEA India', product_url: `https://www.ikea.com/in/en/p/${id}/`,
  image_url: `https://www.ikea.com/in/en/images/products/${id}.jpg`, last_checked: '2026-10-10', dimensions: '90x55 cm',
  why: `Why ${id}`, matched_colors: [], notes: [], links: [{ retailer: 'IKEA India', url: `https://www.ikea.com/in/en/p/${id}/`, kind: 'product' }],
  ...extra,
})

const idea = {
  id: 'dhurrie', name: 'Handwoven cotton dhurrie rug', category: 'rugs', kind: 'suggestion', selected: false, quantity: 1,
  price_inr: null, line_total_inr: null, retailer: null, product_url: null, image_url: null, last_checked: null,
  why: 'Indian craft underfoot.', matched_colors: ['terracotta'], notes: [],
  links: [
    { retailer: 'Amazon India', url: 'https://www.amazon.in/s?k=handwoven+cotton+dhurrie+rug', kind: 'search' },
    { retailer: 'Evil', url: 'javascript:alert(1)', kind: 'search' },
  ],
}

const products = (items, extra = {}) => ({
  sources: ['local_catalog'], currency: 'INR', items, budget_inr: 30000,
  total_inr: 0, remaining_inr: 30000, unpriced_count: 0, shortfall_inr: null,
  excluded_costs: 'Delivery, assembly and installation charges are not included.', note: null, notices: [], ...extra,
})

afterEach(cleanup)

const total = () => screen.getByTestId('plan-total').textContent
const remaining = () => screen.getByTestId('plan-remaining').textContent

describe('FurniturePanel', () => {
  it('renders verified products with a real product link, price and check date', () => {
    render(<FurniturePanel products={products([verified('sofa', 25990, { selected: true })])} />)
    const link = screen.getByRole('link', { name: /view product on ikea india/i })
    expect(link.getAttribute('href')).toBe('https://www.ikea.com/in/en/p/sofa/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByText('Verified listing')).toBeTruthy()
    expect(screen.getByText('Price checked 10 Oct 2026')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'sofa name' }).getAttribute('src')).toMatch('ikea.com')
  })

  it('starts from the suggested plan and recalculates totals when items are toggled', () => {
    render(<FurniturePanel products={products([verified('sofa', 25990, { selected: true }), verified('chair', 12990)])} />)
    expect(total()).toBe('₹25,990')
    expect(remaining()).toBe('₹4,010')

    fireEvent.click(screen.getAllByLabelText('Include in my plan')[1])
    expect(total()).toBe('₹38,980')
    expect(screen.getByText('Over budget by')).toBeTruthy()
    expect(remaining()).toBe('₹8,980')

    fireEvent.click(screen.getAllByLabelText('Include in my plan')[0])
    expect(total()).toBe('₹12,990')
    expect(screen.getByText('Remaining')).toBeTruthy()
  })

  it('shows ideas as unpriced, unselectable, with labelled retailer search links only', () => {
    render(<FurniturePanel products={products([idea])} />)
    const card = screen.getByText('Handwoven cotton dhurrie rug').closest('li')
    expect(within(card).getByText('Idea · price not verified')).toBeTruthy()
    expect(within(card).getByText('Price varies — compare at retailers.')).toBeTruthy()
    expect(within(card).queryByLabelText('Include in my plan')).toBeNull()
    expect(within(card).queryByRole('link', { name: /view product/i })).toBeNull()
    const links = within(card).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://www.amazon.in/s?k=handwoven+cotton+dhurrie+rug'])
    expect(links[0].textContent).toMatch(/search results/)
    expect(within(card).getByTestId('image-fallback').textContent).toMatch('no product photo')
    expect(total()).toBe('₹0')
  })

  it('falls back to an icon when a product image fails to load', () => {
    render(<FurniturePanel products={products([verified('sofa', 25990)])} />)
    fireEvent.error(screen.getByRole('img', { name: 'sofa name' }))
    expect(screen.queryByRole('img', { name: 'sofa name' })).toBeNull()
    expect(screen.getByTestId('image-fallback').textContent).toMatch('Photo unavailable')
  })

  it('never renders a non-https product link', () => {
    const bad = verified('sofa', 25990, { links: [{ retailer: 'IKEA India', url: 'http://www.ikea.com/x', kind: 'product' }] })
    render(<FurniturePanel products={products([bad])} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows budget notes, notices and excluded costs', () => {
    render(<FurniturePanel products={products([], { note: 'Your budget is below the cheapest matching verified product.', notices: ['Live product search is unavailable right now.'] })} />)
    expect(screen.getByText(/below the cheapest/)).toBeTruthy()
    expect(screen.getByText(/Live product search is unavailable/)).toBeTruthy()
    expect(screen.getByText(/Delivery, assembly/)).toBeTruthy()
  })

  it('shows an error with a retry when products failed to load', () => {
    const onRetry = vi.fn()
    render(<FurniturePanel products={null} error="The product catalog is temporarily unavailable." onRetry={onRetry} />)
    expect(screen.getByRole('alert').textContent).toMatch('temporarily unavailable')
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
