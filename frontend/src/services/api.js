const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')

// AI calls can take a while; the product lookup is local and fast.
const TIMEOUTS = { analyze: 90000, chat: 90000, edit: 150000, products: 15000 }

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

const SERVER_MESSAGE_ERRORS = new Set(['invalid_image', 'approval_required', 'analysis_failed', 'chat_failed', 'edit_failed'])

async function post(path, body, { signal, timeout }) {
  const timer = new AbortController()
  const timeoutId = setTimeout(() => timer.abort(), timeout)
  const onAbort = () => timer.abort()
  signal?.addEventListener('abort', onAbort)
  const isForm = body instanceof FormData
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      // For FormData the browser sets the multipart boundary itself.
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
      signal: timer.signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(
      timer.signal.aborted
        ? 'The server took too long to respond. Please try again.'
        : `Can't reach the SpaceSense server at ${BASE_URL}. Make sure the backend is running.`,
    )
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onAbort)
  }

  let data = null
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (res.ok) return data

  const firstMessage = data?.details?.[0]?.message
  if (SERVER_MESSAGE_ERRORS.has(data?.error) && firstMessage) throw new ApiError(firstMessage)
  if (res.status === 422 && Array.isArray(data?.details)) {
    throw new ApiError(`Please check your inputs: ${data.details.map((d) => `${d.field} – ${d.message}`).join('; ')}`)
  }
  if (res.status === 503) throw new ApiError('The product catalog is temporarily unavailable. Please try again later.')
  throw new ApiError('Something went wrong on the server. Please try again.')
}

function roomForm(form, photo) {
  const fd = new FormData()
  fd.append('room', JSON.stringify(toRoomPayload(form)))
  fd.append('photo', photo)
  return fd
}

/** Written recommendations for the uploaded photo. Never edits or generates an image. */
export const analyzeRoom = (form, photo, signal) =>
  post('/analyze-room', roomForm(form, photo), { signal, timeout: TIMEOUTS.analyze })

export const recommendProducts = (form, signal) =>
  post('/recommend-products', toRoomPayload(form), { signal, timeout: TIMEOUTS.products })

/** Sends the conversation (the server keeps no state) and returns the consultant's reply. Text only. */
export function sendChat({ form, photo, messages, recommendations }, signal) {
  const fd = roomForm(form, photo)
  fd.append('chat', JSON.stringify({ messages, recommendations }))
  return post('/chat', fd, { signal, timeout: TIMEOUTS.chat })
}

/**
 * Edits the user's ORIGINAL photo with the changes they approved.
 * Only call this from an explicit user approval action.
 */
export function editRoomPhoto({ form, photo, items, notes = '' }, signal) {
  const fd = roomForm(form, photo)
  fd.append('instructions', JSON.stringify({ items, notes }))
  fd.append('approved', 'true')
  return post('/generate-design', fd, { signal, timeout: TIMEOUTS.edit })
}

/** Consultation step: analysis and product picks. No image editing happens here. */
export async function fetchRoomPlan(form, photo, signal) {
  const [analysis, products] = await Promise.all([analyzeRoom(form, photo, signal), recommendProducts(form, signal)])
  return { analysis, products }
}
