// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle, { ThemeChoice } from './ThemeToggle'

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

describe('ThemeChoice', () => {
  it('offers Light, Dark and System, and System forgets the saved choice', () => {
    root.dataset.theme = 'light'
    const setSystem = mockSystem(true)
    render(<ThemeChoice />)
    const radio = (name) => screen.getByRole('radio', { name })
    expect(radio('System').getAttribute('aria-checked')).toBe('true')

    fireEvent.click(radio('Light'))
    expect(localStorage.getItem('spacesense-theme')).toBe('light')
    expect(root.dataset.theme).toBe('light')
    expect(radio('Light').getAttribute('aria-checked')).toBe('true')

    fireEvent.click(radio('System'))
    expect(localStorage.getItem('spacesense-theme')).toBeNull()
    expect(root.dataset.theme).toBe('dark') // the system is dark
    setSystem(false)
    expect(root.dataset.theme).toBe('light') // and it follows the system again
  })

  it('keeps the browser chrome colour in step with the theme', () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
    root.dataset.theme = 'light'
    render(<ThemeChoice />)
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(meta.getAttribute('content')).toBe('#161713')
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(meta.getAttribute('content')).toBe('#f7f5f0')
    meta.remove()
  })
})
