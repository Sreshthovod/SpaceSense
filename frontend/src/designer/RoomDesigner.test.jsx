// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const webgl = vi.hoisted(() => ({ available: false }))
vi.mock('./webgl', () => ({ hasWebGL: () => webgl.available }))
// jsdom has no WebGL, so the canvas is replaced by a stub that shows what it was given.
vi.mock('./scene/DesignerScene', () => ({
  default: ({ design, label }) => <div data-testid="scene" aria-label={label} data-floor={design.floor.material} />,
}))

const { default: RoomDesigner } = await import('./RoomDesigner')

const form = { roomType: 'Bedroom', length: '14', width: '11', height: '9', style: 'modern-indian', budget: '25000' }

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(() => {
  cleanup()
  webgl.available = false
})

describe('RoomDesigner', () => {
  it('shows a clear fallback when WebGL is unavailable, keeping room settings usable', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    expect(screen.getByRole('alert').textContent).toMatch(/needs WebGL/)
    expect(screen.queryByTestId('scene')).toBeNull()
    expect(screen.getByLabelText('Width').value).toBe('11')
  })

  it('opens as a modal with the brief, makes the page inert and restores it on close', () => {
    webgl.available = true
    const onClose = vi.fn()
    const { unmount } = render(<RoomDesigner form={form} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: '3D Room Designer' })).toBeTruthy()
    expect(screen.getByText(/Warm & cozy \(Modern Indian\) · Budget ₹25,000/)).toBeTruthy()
    expect(document.getElementById('root').inert).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /back to results/i }))
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(document.getElementById('root').inert).toBe(false)
  })

  it('updates the scene from the settings panel and badges every dimension', () => {
    webgl.available = true
    render(<RoomDesigner form={{ ...form, height: '' }} onClose={() => {}} />)
    expect(screen.getAllByText('Measured', { selector: 'span' })).toHaveLength(2)
    expect(screen.getAllByText('Estimated', { selector: 'span' })).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '13' } })
    expect(screen.getByTestId('scene').getAttribute('aria-label')).toMatch('13 by 14 foot room')

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '200' } })
    expect(screen.getByRole('alert').textContent).toMatch('Enter 4–60 ft.')
    expect(screen.getByTestId('scene').getAttribute('aria-label')).toMatch('13 by 14 foot room')

    fireEvent.click(screen.getByRole('button', { name: 'Mark ceiling height as measured' }))
    expect(screen.getAllByText('Measured', { selector: 'span' })).toHaveLength(3)

    fireEvent.click(screen.getByLabelText('Marble'))
    expect(screen.getByTestId('scene').dataset.floor).toBe('marble')
  })

  it('decorates a wall: add, select, nudge, duplicate, delete, Esc', () => {
    webgl.available = true
    render(<RoomDesigner form={form} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^back wall/i }))
    expect(screen.getByRole('group', { name: /^Back wall, 11′ wide/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /duplicate/i }).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Add framed painting' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add door' }))
    const items = () => screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.dataset.uid)
    expect(items().map((b) => b.getAttribute('aria-label').split(',')[0])).toEqual(['Door', 'Framed painting'])
    expect(screen.queryByText(/overlaps/)).toBeNull()

    // The newest item (the door) is selected; the inspector shows it and floor height is locked.
    expect(screen.getByRole('heading', { name: 'Door' })).toBeTruthy()
    expect(screen.getByLabelText('Above floor').disabled).toBe(true)

    const painting = items().find((b) => b.getAttribute('aria-label').startsWith('Framed'))
    fireEvent.focus(painting)
    const before = screen.getByLabelText('Above floor').value
    fireEvent.keyDown(window, { key: 'ArrowUp', shiftKey: true })
    expect(Number(screen.getByLabelText('Above floor').value)).toBe(Number(before) + 1)

    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }))
    expect(items()).toHaveLength(3)
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(items()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /reset wall/i }))
    fireEvent.click(screen.getByRole('button', { name: /click again to clear/i }))
    expect(items()).toHaveLength(0)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: /^Back wall/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^back wall/i }).textContent).toMatch('Empty')
  })
})
