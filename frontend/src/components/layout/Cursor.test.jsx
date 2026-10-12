// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Cursor from './Cursor'
import SplitText from '../ui/SplitText'

// `fine` = a mouse that hovers; `reduced` = the reader asked for less motion.
const media = ({ fine, reduced }) => vi.stubGlobal('matchMedia', (q) => ({
  matches: q.includes('reduce') ? reduced : q.includes('hover') ? fine : false,
  addEventListener() {},
  removeEventListener() {},
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('has-cursor')
})

describe('Cursor', () => {
  it('replaces the pointer on a desktop mouse, and gives it back on unmount', () => {
    media({ fine: true, reduced: false })
    const { container, unmount } = render(<Cursor />)
    expect(container.querySelector('.cursor-ring')).not.toBeNull()
    expect(container.firstChild.getAttribute('aria-hidden')).toBe('true')
    expect(document.documentElement.classList.contains('has-cursor')).toBe(true)
    unmount()
    expect(document.documentElement.classList.contains('has-cursor')).toBe(false)
  })

  it('stays out of the way on touch screens', () => {
    media({ fine: false, reduced: false })
    const { container } = render(<Cursor />)
    expect(container.firstChild).toBeNull()
    expect(document.documentElement.classList.contains('has-cursor')).toBe(false)
  })

  it('stays out of the way when reduced motion is on', () => {
    media({ fine: true, reduced: true })
    const { container } = render(<Cursor />)
    expect(container.firstChild).toBeNull()
  })
})

describe('SplitText', () => {
  it('keeps the heading readable as one name while the words animate', () => {
    render(<h2 aria-label="Find your look."><SplitText text="Find your look." /></h2>)
    const heading = screen.getByRole('heading', { name: 'Find your look.' })
    expect(heading.textContent).toBe('Find your look.')
    expect(heading.querySelectorAll('.split-word')).toHaveLength(3)
    expect(heading.firstChild.getAttribute('aria-hidden')).toBe('true')
  })
})
