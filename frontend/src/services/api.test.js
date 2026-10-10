import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchRoomPlan, generateDesign, toRoomPayload } from './api'

const form = { roomType: 'Living room', length: '14', width: '12.5', height: '9', style: 'scandinavian', budget: '60000', vastu: true }

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

describe('fetchRoomPlan', () => {
  it('posts JSON to /analyze-room and /recommend-products only', async () => {
    const fetch = mockFetch({ status: 200, body: { method: 'rule_based' } }, { status: 200, body: { items: [] } })
    const result = await fetchRoomPlan(form)
    expect(result).toEqual({ analysis: { method: 'rule_based' }, products: { items: [] } })
    const urls = fetch.mock.calls.map(([url]) => url)
    expect(urls).toEqual(['http://localhost:8000/analyze-room', 'http://localhost:8000/recommend-products'])
    const [, init] = fetch.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual(toRoomPayload(form))
  })

  it('turns 422 details into a readable message', async () => {
    const body = { error: 'validation_error', details: [{ field: 'length_ft', message: 'Input should be greater than 0' }] }
    mockFetch({ status: 422, body }, { status: 422, body })
    await expect(fetchRoomPlan(form)).rejects.toThrow('length_ft – Input should be greater than 0')
  })

  it('reports an unreachable server without crashing', async () => {
    mockFetch(new TypeError('Failed to fetch'), new TypeError('Failed to fetch'))
    const err = await fetchRoomPlan(form).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toMatch("Can't reach the SpaceSense server")
  })

  it('distinguishes catalog and generic server errors', async () => {
    mockFetch({ status: 503, body: { error: 'catalog_unavailable', details: [] } }, { status: 200, body: {} })
    await expect(fetchRoomPlan(form)).rejects.toThrow('product catalog is temporarily unavailable')
    mockFetch({ status: 500, body: null }, { status: 200, body: {} })
    await expect(fetchRoomPlan(form)).rejects.toThrow('Something went wrong on the server')
  })
})

describe('generateDesign', () => {
  it('returns the mock response unchanged', async () => {
    const body = { status: 'mock', is_ai_generated: false, image_url: null, message: 'Mock response.' }
    mockFetch({ status: 200, body })
    await expect(generateDesign(toRoomPayload(form))).resolves.toEqual(body)
  })

  it('reports an unavailable design provider', async () => {
    mockFetch({ status: 503, body: { error: 'provider_unavailable', details: [] } })
    await expect(generateDesign(toRoomPayload(form))).rejects.toThrow('design service is temporarily unavailable')
  })
})
