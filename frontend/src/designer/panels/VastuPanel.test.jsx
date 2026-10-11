// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VastuPanel from './VastuPanel'
import { createDesign } from '../model/design'
import { designReducer } from '../model/reducer'

afterEach(cleanup)

const base = () => {
  let d = createDesign({ form: { length: 14, width: 12, height: 9 } })
  d = designReducer(d, { type: 'addFloorItem', uid: 'sofa1', catalogId: 'sofa', x: 0, z: 5.4, rotation: 180 })
  d = designReducer(d, { type: 'addFloorItem', uid: 'shelf1', catalogId: 'bookshelf', x: 4.5, z: -6.3, rotation: 0 })
  return d
}

function Harness({ onFocus }) {
  const [design, setDesign] = useState(base)
  return <VastuPanel design={design} roomType="Living room" onFocus={onFocus} onFacing={(facing) => setDesign((d) => designReducer(d, { type: 'setFacing', facing }))} />
}

describe('VastuPanel', () => {
  it('asks for the direction, then scores the layout and points at the pieces to move', () => {
    const onFocus = vi.fn()
    render(<Harness onFocus={onFocus} />)
    expect(screen.getByText(/Set the room's direction above/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Back wall faces north' }))
    expect(screen.getByText('Back N · Right E · Front S · Left W')).toBeTruthy()
    const score = screen.getByTestId('vastu-score').textContent
    expect(score).toMatch(/^\d of \d followed$/)
    fireEvent.click(screen.getByRole('button', { name: /North-east corner kept light and clear: not followed/ }))
    expect(onFocus).toHaveBeenCalledWith(expect.any(String))
  })

  it('changes its verdict when the room faces another way', () => {
    render(<Harness onFocus={() => {}} />)
    // The bookshelf sits in the back-right corner: north-east when the back wall faces north, south-west when it faces south.
    fireEvent.click(screen.getByRole('radio', { name: 'Back wall faces north' }))
    expect(screen.getByRole('button', { name: /North-east corner kept light and clear: not followed/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Back wall faces south' }))
    expect(screen.getByText(/North-east corner kept light and clear/).parentElement.textContent).toMatch(/: followed$/)
  })
})
