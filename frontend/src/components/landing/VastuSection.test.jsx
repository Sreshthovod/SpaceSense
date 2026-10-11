// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VastuSection from './VastuSection'
import { VASTU_ZONES } from '../../data/vastuGuide'

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const checked = () => screen.getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')

describe('VastuSection', () => {
  it('covers all eight directions, each with something to say', () => {
    expect(VASTU_ZONES.map((z) => z.short)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
    for (const z of VASTU_ZONES) expect(z.text.length).toBeGreaterThan(20)
  })

  it('the rose starts on the north-east and the arrow keys walk round it', () => {
    render(<VastuSection onStartVastu={() => {}} />)
    expect(screen.getAllByRole('radio')).toHaveLength(8)
    expect(checked().getAttribute('aria-label')).toBe('North-east')
    expect(screen.getByTestId('vastu-zone-text').textContent).toMatch(/pooja unit/)
    fireEvent.keyDown(checked(), { key: 'ArrowRight' })
    expect(checked().getAttribute('aria-label')).toBe('East')
    fireEvent.keyDown(checked(), { key: 'ArrowLeft' })
    fireEvent.keyDown(checked(), { key: 'ArrowLeft' })
    expect(checked().getAttribute('aria-label')).toBe('North')
    fireEvent.keyDown(checked(), { key: 'ArrowLeft' }) // wraps round
    expect(checked().getAttribute('aria-label')).toBe('North-west')
    expect(checked().getAttribute('tabindex')).toBe('0')
  })

  it('a click picks a zone and shows what goes there', () => {
    render(<VastuSection onStartVastu={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: 'South-east' }))
    expect(screen.getByTestId('vastu-zone-text').textContent).toMatch(/TV/)
  })

  it('offers to plan with Vastu and to try it in 3D', () => {
    const onStartVastu = vi.fn()
    const onOpenDesigner = vi.fn()
    render(<VastuSection onStartVastu={onStartVastu} onOpenDesigner={onOpenDesigner} />)
    fireEvent.click(screen.getByRole('link', { name: /plan with vastu/i }))
    expect(onStartVastu).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /try it in 3d/i }))
    expect(onOpenDesigner).toHaveBeenCalledTimes(1)
  })
})
