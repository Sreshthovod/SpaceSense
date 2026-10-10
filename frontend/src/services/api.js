const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')
const TIMEOUT_MS = 15000

export class ApiError extends Error {}

/** Maps the form state to the backend's RoomRequest schema (feet and INR). */
export function toRoomPayload(form) {
  return {
    room_type: form.roomType,
    length_ft: Number(form.length),
    width_ft: Number(form.width),
    height_ft: Number(form.height),
    style: form.style,
    budget_inr: Number(form.budget),
    vastu: Boolean(form.vastu),
  }
}

async function post(path, payload, signal) {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS)
  const onAbort = () => timeout.abort()
  signal?.addEventListener('abort', onAbort)
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: timeout.signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(
      timeout.signal.aborted
        ? 'The server took too long to respond. Please try again.'
        : `Can't reach the SpaceSense server at ${BASE_URL}. Make sure the backend is running.`,
    )
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  let data = null
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (res.ok) return data

  if (res.status === 422 && Array.isArray(data?.details)) {
    throw new ApiError(`Please check your inputs: ${data.details.map((d) => `${d.field} – ${d.message}`).join('; ')}`)
  }
  if (res.status === 503) {
    throw new ApiError(data?.error === 'provider_unavailable'
      ? 'The design service is temporarily unavailable. Please try again later.'
      : 'The product catalog is temporarily unavailable. Please try again later.')
  }
  throw new ApiError('Something went wrong on the server. Please try again.')
}

export const analyzeRoom = (payload, signal) => post('/analyze-room', payload, signal)
export const generateDesign = (payload, signal) => post('/generate-design', payload, signal)
export const recommendProducts = (payload, signal) => post('/recommend-products', payload, signal)

/** Fetches the analysis and product recommendations for one room; the redesign is requested separately. */
export async function fetchRoomPlan(form, signal) {
  const payload = toRoomPayload(form)
  const [analysis, products] = await Promise.all([
    analyzeRoom(payload, signal),
    recommendProducts(payload, signal),
  ])
  return { analysis, products }
}
