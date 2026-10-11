// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoomForm from './RoomForm'
import FloorPlan from './FloorPlan'

const EMPTY = { roomType: '', length: '', width: '', height: '', style: '', budget: '', vastu: false, entryDirection: '' }

function Harness({ onSubmit = () => {} }) {
  const [form, setForm] = useState(EMPTY)
  const [image, setImageState] = useState({ file: null, url: '' })
  const setImage = (file) => setImageState({ file, url: file ? 'blob:room' : '' })
  return <RoomForm form={form} setForm={setForm} image={image} setImage={setImage} onSubmit={onSubmit} submitting={false} apiError="" />
}

const brief = () => screen.getByRole('complementary', { name: 'Live brief' })
const type = (label, value) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } })
const upload = () => fireEvent.change(document.querySelector('input[type=file]'), { target: { files: [new File(['x'], 'room.jpg', { type: 'image/jpeg' })] } })
const cont = () => fireEvent.click(screen.getByRole('button', { name: /continue/i }))

beforeEach(() => { vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} })) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('RoomForm', () => {
  it('will not continue with missing details, and says what is missing', () => {
    render(<Harness />)
    cont()
    expect(screen.getByText(/upload a photo/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /step 1: photo & room/i }).getAttribute('aria-current')).toBe('step')
    expect(screen.getByLabelText(/^Length/).getAttribute('aria-invalid')).toBe('true')
  })

  it('the live brief follows the form, and counts only what is really filled in', () => {
    render(<Harness />)
    expect(within(brief()).getByText('0 of 5 ready')).toBeTruthy()
    expect(within(brief()).getByText('Choose a room type')).toBeTruthy()
    upload()
    type('Room type', 'Bedroom')
    type('Length', '16')
    type('Width', '12.5')
    expect(within(brief()).getByText('Bedroom')).toBeTruthy()
    expect(within(brief()).getByText(/200 sq ft/, { selector: 'span' })).toBeTruthy()
    expect(within(brief()).getByText('2 of 5 ready')).toBeTruthy() // dimensions aren't complete without the height
    type('Height', '10')
    expect(within(brief()).getByText('3 of 5 ready')).toBeTruthy()
    expect(within(brief()).getByRole('img', { name: 'Approximate plan of a 16 by 12.5 foot room' })).toBeTruthy()
  })

  it('moves through the steps with the stepper showing where you are, and keeps what you entered', () => {
    render(<Harness />)
    upload()
    type('Room type', 'Bedroom'); type('Length', '16'); type('Width', '12'); type('Height', '10')
    cont()
    expect(screen.getByRole('button', { name: /step 2: style & budget/i }).getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('button', { name: /step 1: photo & room \(done\)/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByLabelText(/^Length/).value).toBe('16')
  })
})

describe('FloorPlan', () => {
  it('only draws the room for dimensions in the allowed range', () => {
    const { rerender } = render(<FloorPlan length="2" width="12" />)
    expect(screen.getByRole('img', { name: /enter length and width/i })).toBeTruthy()
    rerender(<FloorPlan length="20" width="10" height="9" />)
    expect(screen.getByRole('img', { name: 'Approximate plan of a 20 by 10 foot room' })).toBeTruthy()
    expect(screen.getByText(/9 ft ceiling/)).toBeTruthy()
  })
})
