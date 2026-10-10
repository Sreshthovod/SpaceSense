// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DesignStudio, { APPROVAL_QUESTION } from './DesignStudio'
import { editRoomPhoto } from '../../services/api'

vi.mock('../../services/api', () => ({ editRoomPhoto: vi.fn() }))

const form = { roomType: 'Living room', length: '14', width: '12', height: '9', style: 'scandinavian', budget: '60000', vastu: false }
const photo = new File(['png'], 'room.png', { type: 'image/png' })
const ORIGINAL = 'blob:original-photo'
const EDITED = 'data:image/png;base64,RURJVEVE'
const recommendations = {
  summary: 'Bright room.', layout: ['Float the sofa'], keep: ['Oak floor'], replace: ['Grey sofa'],
  colors: ['Warm white walls'], lighting: [], decor: ['Linen curtains'], budget_tips: ['Paint first'],
}

const renderStudio = () => render(<DesignStudio form={form} photo={photo} originalUrl={ORIGINAL} recommendations={recommendations} />)
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))
const imgSrcs = () => screen.getAllByRole('img').map((i) => i.getAttribute('src'))

// Braces matter: a function returned from beforeEach is run as a teardown hook.
beforeEach(() => { vi.mocked(editRoomPhoto).mockReset() })
afterEach(cleanup)

describe('DesignStudio approval flow', () => {
  it('asks for approval and does not edit on render', () => {
    renderStudio()
    expect(screen.getByText(APPROVAL_QUESTION)).toBeTruthy()
    for (const name of [/yes, edit my photo/i, /change recommendations/i, /not now/i]) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
    expect(editRoomPhoto).not.toHaveBeenCalled()
    expect(imgSrcs()).toEqual([ORIGINAL])
  })

  it('"Not now" leaves the original photo unchanged and does not edit', () => {
    renderStudio()
    click(/not now/i)
    expect(screen.getByText(/original photo is unchanged/i)).toBeTruthy()
    expect(editRoomPhoto).not.toHaveBeenCalled()
    expect(imgSrcs()).toEqual([ORIGINAL])
    click(/review and apply changes/i)
    expect(screen.getByText(APPROVAL_QUESTION)).toBeTruthy()
  })

  it('"Change recommendations" never edits, and the saved selection is what gets sent', async () => {
    vi.mocked(editRoomPhoto).mockResolvedValue({ status: 'edited', image_url: EDITED, message: 'Edited.' })
    renderStudio()
    click(/change recommendations/i)
    fireEvent.click(screen.getByLabelText('Grey sofa')) // deselect
    fireEvent.change(screen.getByLabelText(/anything else/i), { target: { value: 'Keep my bookshelf' } })
    click(/save changes/i)
    expect(editRoomPhoto).not.toHaveBeenCalled()

    click(/yes, edit my photo/i)
    await waitFor(() => expect(editRoomPhoto).toHaveBeenCalledTimes(1))
    const [args] = vi.mocked(editRoomPhoto).mock.calls[0]
    expect(args.photo).toBe(photo) // the original upload
    expect(args.items).toEqual(['Float the sofa', 'Keep as is: Oak floor', 'Warm white walls', 'Linen curtains'])
    expect(args.items.join()).not.toMatch(/Grey sofa|Paint first/) // deselected item and budget tips excluded
    expect(args.notes).toBe('Keep my bookshelf')
  })

  it('shows the actual edited image as "after" and the original upload as "before"', async () => {
    vi.mocked(editRoomPhoto).mockResolvedValue({ status: 'edited', image_url: EDITED, message: 'AI-edited version.' })
    renderStudio()
    click(/yes, edit my photo/i)
    expect(await screen.findByAltText(/ai-edited version of your room/i)).toBeTruthy()
    expect(screen.getByAltText(/ai-edited version of your room/i).getAttribute('src')).toBe(EDITED)
    expect(screen.getByAltText(/your original room photo/i).getAttribute('src')).toBe(ORIGINAL)
    expect(screen.getByRole('slider', { name: /compare/i })).toBeTruthy()
  })

  it('on failure shows an honest error, no after image, and keeps the original', async () => {
    vi.mocked(editRoomPhoto).mockImplementation(async () => { throw new Error('The image editor did not return an edited photo. Your original photo is unchanged.') })
    renderStudio()
    click(/yes, edit my photo/i)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByAltText(/ai-edited/i)).toBeNull()
    expect(imgSrcs()).toEqual([ORIGINAL])
  })

  it('a mock response never shows an after image', async () => {
    vi.mocked(editRoomPhoto).mockResolvedValue({ status: 'mock', image_url: null, message: 'Image editing is not configured.' })
    renderStudio()
    click(/yes, edit my photo/i)
    expect(await screen.findByText(/no edited photo was created/i)).toBeTruthy()
    expect(imgSrcs()).toEqual([ORIGINAL])
  })

  it('a mock response that somehow carries a URL is still not shown', async () => {
    vi.mocked(editRoomPhoto).mockResolvedValue({ status: 'mock', image_url: EDITED, message: 'mock' })
    renderStudio()
    click(/yes, edit my photo/i)
    await screen.findByText(/no edited photo was created/i)
    expect(imgSrcs()).toEqual([ORIGINAL])
  })

  it('double-clicking approve sends a single edit request', async () => {
    let resolve
    vi.mocked(editRoomPhoto).mockImplementation(() => new Promise((r) => { resolve = r }))
    renderStudio()
    const yes = screen.getByRole('button', { name: /yes, edit my photo/i })
    fireEvent.click(yes); fireEvent.click(yes)
    expect(editRoomPhoto).toHaveBeenCalledTimes(1)
    resolve({ status: 'mock', image_url: null, message: 'm' })
    await screen.findByText(/no edited photo was created/i)
  })
})
