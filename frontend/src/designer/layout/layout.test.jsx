// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Home, Sofa } from 'lucide-react'
import SceneBoundary from '../scene/SceneBoundary'
import Sidebar from './Sidebar'

afterEach(cleanup)

function Boom() {
  throw new Error('render failed')
}

describe('SceneBoundary', () => {
  it('shows a reload button instead of crashing, and reloads on request', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReload = vi.fn()
    const { rerender } = render(<SceneBoundary onReload={onReload}><Boom /></SceneBoundary>)
    expect(screen.getByRole('alert').textContent).toMatch('The 3D view stopped working')
    rerender(<SceneBoundary onReload={onReload}><p>scene</p></SceneBoundary>)
    fireEvent.click(screen.getByRole('button', { name: /Reload 3D view/ }))
    expect(onReload).toHaveBeenCalledOnce()
    expect(screen.getByText('scene')).toBeTruthy()
    console.error.mockRestore()
  })

  it('explains a lost graphics context', () => {
    render(<SceneBoundary lost onReload={() => {}}><p>scene</p></SceneBoundary>)
    expect(screen.getByRole('alert').textContent).toMatch('graphics card')
  })
})

describe('Sidebar', () => {
  function Harness() {
    const [tab, setTab] = useState('a')
    return <Sidebar tab={tab} setTab={setTab} tabs={[{ id: 'a', label: 'Furniture', icon: Sofa, content: <p>chairs</p> }, { id: 'b', label: 'Room', icon: Home, content: <p>size</p> }]} />
  }

  it('switches tabs by click and arrow keys, keeping other panels mounted but hidden', () => {
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'Furniture' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('size', { selector: 'p' }).closest('[role=tabpanel]').hidden).toBe(true)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Furniture' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Room' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement.textContent).toMatch('Room')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Room' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Furniture' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Room' }))
    expect(screen.getByRole('tabpanel').textContent).toBe('size')
  })
})
