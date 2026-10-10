// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from './ToastContext'
import { useToast } from './toast'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Trigger({ message, options }) {
  const { toast } = useToast()
  return <button type="button" onClick={() => toast(message, options)}>Notify</button>
}

describe('toasts', () => {
  it('shows a message in a polite live region and hides it after a while', () => {
    vi.useFakeTimers()
    render(<ToastProvider><Trigger message="Link copied" /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    const region = screen.getByRole('list', { name: 'Notifications' })
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(screen.getByText('Link copied')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText('Link copied')).toBeNull()
  })

  it('can be dismissed, and runs its action once', () => {
    vi.useFakeTimers()
    const undo = vi.fn()
    render(<ToastProvider><Trigger message="Removed" options={{ action: { label: 'Undo', onClick: undo } }} /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.queryByText('Removed')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.queryByText('Removed')).toBeNull()
  })

  it('keeps at most four on screen', () => {
    render(<ToastProvider><Trigger message="Saved" /></ToastProvider>)
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getAllByText('Saved')).toHaveLength(4)
  })

  it('does nothing outside a provider', () => {
    render(<Trigger message="Lost" />)
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.queryByText('Lost')).toBeNull()
  })
})
