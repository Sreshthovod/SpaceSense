import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, editRoomPhoto, fetchRoomPlan, sendChat, toRoomPayload } from './api'

const form = { roomType: 'Living room', length: '14', width: '12.5', height: '9', style: 'scandinavian', budget: '60000', vastu: true }
const photo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'room.png', { type: 'image/png' })

function mockFetch(...responses) {
  const fn = vi.fn()
  responses.forEach((r) => {
    if (r instanceof Error) fn.mockRejectedValueOnce(r)
    else fn.mockResolvedValueOnce({ ok: r.status < 400, status: r.status, json: async () => r.body })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('toRoomPayload', () => {
  it('maps form state to the backend RoomRequest schema', () => {
    expect(toRoomPayload(form)).toEqual({
      room_type: 'Living room', length_ft: 14, width_ft: 12.5, height_ft: 9,
      style: 'scandinavian', budget_inr: 60000, vastu: true,
    })
  })
})

describe('toRoomPayload (vastu direction)', () => {
  it('sends entry_direction only when Vastu is on and a direction is chosen', () => {
    expect(toRoomPayload({ ...form, entryDirection: 'north-east' }).entry_direction).toBe('north-east')
    expect('entry_direction' in toRoomPayload({ ...form, entryDirection: '' })).toBe(false)
    expect('entry_direction' in toRoomPayload({ ...form, vastu: false, entryDirection: 'east' })).toBe(false)
  })
})

describe('fetchRoomPlan (consultation)', () => {
  it('sends the photo to /analyze-room and never calls /generate-design', async () => {
    const fetch = mockFetch({ status: 200, body: { method: 'rule_based' } }, { status: 200, body: { items: [] } })
    const result = await fetchRoomPlan(form, photo)
    expect(result).toEqual({ analysis: { method: 'rule_based' }, products: { items: [] } })
    const urls = fetch.mock.calls.map(([url]) => url)
    expect(urls).toEqual(['http://localhost:8000/analyze-room', 'http://localhost:8000/recommend-products'])
    expect(urls.some((u) => u.includes('generate-design'))).toBe(false)

    const analyzeBody = fetch.mock.calls[0][1].body
    expect(analyzeBody).toBeInstanceOf(FormData)
    expect(analyzeBody.get('photo')).toBe(photo)
    expect(JSON.parse(analyzeBody.get('room'))).toEqual(toRoomPayload(form))
    expect(analyzeBody.has('approved')).toBe(false)
    expect(fetch.mock.calls[0][1].headers).toBeUndefined() // browser sets the multipart boundary

    const productsInit = fetch.mock.calls[1][1]
    expect(productsInit.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(productsInit.body)).toEqual(toRoomPayload(form))
  })

  it('turns 422 details into a readable message', async () => {
    const body = { error: 'validation_error', details: [{ field: 'room.length_ft', message: 'Input should be greater than 0' }] }
    mockFetch({ status: 422, body }, { status: 422, body })
    await expect(fetchRoomPlan(form, photo)).rejects.toThrow('room.length_ft – Input should be greater than 0')
  })

  it('shows the server message for invalid images and failed analysis', async () => {
    mockFetch({ status: 422, body: { error: 'invalid_image', details: [{ field: 'photo', message: 'The photo must be a JPG, PNG or WebP image.' }] } }, { status: 200, body: {} })
    await expect(fetchRoomPlan(form, photo)).rejects.toThrow('The photo must be a JPG, PNG or WebP image.')
    mockFetch({ status: 502, body: { error: 'analysis_failed', details: [{ field: 'body', message: 'The room analysis service failed. Please try again.' }] } }, { status: 200, body: {} })
    await expect(fetchRoomPlan(form, photo)).rejects.toThrow('room analysis service failed')
  })

  it('reports an unreachable server without crashing', async () => {
    mockFetch(new TypeError('Failed to fetch'), new TypeError('Failed to fetch'))
    const err = await fetchRoomPlan(form, photo).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toMatch("Can't reach the SpaceSense server")
  })

  it('distinguishes catalog and generic server errors', async () => {
    mockFetch({ status: 200, body: {} }, { status: 503, body: { error: 'catalog_unavailable', details: [] } })
    await expect(fetchRoomPlan(form, photo)).rejects.toThrow('product catalog is temporarily unavailable')
    mockFetch({ status: 500, body: null }, { status: 200, body: {} })
    await expect(fetchRoomPlan(form, photo)).rejects.toThrow('Something went wrong on the server')
  })
})

describe('editRoomPhoto (after approval)', () => {
  it('sends the original photo, approved instructions and approved=true', async () => {
    const body = { status: 'edited', image_url: 'data:image/png;base64,QUJD', message: 'ok', instructions_used: ['Paint walls'] }
    const fetch = mockFetch({ status: 200, body })
    await expect(editRoomPhoto({ form, photo, items: ['Paint walls'], notes: 'keep rug' })).resolves.toEqual(body)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('http://localhost:8000/generate-design')
    expect(init.body.get('photo')).toBe(photo)
    expect(init.body.get('approved')).toBe('true')
    expect(JSON.parse(init.body.get('instructions'))).toEqual({ items: ['Paint walls'], notes: 'keep rug' })
  })

  it('surfaces an honest edit failure', async () => {
    mockFetch({ status: 502, body: { error: 'edit_failed', details: [{ field: 'body', message: 'The image editor did not return an edited photo. Your original photo is unchanged.' }] } })
    await expect(editRoomPhoto({ form, photo, items: ['x'] })).rejects.toThrow('original photo is unchanged')
  })
})

describe('sendChat', () => {
  it('posts the conversation with the photo and room to /chat', async () => {
    const fetch = mockFetch({ status: 200, body: { reply: 'Hi', provider: 'gemini', is_ai_generated: true } })
    const messages = [{ role: 'user', content: 'Sofa colour?' }]
    await expect(sendChat({ form, photo, messages, recommendations: { summary: 's' } })).resolves.toMatchObject({ reply: 'Hi' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('http://localhost:8000/chat')
    expect(init.body.get('photo')).toBe(photo)
    expect(JSON.parse(init.body.get('chat'))).toEqual({ messages, recommendations: { summary: 's' } })
    expect(init.body.has('approved')).toBe(false)
  })

  it('shows the server message when the chat provider fails', async () => {
    mockFetch({ status: 429, body: { error: 'chat_failed', details: [{ field: 'body', message: 'The AI service has reached its usage limit. Please try again later.' }] } })
    await expect(sendChat({ form, photo, messages: [{ role: 'user', content: 'q' }] })).rejects.toThrow('usage limit')
  })
})
