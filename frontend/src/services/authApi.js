import { BASE_URL } from './api'

/** An account request the user can fix. `field` names the input to blame (email, password, ...). */
export class AuthApiError extends Error {
  constructor(message, { field = '', status = 0 } = {}) {
    super(message)
    this.field = field
    this.status = status
  }
}

/**
 * Cookie-authenticated JSON call. `credentials: 'include'` sends the httpOnly session cookie to the API,
 * and the custom header is the CSRF guard the backend requires on every state-changing route.
 */
async function call(path, { method = 'GET', body, signal } = {}) {
  let res
  try {
    res = await fetch(`${BASE_URL}/auth${path}`, {
      method,
      credentials: 'include',
      headers: {
        'X-Requested-With': 'SpaceSense',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new AuthApiError(`Can't reach the SpaceSense server at ${BASE_URL}. Make sure the backend is running.`)
  }
  let data = null
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (res.ok) return data
  const detail = data?.details?.[0]
  if (res.status === 422 && Array.isArray(data?.details)) {
    throw new AuthApiError('Please check what you entered and try again.', { status: 422, field: detail?.field })
  }
  throw new AuthApiError(detail?.message || 'Something went wrong. Please try again.', { field: detail?.field, status: res.status })
}

export const getSession = (signal) => call('/me', { signal })
export const signup = (body) => call('/signup', { method: 'POST', body })
export const login = (body) => call('/login', { method: 'POST', body })
export const logout = () => call('/logout', { method: 'POST' })
export const verifyEmail = (token) => call('/verify-email', { method: 'POST', body: { token } })
export const resendVerification = () => call('/resend-verification', { method: 'POST' })
export const forgotPassword = (email) => call('/forgot-password', { method: 'POST', body: { email } })
export const resetPassword = (token, newPassword) =>
  call('/reset-password', { method: 'POST', body: { token, new_password: newPassword } })
export const changePassword = (currentPassword, newPassword) =>
  call('/change-password', { method: 'POST', body: { current_password: currentPassword, new_password: newPassword } })
export const deleteAccount = (body) => call('/delete-account', { method: 'POST', body })

/** Full-page redirect to the backend, which sends the browser on to Google. */
export const googleStartUrl = `${BASE_URL}/auth/google/start`
