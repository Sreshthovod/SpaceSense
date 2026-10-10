// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./webgl', () => ({ hasWebGL: () => true }))
// The scene stub shows what it was given and lets a test "click the floor" while placing.
vi.mock('./scene/DesignerScene', () => ({
  default: ({ design, placing, onPlace, mode }) => (
    <div data-testid="scene" data-items={design.items.map((i) => `${i.catalogId}${i.hidden ? '(hidden)' : ''}${i.elevation ? `@${i.elevation}` : ''}`).join(',')} data-placing={placing?.catalogId || ''} data-mode={mode} data-walls={JSON.stringify(design.walls)} data-floor={JSON.stringify(design.floor)}>
      {placing && <button type="button" onClick={() => onPlace({ x: 2, z: 2, rotation: 0 })}>place on floor</button>}
    </div>
  ),
}))
const WARDROBE = { product_id: 'ikea-brimnes-wardrobe', name: 'BRIMNES Wardrobe with 2 doors - white', retailer: 'IKEA India', product_url: 'https://www.ikea.com/in/en/p/brimnes/', image_url: null, price_inr: 13990, last_checked: '2026-10-10', listed_size: '78x50x190 cm', availability: 'in_stock', styles: [] }
vi.mock('../services/api', () => ({
  // The AI-arrange panel looks up which providers are set up; these tests never use it.
  getImageProviders: () => new Promise(() => {}),
  aiLayout: () => new Promise(() => {}),
  getStudioCatalog: () => Promise.resolve({ currency: 'INR', budget_categories: {}, excluded_costs: '', types: { wardrobe: { category: 'furniture', products: [WARDROBE] } } }),
  priceDesign: () => new Promise(() => {}),
}))

const { default: RoomDesigner } = await import('./RoomDesigner')
const form = { roomType: 'Bedroom', length: '14', width: '12', height: '9', style: 'scandinavian', budget: '40000' }
const scene = () => screen.getByTestId('scene').dataset
const add = (name) => fireEvent.click(screen.getByRole('button', { name: `Add ${name}` })) // detail 0: like the keyboard
const openTab = (name) => fireEvent.click(screen.getByRole('tab', { name }))

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  localStorage.clear()
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(cleanup)

describe('inspector', () => {
  it('shows only the controls each item supports', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    add('three-seater sofa')
    expect(screen.getByText('Colour')).toBeTruthy() // upholstered: colours
    expect(screen.queryByText(/^Scale/)).toBeNull() // fixed size
    add('coffee table')
    expect(screen.queryByText('Colour')).toBeNull()
    expect(screen.queryByText(/^Scale/)).toBeNull()
    add('area rug')
    expect(screen.getByText(/^Scale 100%/)).toBeTruthy() // rugs resize
    expect(screen.getByText('Colour')).toBeTruthy()
  })

  it('renames, rotates, resets rotation, aligns to a wall, locks and colours', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    add('armchair')
    const name = screen.getByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Reading chair' } })
    fireEvent.blur(name)
    expect(screen.getByRole('heading', { name: 'Reading chair' })).toBeTruthy()

    const degrees = screen.getByLabelText('Degrees')
    fireEvent.change(degrees, { target: { value: '30' } })
    fireEvent.blur(degrees)
    expect(screen.getByLabelText('Degrees').value).toBe('30')
    fireEvent.click(screen.getByRole('button', { name: /Reset rotation/ }))
    expect(screen.getByLabelText('Degrees').value).toBe('0')

    fireEvent.click(screen.getByRole('button', { name: /Align to wall/ }))
    // The chair sat nearer the left wall (6 ft) than the back wall (7 ft): it now backs onto the left wall.
    expect(Number(screen.getByLabelText('From left wall').value)).toBe(0)
    expect(screen.getByLabelText('Degrees').value).toBe('90')

    fireEvent.click(screen.getByRole('radio', { name: '#5d6b7a' }))
    fireEvent.click(screen.getByRole('button', { name: /^Lock/ }))
    expect(screen.getByText(/Locked: unlock it/)).toBeTruthy()
    expect(screen.getByLabelText('From left wall').disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Delete/ }).disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(scene().items).toBe('armchair')
  })

  it('sizes the shape from an unambiguous product size', async () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    add('two-door wardrobe')
    const picker = await screen.findByLabelText('Product')
    expect(screen.getByText(/4′ wide × 2′ deep × 7′ high/)).toBeTruthy()
    fireEvent.change(picker, { target: { value: 'ikea-brimnes-wardrobe' } })
    expect(screen.getByText(/The 3D shape uses this size/)).toBeTruthy()
    expect(screen.getByText(/2′ 7″ wide × 1′ 8″ deep × 6′ 3″ high/)).toBeTruthy()
  })
})

describe('catalog', () => {
  it('searches, filters, sorts and shows an empty state', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    const list = () => within(screen.getByRole('list', { name: 'Furniture' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    fireEvent.change(screen.getByLabelText('Search furniture'), { target: { value: 'LAMP' } })
    expect(list()).toEqual(['Add floor lamp', 'Add table lamp', 'Add work lamp'])
    fireEvent.change(screen.getByLabelText('Search furniture'), { target: { value: 'spaceship' } })
    expect(screen.getByText(/No furniture matches “spaceship”/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Beds' }))
    expect(list()).toEqual(['Add queen bed', 'Add bunk bed', 'Add single bed'])
  })

  it('a mouse click starts a placement preview; clicking the floor places it; Esc cancels', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add dining table' }), { detail: 1 })
    expect(scene().placing).toBe('dining-table')
    expect(screen.getByText(/Click the floor to place the dining table/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'place on floor' }))
    expect(scene().items).toBe('dining-table')
    expect(scene().placing).toBe('')
    expect(screen.getByRole('button', { name: 'Add dining table (recently used)' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add vase' }), { detail: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(scene().placing).toBe('')
    expect(scene().items).toBe('dining-table')
  })

  it('a lamp added from the keyboard lands on the table', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    add('bedside table')
    add('table lamp')
    expect(scene().items).toBe('bedside-table,table-lamp@1.75')
  })
})

describe('object list', () => {
  it('selects, renames, hides and locks items, all undoable', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    add('three-seater sofa')
    add('floor plant')
    openTab('Room')
    fireEvent.click(screen.getByRole('button', { name: /In this room \(2\)/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide Floor plant' }))
    expect(scene().items).toBe('sofa,plant(hidden)')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(scene().items).toBe('sofa,plant')

    fireEvent.click(screen.getByRole('button', { name: 'Rename Three-seater sofa' }))
    fireEvent.change(screen.getByLabelText('New name for Three-seater sofa'), { target: { value: 'Big sofa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lock Big sofa' }))
    expect(screen.getByRole('button', { name: 'Delete Big sofa' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Delete Big sofa' }).disabled).toBe(false)
  })
})

describe('finishes', () => {
  it('paints all walls, wallpapers one, and sets floor material, direction, size and finish', () => {
    render(<RoomDesigner form={form} onClose={() => {}} />)
    const walls = () => JSON.parse(scene().walls)
    const floor = () => JSON.parse(scene().floor)
    openTab('Walls')
    fireEvent.click(screen.getByRole('button', { name: 'Cool' }))
    fireEvent.click(screen.getByRole('radio', { name: '#9fb3bf' }))
    expect(Object.values(walls()).every((w) => w.color === '#9fb3bf')).toBe(true)
    const wallSection = screen.getByRole('heading', { name: 'All walls' }).parentElement
    fireEvent.click(within(wallSection).getByRole('radio', { name: 'Satin' }))
    expect(walls().left.sheen).toBe('satin')

    fireEvent.click(screen.getByRole('button', { name: /^left wall/i }))
    const wallTools = screen.getByRole('complementary', { name: 'Wall tools' })
    fireEvent.click(within(wallTools).getByRole('radio', { name: 'Wallpaper' }))
    fireEvent.click(within(wallTools).getByRole('radio', { name: 'Geometric' }))
    expect(walls().left).toMatchObject({ kind: 'wallpaper', pattern: 'geometric' })
    expect(walls().back.kind).toBe('paint')
    fireEvent.keyDown(window, { key: 'Escape' })

    openTab('Floor')
    fireEvent.click(screen.getByRole('radio', { name: 'Dark wood' }))
    fireEvent.click(screen.getByRole('radio', { name: '45°' }))
    fireEvent.change(screen.getByRole('slider', { name: /Pattern size/ }), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Polished' }))
    expect(floor()).toMatchObject({ material: 'dark-wood', rotation: 45, scale: 1.5, sheen: 'polished' })
  })
})
