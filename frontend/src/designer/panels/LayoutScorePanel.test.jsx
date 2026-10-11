// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LayoutScorePanel from './LayoutScorePanel'
import { createDesign } from '../model/design'
import { designReducer } from '../model/reducer'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const messy = () => {
  let d = createDesign({ form: { length: 14, width: 12, height: 9 } })
  d = designReducer(d, { type: 'addWallItem', uid: 'door1', catalogId: 'door', wall: 'right', x: 11.5 })
  d = designReducer(d, { type: 'addFloorItem', uid: 'sofa1', catalogId: 'sofa', x: -0.5, z: -1.5, rotation: 90 })
  d = designReducer(d, { type: 'addFloorItem', uid: 'table1', catalogId: 'coffee-table', x: 3, z: 4.5, rotation: 0 })
  return d
}

function Harness({ start, onFocus = () => {} }) {
  const [design, setDesign] = useState(start)
  return <LayoutScorePanel design={design} roomType="Living room" onApply={setDesign} onFocus={onFocus} />
}

describe('LayoutScorePanel', () => {
  it('shows a score with a named breakdown, and Improve layout raises it in one step', () => {
    vi.useFakeTimers()
    render(<Harness start={messy()} />)
    const before = Number(screen.getByTestId('layout-score').textContent)
    expect(screen.getByRole('list', { name: 'Score breakdown' }).textContent).toMatch(/Seats face the right way/)
    fireEvent.click(screen.getByRole('button', { name: /Improve layout/ }))
    act(() => { vi.advanceTimersByTime(100) })
    const after = Number(screen.getByTestId('layout-score').textContent)
    expect(after).toBeGreaterThan(before)
    expect(screen.getByRole('status').textContent).toMatch(/Score \d+ → \d+ with \d+ adjustment/)
  })

  it('points at the pieces behind a weak score', () => {
    const onFocus = vi.fn()
    render(<Harness start={messy()} onFocus={onFocus} />)
    fireEvent.click(screen.getAllByTitle('Select the piece this is about')[0])
    expect(['sofa1', 'table1']).toContain(onFocus.mock.calls[0][0])
  })

  it('asks for furniture when the room is empty, and Vastu needs a direction', () => {
    render(<Harness start={createDesign({})} />)
    expect(screen.getByText(/Place some furniture/)).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Include Vastu/ }).disabled).toBe(true)
  })
})
