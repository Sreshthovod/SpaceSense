// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./webgl', () => ({ hasWebGL: () => true }))
vi.mock('./scene/DesignerScene', () => ({
  default: ({ design }) => <div data-testid="scene" data-items={design.items.map((i) => i.catalogId).join(',')} data-floor={design.floor.material} />,
}))
vi.mock('../services/api', () => ({
  // The AI-arrange panel looks up which providers are set up; these tests never use it.
  getImageProviders: () => new Promise(() => {}),
  aiLayout: () => new Promise(() => {}),
  getStudioCatalog: () => new Promise(() => {}),
  priceDesign: () => new Promise(() => {}),
}))

const { default: RoomDesigner } = await import('./RoomDesigner')
const { KEYS, listDesigns } = await import('./model/storage')
const { AUTOSAVE_MS } = await import('./hooks/useDesignStore')

const form = { roomType: 'Living room', length: '16', width: '12', height: '9', style: 'modern-indian', budget: '25000' }
const items = () => screen.getByTestId('scene').dataset.items
const add = (name) => fireEvent.click(screen.getByRole('button', { name }))
const openTab = (name) => fireEvent.click(screen.getByRole('tab', { name }))

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  localStorage.clear()
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('undo and redo', () => {
  it('works from the toolbar and the keyboard, but not while typing in a field', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    const undo = screen.getByRole('button', { name: 'Undo' })
    const redo = screen.getByRole('button', { name: 'Redo' })
    expect(undo.disabled).toBe(true)
    add('Add three-seater sofa')
    add('Add floor plant')
    expect(items()).toBe('sofa,plant')

    fireEvent.click(undo)
    expect(items()).toBe('sofa')
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(items()).toBe('')
    expect(undo.disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(items()).toBe('sofa')
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    expect(items()).toBe('sofa,plant')
    expect(redo.disabled).toBe(true)

    // Typing in a field keeps the browser's own undo.
    fireEvent.keyDown(screen.getByLabelText('Width'), { key: 'z', ctrlKey: true })
    expect(items()).toBe('sofa,plant')
  })

  it('selecting, opening panels and resetting the view create no undo steps', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    openTab('Walls')
    fireEvent.click(screen.getByRole('button', { name: /^back wall/i }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Camera' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset camera' }))
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    fireEvent.keyDown(window, { key: 'm' })
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(true)
  })
})

describe('autosave and recovery', () => {
  it('saves a draft after a change and offers it back after a refresh', () => {
    vi.useFakeTimers()
    const first = render(<RoomDesigner form={form} onClose={() => {}} />)
    expect(localStorage.getItem(KEYS.draft)).toBeNull() // nothing is written until something changes
    add('Add three-seater sofa')
    openTab('Floor')
    fireEvent.click(screen.getByRole('radio', { name: 'Marble' }))
    act(() => { vi.advanceTimersByTime(AUTOSAVE_MS + 10) })
    expect(screen.getByTestId('save-status').textContent).toMatch(/^Draft saved/)
    const saved = JSON.parse(localStorage.getItem(KEYS.draft)).design
    first.unmount()

    // "Refresh": a new designer with a fresh room finds the draft.
    render(<RoomDesigner form={form} onClose={() => {}} />)
    expect(screen.getByText(/Recover your last session/).textContent).toMatch('It has 1 item.')
    expect(items()).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }))
    expect(items()).toBe('sofa')
    expect(screen.getByTestId('scene').dataset.floor).toBe('marble')
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved)
    expect(screen.queryByText(/Recover your last session/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(true) // recovery starts a clean history
  })

  it('"Start fresh" keeps the old draft restorable', () => {
    localStorage.setItem(KEYS.draft, JSON.stringify({ savedAt: '2026-10-10T09:00:00Z', design: { schemaVersion: 1, room: {}, items: [{ uid: 'b', catalogId: 'bed', wall: null, x: 0, z: 0, rotation: 0, scale: 1 }], openings: [] } }))
    render(<RoomDesigner form={form} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }))
    expect(items()).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /Unsaved design/ }))
    fireEvent.click(screen.getByRole('button', { name: /Restore cleared design/ }))
    expect(items()).toBe('bed')
  })

  it('explains a draft it cannot read instead of crashing', () => {
    localStorage.setItem(KEYS.draft, '{broken')
    render(<RoomDesigner form={form} onClose={() => {}} />)
    expect(screen.getByText(/couldn't be recovered/)).toBeTruthy()
  })
})

describe('saved designs', () => {
  it('saves versions, renames, duplicates, opens and deletes them', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    add('Add three-seater sofa')
    fireEvent.click(screen.getByRole('button', { name: /Unsaved design/ }))
    const panel = screen.getByRole('region', { name: 'Your designs' })
    expect(within(panel).getByLabelText('Design name').value).toBe('Living room — Warm & cozy')
    fireEvent.click(within(panel).getByRole('button', { name: 'Save design' }))
    expect(screen.getAllByText('Living room — Warm & cozy').length).toBeGreaterThan(0)

    // A second version with a plant.
    add('Add floor plant')
    fireEvent.change(within(panel).getByLabelText('Design name'), { target: { value: 'Living room — Minimal' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Save as copy' }))
    expect(listDesigns().map((d) => d.name).sort()).toEqual(['Living room — Minimal', 'Living room — Warm & cozy'])

    // Open the first version: the plant goes; Undo brings it back.
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Open Living room — Warm & cozy' })[0])
    expect(items()).toBe('sofa')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(items()).toBe('sofa,plant')

    fireEvent.click(within(panel).getByRole('button', { name: 'Rename Living room — Minimal' }))
    fireEvent.change(within(panel).getByLabelText('New name for Living room — Minimal'), { target: { value: 'Living room — Modern' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Save name' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Duplicate Living room — Modern' }))
    expect(listDesigns().map((d) => d.name).sort()).toEqual(['Living room — Modern', 'Living room — Modern (copy)', 'Living room — Warm & cozy'])

    fireEvent.click(within(panel).getByRole('button', { name: 'Delete Living room — Modern (copy)' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this design?' })
    expect(document.activeElement.textContent).toBe('Cancel')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(listDesigns()).toHaveLength(2)
  })

  it('reset asks first, can be cancelled with Esc, and can be undone', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    add('Add three-seater sofa')
    fireEvent.click(screen.getByRole('button', { name: /Unsaved design/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reset design/ }))
    const dialog = screen.getByRole('alertdialog', { name: 'Clear the room?' })
    // Shortcuts are off while the dialog is open.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(items()).toBe('sofa')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(items()).toBe('sofa')

    fireEvent.click(screen.getByRole('button', { name: /Reset design/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear room' }))
    expect(items()).toBe('')
    openTab('Room')
    expect(screen.getByLabelText('Width').value).toBe('12') // the room itself is kept
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(items()).toBe('sofa')
  })
})
