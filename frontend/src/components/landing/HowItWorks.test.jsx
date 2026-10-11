// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HowItWorks from './HowItWorks'
import { STYLES } from '../../data/sampleData'

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('HowItWorks', () => {
  it('shows the three steps in order as a list, with the Vastu link on step two', () => {
    render(<HowItWorks />)
    const steps = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(steps.map((s) => within(s).getByRole('heading').textContent)).toEqual(['Share your space', 'Make it yours', 'Get advice, then decide'])
    expect(within(steps[1]).getByRole('link', { name: /how vastu works here/i }).getAttribute('href')).toBe('#vastu')
  })

  it('keeps the pictures out of the accessibility tree, and the style chips are real styles', () => {
    const { container } = render(<HowItWorks />)
    for (const img of container.querySelectorAll('img')) expect(img.closest('[aria-hidden="true"]')).not.toBeNull()
    const names = STYLES.map((s) => s.name)
    const chips = [...container.querySelectorAll('.rounded-full.border')].map((c) => c.textContent)
    expect(chips.length).toBeGreaterThan(0)
    for (const c of chips) expect(names).toContain(c)
  })

  it('reads out the real counts', () => {
    render(<HowItWorks />)
    expect(screen.getByText(`${STYLES.length} Design styles`)).toBeTruthy()
  })
})
