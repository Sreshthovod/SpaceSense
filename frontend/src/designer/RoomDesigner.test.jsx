// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const webgl = vi.hoisted(() => ({ available: false }))
vi.mock('./webgl', () => ({ hasWebGL: () => webgl.available }))
// jsdom has no WebGL, so the canvas is replaced by a stub that shows what it was given.
vi.mock('./scene/DesignerScene', () => ({
  default: ({ design, label, selected, command, mode, view, snap, wheelSetting }) => (
    <div
      data-testid="scene" aria-label={label} data-floor={design.floor.material} data-selected={selected || ''}
      data-focus={command?.kind === 'focus' ? command.position.map((v) => v.toFixed(1)).join(',') : ''}
      data-command={command ? `${command.kind}:${command.name || ''}:${command.key}` : ''}
      data-mode={mode} data-view={view} data-snap={String(snap)} data-wheel={wheelSetting} data-items={design.items.length}
    />
  ),
}))

// A fake server: the catalog lists one verified sofa; pricing sums the picked products' prices.
const KIVIK = { product_id: 'ikea-kivik-sofa', name: 'KIVIK 3-seat sofa', retailer: 'IKEA India', product_url: 'https://www.ikea.com/in/en/p/kivik/', image_url: null, price_inr: 50990, last_checked: '2026-10-10', listed_size: null, availability: 'in_stock', styles: ['scandinavian'] }
const api = vi.hoisted(() => ({ offline: false, payloads: [] }))
vi.mock('../services/api', () => ({
  getStudioCatalog: () => (api.offline ? Promise.reject(new Error('down')) : Promise.resolve({
    currency: 'INR', budget_categories: {}, excluded_costs: 'Delivery not included.',
    types: { sofa: { category: 'furniture', products: [KIVIK] }, pouf: { category: 'accessories', products: [] } },
  })),
  priceDesign: (payload) => {
    api.payloads.push(payload)
    if (api.offline) return Promise.reject(new Error("Can't reach the SpaceSense server"))
    const lines = payload.items.map((i) => ({
      uid: i.uid, type: i.type, label: i.type, category: 'furniture',
      product: i.product_id ? KIVIK : null, price_inr: i.product_id ? KIVIK.price_inr : null,
      price_status: i.product_id ? 'verified' : 'unavailable', reason: i.product_id ? null : 'generic',
    }))
    const total = lines.reduce((s, l) => s + (l.price_inr || 0), 0)
    return Promise.resolve({
      currency: 'INR', budget_inr: payload.budget_inr, total_inr: total, remaining_inr: payload.budget_inr - total,
      over_budget_inr: total > payload.budget_inr ? total - payload.budget_inr : null,
      used_ratio: payload.budget_inr ? total / payload.budget_inr : null, unpriced_count: lines.filter((l) => !l.price_inr).length,
      categories: [{ id: 'furniture', label: 'Furniture', total_inr: total, priced_count: lines.filter((l) => l.price_inr).length, unpriced_count: 0 }],
      lines, suggestions: [], excluded_costs: 'Delivery not included.',
    })
  },
}))

const { default: RoomDesigner } = await import('./RoomDesigner')

const openTab = (name) => fireEvent.click(screen.getByRole('tab', { name }))

const form = { roomType: 'Bedroom', length: '14', width: '11', height: '9', style: 'modern-indian', budget: '25000' }

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(() => {
  cleanup()
  webgl.available = false
  api.offline = false
  api.payloads.length = 0
  vi.useRealTimers()
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
    expect(screen.getByText(/Warm & cozy \(Modern Indian\) · Build your dream room/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Budget: ₹25,000/ })).toBeTruthy()
    expect(document.getElementById('root').inert).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /back to results/i }))
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(document.getElementById('root').inert).toBe(false)
  })

  it('updates the scene from the settings panel and badges every dimension', () => {
    webgl.available = true
    render(<RoomDesigner form={{ ...form, height: '' }} onClose={() => {}} />)
    openTab('Room')
    expect(screen.getAllByText('Measured', { selector: 'span' })).toHaveLength(2)
    expect(screen.getAllByText('Estimated', { selector: 'span' })).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '13' } })
    expect(screen.getByTestId('scene').getAttribute('aria-label')).toMatch('13 by 14 foot room')

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '200' } })
    expect(screen.getByRole('alert').textContent).toMatch('Enter 4–60 ft.')
    expect(screen.getByTestId('scene').getAttribute('aria-label')).toMatch('13 by 14 foot room')

    fireEvent.click(screen.getByRole('button', { name: 'Mark ceiling height as measured' }))
    expect(screen.getAllByText('Measured', { selector: 'span' })).toHaveLength(3)

    openTab('Floor')
    fireEvent.click(screen.getByLabelText('Marble'))
    expect(screen.getByTestId('scene').dataset.floor).toBe('marble')
  })

  it('decorates a wall: add, select, nudge, duplicate, delete, Esc', () => {
    webgl.available = true
    render(<RoomDesigner form={form} onClose={() => {}} />)
    openTab('Walls')
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
    openTab('Walls')
    expect(screen.getByRole('button', { name: /^back wall/i }).textContent).toMatch('Empty')
  })

  it('prices only products the user picks, on the server, and focuses a cost row', async () => {
    webgl.available = true
    render(<RoomDesigner form={form} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add three-seater sofa' }))
    const picker = await screen.findByLabelText('Product')
    expect(screen.getByText(/Not counted in your budget/)).toBeTruthy()
    fireEvent.change(picker, { target: { value: 'ikea-kivik-sofa' } })
    expect(screen.getByText(/₹50,990 · verified 10 Oct 2026/)).toBeTruthy()

    // The meter shows the server's numbers: over a ₹25,000 budget.
    fireEvent.click(screen.getByRole('button', { name: /^Budget: / }))
    await vi.waitFor(() => expect(screen.getByTestId('budget-meter').textContent).toBe('₹50,990 · ₹25,990 over budget'), { timeout: 2000 })
    const last = api.payloads.at(-1)
    expect(last.items).toEqual([{ uid: expect.any(String), type: 'sofa', product_id: 'ikea-kivik-sofa' }])
    expect(JSON.stringify(last)).not.toMatch(/price/)

    // Clicking the cost row selects the sofa and asks the camera to focus on it.
    fireEvent.click(screen.getByRole('button', { name: 'Deselect' }))
    expect(screen.getByTestId('scene').dataset.selected).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /KIVIK 3-seat sofa/ }))
    expect(screen.getByTestId('scene').dataset.selected).toBe(last.items[0].uid)
    expect(screen.getByTestId('scene').dataset.focus).toMatch(/^0\.0,/)
  })

  it('changing budget or style keeps every placed item', async () => {
    webgl.available = true
    render(<RoomDesigner form={form} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add three-seater sofa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add floor plant' }))
    fireEvent.click(screen.getByRole('button', { name: /^Budget: / }))
    const budget = screen.getByLabelText('Budget (₹)')
    fireEvent.change(budget, { target: { value: '90000' } })
    fireEvent.blur(budget)
    fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'industrial' } })
    await vi.waitFor(() => expect(api.payloads.at(-1)?.budget_inr).toBe(90000), { timeout: 2000 })
    expect(api.payloads.at(-1).style).toBe('industrial')
    expect(api.payloads.at(-1).items.map((i) => i.type)).toEqual(['sofa', 'plant'])
  })

  it('keeps working when prices are unavailable', async () => {
    webgl.available = true
    api.offline = true
    render(<RoomDesigner form={form} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^Budget: / }))
    expect(await screen.findByText(/Prices unavailable — couldn't reach the server/, {}, { timeout: 2000 })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add three-seater sofa' }))
    expect(screen.getByText('Product prices are unavailable right now.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Three-seater sofa' })).toBeTruthy()
  })

  it('switches modes and views from the toolbar and keyboard without touching the design', () => {
    webgl.available = true
    localStorage.clear()
    render(<RoomDesigner form={form} onClose={() => {}} />)
    const scene = () => screen.getByTestId('scene').dataset
    fireEvent.click(screen.getByRole('button', { name: 'Add three-seater sofa' }))
    expect(scene().mode).toBe('select')
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('true')
    for (const [key, mode] of [['h', 'navigate'], ['m', 'move'], ['e', 'rotate'], ['v', 'select']]) {
      fireEvent.keyDown(window, { key })
      expect(scene().mode).toBe(mode)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))
    expect(scene().mode).toBe('move')
    expect(screen.getByTestId('mode-hint').textContent).toMatch('Drag an object to move it')

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    expect(scene().view).toBe('plan')
    fireEvent.click(screen.getByRole('button', { name: 'Camera' }))
    expect(screen.getByRole('button', { name: 'Front view' }).disabled).toBe(true) // presets are for the 3D view
    fireEvent.click(screen.getByRole('button', { name: '3D' }))
    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByRole('button', { name: i % 2 ? '3D' : 'Plan' }))
    expect(scene().items).toBe('1')
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(false) // only the sofa
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Snap on/ }))
    expect(scene().snap).toBe('false')
  })

  it('sends camera commands: presets, fit, and F to focus the selection', () => {
    webgl.available = true
    render(<RoomDesigner form={form} onClose={() => {}} />)
    const command = () => screen.getByTestId('scene').dataset.command
    fireEvent.click(screen.getByRole('button', { name: 'Camera' }))
    fireEvent.click(screen.getByRole('button', { name: 'Top view' }))
    expect(command()).toMatch(/^preset:top:/)
    fireEvent.keyDown(window, { key: 'f' })
    expect(command()).toMatch(/^fit::/) // nothing selected: frame the room
    fireEvent.click(screen.getByRole('button', { name: 'Add three-seater sofa' }))
    fireEvent.keyDown(window, { key: 'f' })
    expect(command()).toMatch(/^focus::/)
    expect(screen.getByTestId('scene').dataset.focus).toMatch(/^0\.0,1\.4,/)
  })

  it('remembers the scroll-gesture setting', () => {
    webgl.available = true
    localStorage.clear()
    const { unmount } = render(<RoomDesigner form={form} onClose={() => {}} />)
    expect(screen.getByTestId('scene').dataset.wheel).toBe('auto')
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    fireEvent.click(screen.getByLabelText('Always pan'))
    expect(screen.getByTestId('scene').dataset.wheel).toBe('pan')
    unmount()
    render(<RoomDesigner form={form} onClose={() => {}} />)
    expect(screen.getByTestId('scene').dataset.wheel).toBe('pan')
  })
})
