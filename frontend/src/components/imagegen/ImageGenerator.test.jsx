// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ImageGenerator from './ImageGenerator'
import { editImage, generateImage, getImageProviders } from '../../services/api'

vi.mock('../../services/api', () => ({ generateImage: vi.fn(), editImage: vi.fn(), getImageProviders: vi.fn() }))

const DATA_URL = 'data:image/jpeg;base64,/9j/AAAA'
const type = (text) => fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: text } })
const generate = () => fireEvent.click(screen.getByRole('button', { name: /generate/i }))
const upload = (file) => fireEvent.change(document.querySelector('input[type=file]'), { target: { files: [file] } })

beforeEach(() => {
  vi.mocked(generateImage).mockReset()
  vi.mocked(editImage).mockReset()
  vi.mocked(getImageProviders).mockReset().mockResolvedValue({ cloudflare: true, gemini: true })
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})
afterEach(cleanup)

describe('ImageGenerator', () => {
  it('disables Generate until there is a prompt', () => {
    render(<ImageGenerator />)
    expect(screen.getByRole('button', { name: /generate/i }).disabled).toBe(true)
    type('  ')
    expect(screen.getByRole('button', { name: /generate/i }).disabled).toBe(true)
    type('a cosy room')
    expect(screen.getByRole('button', { name: /generate/i }).disabled).toBe(false)
  })

  it('generates from text, shows the image and offers a download', async () => {
    vi.mocked(generateImage).mockResolvedValue({ image: DATA_URL })
    render(<ImageGenerator />)
    type(' a cosy room ')
    generate()
    expect(await screen.findByAltText(/a cosy room/)).toBeTruthy()
    expect(vi.mocked(generateImage).mock.calls[0][0]).toEqual({ prompt: 'a cosy room', provider: 'cloudflare' })
    expect(editImage).not.toHaveBeenCalled()
    const link = screen.getByRole('link', { name: /download/i })
    expect(link.getAttribute('href')).toBe(DATA_URL)
    expect(link.getAttribute('download')).toBe('spacesense-image.jpg')
  })

  it('uses the edit route when an image is uploaded, and can remove it again', async () => {
    vi.mocked(editImage).mockResolvedValue({ image: DATA_URL })
    render(<ImageGenerator />)
    const file = new File(['x'], 'room.png', { type: 'image/png' })
    upload(file)
    expect(screen.getByText('room.png')).toBeTruthy()
    type('make it warmer')
    generate()
    await screen.findByAltText(/make it warmer/)
    expect(vi.mocked(editImage).mock.calls[0][0]).toEqual({ prompt: 'make it warmer', file, provider: 'cloudflare' })
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(screen.queryByText('room.png')).toBeNull()
  })

  it('rejects the wrong file type and oversize files before sending anything', () => {
    render(<ImageGenerator />)
    upload(new File(['x'], 'a.gif', { type: 'image/gif' }))
    expect(screen.getByRole('alert').textContent).toMatch(/PNG, JPEG or WebP/)
    upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))
    expect(screen.getByRole('alert').textContent).toMatch(/5 MB/)
    upload(new File(['x'], 'ok.webp', { type: 'image/webp' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('ok.webp')).toBeTruthy()
  })

  it('shows the server message when generation fails, with a loading state before', async () => {
    let reject
    vi.mocked(generateImage).mockReturnValue(new Promise((_, r) => { reject = r }))
    render(<ImageGenerator />)
    type('a room')
    generate()
    expect(await screen.findByText(/Creating your image/)).toBeTruthy()
    reject(new Error('The free image-generation allowance has been used up for now. Please try again later.'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/allowance has been used up/)
  })

  it('sends the chosen provider for text and for uploads', async () => {
    vi.mocked(generateImage).mockResolvedValue({ image: DATA_URL })
    vi.mocked(editImage).mockResolvedValue({ image: DATA_URL })
    render(<ImageGenerator />)
    fireEvent.click(screen.getByRole('radio', { name: /gemini/i }))
    type('a room')
    generate()
    await screen.findByAltText(/a room/)
    expect(vi.mocked(generateImage).mock.calls[0][0].provider).toBe('gemini')
    const file = new File(['x'], 'room.png', { type: 'image/png' })
    upload(file)
    generate()
    await vi.waitFor(() => expect(editImage).toHaveBeenCalled())
    expect(vi.mocked(editImage).mock.calls[0][0]).toEqual({ prompt: 'a room', file, provider: 'gemini' })
  })

  it('disables a provider the server has no key for and starts on the other one', async () => {
    vi.mocked(getImageProviders).mockResolvedValue({ cloudflare: false, gemini: true })
    vi.mocked(generateImage).mockResolvedValue({ image: DATA_URL })
    render(<ImageGenerator />)
    await vi.waitFor(() => expect(screen.getByRole('radio', { name: /cloudflare/i }).disabled).toBe(true))
    expect(screen.getByText('(not set up)')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /gemini/i }).checked).toBe(true)
    type('a room')
    generate()
    await screen.findByAltText(/a room/)
    expect(vi.mocked(generateImage).mock.calls[0][0].provider).toBe('gemini')
  })
})
