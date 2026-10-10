// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from './Navbar'

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Navbar', () => {
  it('on the landing page links to the sections, including the Image Lab sandbox', () => {
    render(<Navbar studio={false} onOpenDesigner={() => {}} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)
    expect(labels).toEqual(expect.arrayContaining(['How It Works', 'Design Styles', 'Image Lab', 'Design My Space']))
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull()
  })

  it('in the studio offers the section jump links, Open 3D and Start over instead of the landing links', () => {
    const onReset = vi.fn()
    const onOpenDesigner = vi.fn()
    render(<Navbar studio onReset={onReset} onOpenDesigner={onOpenDesigner} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['#advice', '#chat', '#photo', '#shop', '#designer-3d']))
    expect(hrefs).not.toContain('#redesign')
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expect(onReset).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open 3D' }))
    expect(onOpenDesigner).toHaveBeenCalledTimes(1)
  })
})
