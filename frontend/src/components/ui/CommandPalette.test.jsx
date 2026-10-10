// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CommandPalette from './CommandPalette'

afterEach(cleanup)

function Harness({ commands, enabled = true }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button">Somewhere</button>
      <CommandPalette commands={commands} open={open} onOpenChange={setOpen} enabled={enabled} />
    </>
  )
}

const make = () => {
  const dark = vi.fn()
  const designer = vi.fn()
  return {
    dark,
    designer,
    commands: [
      { id: 'designer', group: 'Actions', label: 'Open the 3D room designer', run: designer },
      { id: 'dark', group: 'Appearance', label: 'Dark theme', run: dark },
    ],
  }
}

describe('CommandPalette', () => {
  it('opens with Ctrl/Cmd+K, filters, and runs the chosen action with Enter', async () => {
    const { commands, dark, designer } = make()
    render(<Harness commands={commands} />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = await screen.findByRole('combobox', { name: 'Search actions' })
    expect(screen.getAllByRole('option')).toHaveLength(2)
    fireEvent.change(input, { target: { value: 'dark' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Dark theme'])
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(dark).toHaveBeenCalledTimes(1))
    expect(designer).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('moves with the arrow keys and closes on Esc without running anything', async () => {
    const { commands, dark, designer } = make()
    render(<Harness commands={commands} />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = await screen.findByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'Escape' })
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(dark).not.toHaveBeenCalled()
    expect(designer).not.toHaveBeenCalled()
  })

  it('shows an empty state and ignores the shortcut while disabled', async () => {
    const { commands } = make()
    const { unmount } = render(<Harness commands={commands} />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'zzz' } })
    expect(screen.getByText(/Nothing matches/)).toBeTruthy()
    unmount()
    render(<Harness commands={commands} enabled={false} />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
