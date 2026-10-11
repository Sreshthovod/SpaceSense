// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AiLayoutPanel from './AiLayoutPanel'
import { aiLayout, getImageProviders } from '../../services/api'
import { createDesign } from '../model/design'
import { designReducer } from '../model/reducer'
import { floorWarnings } from '../model/floorPlacement'

vi.mock('../../services/api', () => ({ aiLayout: vi.fn(), getImageProviders: vi.fn() }))

const empty = () => createDesign({ form: { length: 14, width: 12, height: 9, style: 'scandinavian', budget: 60000 } })
const furnished = () => designReducer(empty(), { type: 'addFloorItem', uid: 'old1', catalogId: 'pouf' })
const photo = new File(['png'], 'room.png', { type: 'image/png' })
const PROPOSAL = {
  summary: 'Sofa on the back wall.',
  accent_wall: null,
  floor: [{ type: 'sofa', x: 0, z: -5.5, rotation: 0 }, { type: 'coffee-table', x: 0, z: -2, rotation: 0 }],
  wall: [],
}

const renderPanel = (props = {}) => {
  const onApply = vi.fn()
  render(<AiLayoutPanel design={empty()} roomType="Living room" photo={null} onApply={onApply} onDialog={() => {}} {...props} />)
  return onApply
}
const arrange = () => fireEvent.click(screen.getByRole('button', { name: /arrange with ai/i }))

beforeEach(() => {
  vi.mocked(aiLayout).mockReset().mockResolvedValue(PROPOSAL)
  vi.mocked(getImageProviders).mockReset().mockResolvedValue({ cloudflare: false, gemini: true })
})
afterEach(cleanup)

describe('AiLayoutPanel', () => {
  it('sends the room, the catalog, an example and the note, and applies the placed layout', async () => {
    const onApply = renderPanel()
    fireEvent.change(screen.getByLabelText(/anything specific/i), { target: { value: '  cosy reading corner  ' } })
    arrange()
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    const [args] = vi.mocked(aiLayout).mock.calls[0]
    expect(args.room).toEqual({ room_type: 'Living room', length_ft: 14, width_ft: 12, height_ft: 9, style: 'scandinavian', budget_inr: 60000, vastu: false })
    expect(args.options.notes).toBe('cosy reading corner')
    expect(args.options.floor.map((f) => f.id)).toContain('sofa')
    expect(args.options.wall.map((w) => w.id)).toContain('window')
    expect(args.options.example.floor.length).toBeGreaterThan(3)
    expect(args.photo).toBeNull()
    const next = onApply.mock.calls[0][0]
    expect(next.items.map((i) => i.catalogId).sort()).toEqual(['coffee-table', 'sofa'])
    expect(args.options.variants).toBe(3)
    expect(await screen.findByText(/Sofa on the back wall\. 2 pieces placed\. Added a door and a window\. Layout score \d+ → \d+\/100 after fine-tuning.*Undo brings your last design back/)).toBeTruthy()
    expect(next.openings.map((o) => o.catalogId).sort()).toEqual(['door', 'window'])
  })

  it('only offers to send the photo when there is one, and never sends it unless ticked', async () => {
    const { unmount } = render(<AiLayoutPanel design={empty()} roomType="Bedroom" photo={null} onApply={() => {}} onDialog={() => {}} />)
    expect(screen.queryByRole('checkbox', { name: /send my photo/i })).toBeNull()
    unmount()
    const onApply = renderPanel({ photo })
    const box = screen.getByRole('checkbox', { name: /send my photo/i })
    expect(box.checked).toBe(false)
    expect(screen.getByText(/Google may use it to improve its products/)).toBeTruthy()
    arrange()
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    expect(vi.mocked(aiLayout).mock.calls[0][0].photo).toBeNull()
    fireEvent.click(box)
    arrange()
    await waitFor(() => expect(aiLayout).toHaveBeenCalledTimes(2))
    expect(vi.mocked(aiLayout).mock.calls[1][0].photo).toBe(photo)
  })

  it('reports what did not fit, by name', async () => {
    vi.mocked(aiLayout).mockResolvedValue({
      ...PROPOSAL,
      // No table anywhere, so the lamp has nothing to stand on.
      floor: [PROPOSAL.floor[0], { type: 'table-lamp', x: 3, z: 3, rotation: 0 }, { type: 'nonsense', x: 0, z: 0, rotation: 0 }],
    })
    renderPanel()
    arrange()
    expect(await screen.findByText(/2 didn't fit and were left out \(.*Table lamp.*\)/)).toBeTruthy()
  })

  it('says how many pieces were moved a little to fit', async () => {
    vi.mocked(aiLayout).mockResolvedValue({ ...PROPOSAL, floor: [...PROPOSAL.floor, { type: 'pouf', x: 0, z: -5.5, rotation: 0 }] })
    renderPanel()
    arrange()
    expect(await screen.findByText(/3 pieces placed\. Added a door and a window\. 1 was moved a little to fit\./)).toBeTruthy()
  })

  it('changes nothing and says so when none of the layout fits', async () => {
    vi.mocked(aiLayout).mockResolvedValue({ ...PROPOSAL, floor: [{ type: 'nonsense', x: 0, z: 0, rotation: 0 }], wall: [] })
    const onApply = renderPanel()
    arrange()
    expect((await screen.findByRole('alert')).textContent).toMatch(/nothing was changed/)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('shows the server message when the request fails, and leaves the design alone', async () => {
    vi.mocked(aiLayout).mockRejectedValue(new Error('The AI service has reached its usage limit. Please try again later.'))
    const onApply = renderPanel()
    arrange()
    expect((await screen.findByRole('alert')).textContent).toMatch(/usage limit/)
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /arrange with ai/i }).disabled).toBe(false) // can retry
  })

  it('is disabled with a reason when the server has no Gemini key', async () => {
    vi.mocked(getImageProviders).mockResolvedValue({ cloudflare: true, gemini: false })
    renderPanel()
    await waitFor(() => expect(screen.getByRole('button', { name: /arrange with ai/i }).disabled).toBe(true))
    expect(screen.getByText(/needs a Gemini key on the server/)).toBeTruthy()
  })

  it('asks before replacing a furnished room, and does not call the AI if you cancel', async () => {
    const onApply = renderPanel({ design: furnished() })
    arrange()
    expect(screen.getByText('Replace this room with an AI layout?')).toBeTruthy()
    expect(aiLayout).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Replace this room with an AI layout?')).toBeNull()
    expect(aiLayout).not.toHaveBeenCalled()
    arrange()
    const dialog = screen.getByText('Replace this room with an AI layout?').closest('[aria-labelledby="confirm-title"]')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Arrange with AI' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(aiLayout).toHaveBeenCalledTimes(1)
  })

  it('goes straight to the AI when the room is empty', async () => {
    const onApply = renderPanel()
    arrange()
    expect(screen.queryByText('Replace this room with an AI layout?')).toBeNull()
    await waitFor(() => expect(onApply).toHaveBeenCalled())
  })

  it('ignores a second click while a request is running', async () => {
    let resolve
    vi.mocked(aiLayout).mockReturnValue(new Promise((r) => { resolve = r }))
    const onApply = renderPanel()
    arrange()
    expect(await screen.findByText('Arranging…')).toBeTruthy()
    expect(screen.getByRole('button', { name: /arranging/i }).disabled).toBe(true)
    resolve(PROPOSAL)
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(aiLayout).toHaveBeenCalledTimes(1)
  })

  it('Vastu mode sends the room direction and reports how the result follows the guidelines', async () => {
    const onApply = renderPanel({ design: { ...empty(), facing: 'north' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /vastu mode/i }))
    arrange()
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    const [args] = vi.mocked(aiLayout).mock.calls[0]
    expect(args.room.vastu).toBe(true)
    expect(args.options.compass_back).toBe('north')
    expect(onApply.mock.calls[0][0].facing).toBe('north') // the layout keeps the room's direction
    expect(await screen.findByText(/Vastu check: \d of \d guidelines followed/)).toBeTruthy()
  })

  it('Vastu mode asks for the room direction first, and starts on when the brief asked for Vastu', () => {
    const onFacing = vi.fn()
    renderPanel({ vastuDefault: true, onFacing })
    expect(screen.getByRole('checkbox', { name: /vastu mode/i }).checked).toBe(true)
    expect(screen.getByText(/needs the room's direction/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /arrange with ai/i }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Back wall faces east' }))
    expect(onFacing).toHaveBeenCalledWith('east')
  })

  it('without Vastu mode no direction is sent', async () => {
    const onApply = renderPanel({ design: { ...empty(), facing: 'north' } })
    arrange()
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    const [args] = vi.mocked(aiLayout).mock.calls[0]
    expect(args.room.vastu).toBe(false)
    expect(args.options).not.toHaveProperty('compass_back')
  })

  it('scores every layout the AI sends and applies the best one', async () => {
    // The main proposal crams the sofa into the middle; the alternative puts it against the wall with the table in front.
    vi.mocked(aiLayout).mockResolvedValue({
      summary: 'Sofa in the middle.',
      floor: [{ type: 'sofa', x: 0, z: 0, rotation: 90 }, { type: 'coffee-table', x: 4, z: 5, rotation: 0 }],
      wall: [],
      alternatives: [{ summary: 'Sofa on the back wall.', floor: PROPOSAL.floor, wall: [] }],
    })
    const onApply = renderPanel()
    arrange()
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/Best of 2 AI layouts/)).toBeTruthy()
    const next = onApply.mock.calls[0][0]
    expect(next.items.map((i) => i.catalogId).sort()).toEqual(['coffee-table', 'sofa'])
    expect(floorWarnings(next)).toEqual([])
  })
})
