// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatPanel from './ChatPanel'
import { sendChat } from '../../services/api'

vi.mock('../../services/api', () => ({ sendChat: vi.fn() }))

const form = { roomType: 'Living room', length: '14', width: '12', height: '9', style: 'scandinavian', budget: '60000', vastu: false }
const photo = new File(['png'], 'room.png', { type: 'image/png' })
const recommendations = { summary: 'Bright room.', layout: [], keep: [], replace: [], colors: [], lighting: [], decor: [], budget_tips: [] }

const renderChat = () => render(<ChatPanel form={form} photo={photo} recommendations={recommendations} />)
const type = (text) => fireEvent.change(screen.getByLabelText('Your question'), { target: { value: text } })
const send = () => fireEvent.click(screen.getByRole('button', { name: /send question/i }))

beforeEach(() => { vi.mocked(sendChat).mockReset() })
afterEach(cleanup)

describe('ChatPanel', () => {
  it('sends the question with the photo, room and recommendations, then shows the reply', async () => {
    vi.mocked(sendChat).mockResolvedValue({ reply: 'Try a warm oatmeal sofa.', provider: 'gemini' })
    renderChat()
    type('What colour sofa?')
    send()
    expect(screen.getByText('What colour sofa?')).toBeTruthy()
    expect(await screen.findByText('Try a warm oatmeal sofa.')).toBeTruthy()
    const [args] = vi.mocked(sendChat).mock.calls[0]
    expect(args.photo).toBe(photo)
    expect(args.form).toBe(form)
    expect(args.recommendations).toBe(recommendations)
    expect(args.messages).toEqual([{ role: 'user', content: 'What colour sofa?' }])
  })

  it('sends the full conversation on follow-ups', async () => {
    vi.mocked(sendChat).mockResolvedValueOnce({ reply: 'Light grey.', provider: 'gemini' })
      .mockResolvedValueOnce({ reply: 'Around ₹25,000.', provider: 'gemini' })
    renderChat()
    type('Sofa colour?'); send()
    await screen.findByText('Light grey.')
    type('Budget for it?'); send()
    await screen.findByText('Around ₹25,000.')
    expect(vi.mocked(sendChat).mock.calls[1][0].messages).toEqual([
      { role: 'user', content: 'Sofa colour?' },
      { role: 'assistant', content: 'Light grey.' }, // only role and content are sent
      { role: 'user', content: 'Budget for it?' },
    ])
  })

  it('suggested questions send immediately', async () => {
    vi.mocked(sendChat).mockResolvedValue({ reply: 'Start with the sofa.', provider: 'gemini' })
    renderChat()
    fireEvent.click(screen.getByRole('button', { name: /which piece should i buy first/i }))
    expect(await screen.findByText('Start with the sofa.')).toBeTruthy()
  })

  it('ignores empty input and blocks duplicate sends while waiting', async () => {
    let resolve
    vi.mocked(sendChat).mockImplementation(() => new Promise((r) => { resolve = r }))
    renderChat()
    type('   ')
    expect(screen.getByRole('button', { name: /send question/i }).disabled).toBe(true)
    type('Hello?')
    fireEvent.submit(screen.getByLabelText('Your question').closest('form'))
    fireEvent.submit(screen.getByLabelText('Your question').closest('form'))
    expect(sendChat).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/thinking/i)).toBeTruthy()
    resolve({ reply: 'Hi!', provider: 'gemini' })
    await screen.findByText('Hi!')
  })

  it('shows an error, keeps the question, and can retry', async () => {
    vi.mocked(sendChat).mockImplementationOnce(async () => { throw new Error('The AI service has reached its usage limit.') })
      .mockResolvedValueOnce({ reply: 'Back online.', provider: 'gemini' })
    renderChat()
    type('Any tips?'); send()
    expect((await screen.findByRole('alert')).textContent).toMatch('usage limit')
    expect(screen.getByText('Any tips?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Back online.')).toBeTruthy()
    expect(vi.mocked(sendChat).mock.calls[1][0].messages).toEqual([{ role: 'user', content: 'Any tips?' }])
  })

  it('Enter sends, Shift+Enter does not', async () => {
    vi.mocked(sendChat).mockResolvedValue({ reply: 'ok', provider: 'gemini' })
    renderChat()
    type('line one')
    fireEvent.keyDown(screen.getByLabelText('Your question'), { key: 'Enter', shiftKey: true })
    expect(sendChat).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByLabelText('Your question'), { key: 'Enter' })
    expect(sendChat).toHaveBeenCalledTimes(1)
    await screen.findByText('ok')
  })
})
