const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')

// AI calls can take a while; the product lookup is local and fast.
const TIMEOUTS = { analyze: 90000, chat: 90000, edit: 150000, products: 15000, studio: 15000 }

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
    // Only meaningful with Vastu on; omitted otherwise.
    ...(form.vastu && form.entryDirection ? { entry_direction: form.entryDirection } : {}),
  }
}

const SERVER_MESSAGE_ERRORS = new Set(['invalid_image', 'approval_required', 'analysis_failed', 'chat_failed', 'edit_failed', 'invalid_design'])

async function post(path, body, options) {
  return request(path, { method: 'POST', body }, options)
}

async function request(path, { method, body }, { signal, timeout }) {
  const timer = new AbortController()
  const timeoutId = setTimeout(() => timer.abort(), timeout)
  const onAbort = () => timer.abort()
  signal?.addEventListener('abort', onAbort)
  const isForm = body instanceof FormData
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      // For FormData the browser sets the multipart boundary itself.
      headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined || isForm ? body : JSON.stringify(body),
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

/** Product picks for the room. Passing the design advice lets the backend focus on what should change. */
export const recommendProducts = (form, { recommendations } = {}, signal) =>
  post('/recommend-products', recommendations ? { ...toRoomPayload(form), recommendations } : toRoomPayload(form), {
    signal,
    timeout: TIMEOUTS.products,
  })

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

/**
 * Consultation step: analysis, then product picks based on that advice. No image editing happens here.
 * A failed product lookup doesn't throw away the analysis: it comes back as `productsError`.
 */
export async function fetchRoomPlan(form, photo, signal) {
  const analysis = await analyzeRoom(form, photo, signal)
  try {
    const products = await recommendProducts(form, { recommendations: analysis.recommendations }, signal)
    return { analysis, products, productsError: null }
  } catch (err) {
    if (!(err instanceof ApiError)) throw err // aborted by the user
    return { analysis, products: null, productsError: err.message }
  }
}

/** Verified products each 3D designer item type can stand for, with their listed prices. */
export const getStudioCatalog = (signal) =>
  request('/studio/catalog', { method: 'GET' }, { signal, timeout: TIMEOUTS.studio })

/**
 * Prices a 3D design on the server. Only item types and chosen product ids are sent; the server
 * looks up every price and computes every total.
 */
export const priceDesign = (payload, signal) => post('/studio/price', payload, { signal, timeout: TIMEOUTS.studio })
