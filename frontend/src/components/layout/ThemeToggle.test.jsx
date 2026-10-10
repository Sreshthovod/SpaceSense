// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from './ThemeToggle'

const root = document.documentElement

function mockSystem(dark) {
  const listeners = new Set()
  const query = {
    matches: dark,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  }
  window.matchMedia = vi.fn(() => query)
  return (nextDark) => { query.matches = nextDark; listeners.forEach((fn) => fn()) }
}

beforeEach(() => {
  localStorage.clear()
  delete root.dataset.theme
  mockSystem(false)
})
afterEach(cleanup)

describe('ThemeToggle', () => {
  it('is a pressed/unpressed toggle that reflects the current theme', () => {
    root.dataset.theme = 'light'
    render(<ThemeToggle />)
    const button = screen.getByRole('button', { name: 'Dark mode' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(root.dataset.theme).toBe('dark')
    fireEvent.click(button)
    expect(root.dataset.theme).toBe('light')
  })

  it('remembers the choice', () => {
    root.dataset.theme = 'light'
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' }))
    expect(localStorage.getItem('spacesense-theme')).toBe('dark')
  })

  it('still works when storage is blocked', () => {
    root.dataset.theme = 'light'
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' }))
    expect(root.dataset.theme).toBe('dark')
    vi.restoreAllMocks()
  })

  it('follows the system setting until the user chooses', () => {
    root.dataset.theme = 'light'
    const setSystem = mockSystem(false)
    render(<ThemeToggle />)
    setSystem(true)
    expect(root.dataset.theme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Dark mode' })) // user picks light
    setSystem(true)
    expect(root.dataset.theme).toBe('light') // their choice now wins over the system
  })

  it('syncs when another tab changes the theme', () => {
    root.dataset.theme = 'light'
    render(<ThemeToggle />)
    fireEvent(window, new StorageEvent('storage', { key: 'spacesense-theme', newValue: 'dark' }))
    expect(root.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Dark mode' }).getAttribute('aria-pressed')).toBe('true')
  })
})
