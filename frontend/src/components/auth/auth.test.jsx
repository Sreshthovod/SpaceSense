// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, SIGNED_OUT } from '../../context/auth'
import { AuthApiError } from '../../services/authApi'
import * as api from '../../services/authApi'
import { parseAuthHash } from '../../hooks/useAuthRoute'
import AuthRouter from './AuthRouter'
import LoginPage from './LoginPage'
import ResetPasswordPage from './ResetPasswordPage'
import SignupPage from './SignupPage'
import VerifyEmailPage from './VerifyEmailPage'

vi.mock('../../services/authApi', async (orig) => ({
  ...(await orig()),
  verifyEmail: vi.fn(),
  resetPassword: vi.fn(),
  forgotPassword: vi.fn(),
}))

const USER = { id: 1, email: 'ada@example.com', name: 'Ada', email_verified: true, has_password: true, google_linked: false, created_at: '2026-01-01T00:00:00Z' }
const withAuth = (ui, value = {}) => render(<AuthContext.Provider value={{ ...SIGNED_OUT, ...value }}>{ui}</AuthContext.Provider>)
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  window.scrollTo = vi.fn()
  window.location.hash = ''
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('hash routes', () => {
  it('only recognises account pages and parses their query', () => {
    expect(parseAuthHash('#/login')).toEqual({ name: 'login', params: {} })
    expect(parseAuthHash('#/reset-password?token=abc_-1')).toEqual({ name: 'reset-password', params: { token: 'abc_-1' } })
    for (const hash of ['', '#redesign', '#/nope', '#/login/extra', '#top']) expect(parseAuthHash(hash)).toBeNull()
  })
})

describe('LoginPage', () => {
  it('submits the credentials and shows the server message when they are wrong', async () => {
    const login = vi.fn().mockRejectedValue(new AuthApiError('Incorrect email or password.', { status: 401 }))
    withAuth(<LoginPage />, { login })
    expect(screen.getByRole('button', { name: 'Log in' }).disabled).toBe(true) // nothing typed yet
    type('Email', 'ada@example.com')
    type('Password', 'hunter2hunter2')
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Incorrect email or password.')
    expect(login).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'hunter2hunter2' })
    expect(screen.getByRole('button', { name: 'Log in' }).disabled).toBe(false) // can retry
  })

  it('offers Google only when the server has it, and explains a failed Google attempt', () => {
    const { unmount } = withAuth(<LoginPage />)
    expect(screen.queryByRole('link', { name: /google/i })).toBeNull()
    unmount()
    withAuth(<LoginPage params={{ error: 'google' }} />, { googleEnabled: true })
    expect(screen.getByRole('link', { name: /continue with google/i }).getAttribute('href')).toMatch(/\/auth\/google\/start$/)
    expect(screen.getByRole('alert').textContent).toMatch(/Google sign-in did not complete/)
  })

  it('has a show/hide toggle for the password', () => {
    withAuth(<LoginPage />)
    const field = screen.getByLabelText('Password')
    expect(field.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(field.type).toBe('text')
  })
})

describe('SignupPage', () => {
  it('rejects a short password before calling the server', () => {
    const signup = vi.fn()
    withAuth(<SignupPage />, { signup })
    type('Email', 'ada@example.com')
    type('Password', 'short')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Use at least 10 characters.')).toBeTruthy()
    expect(signup).not.toHaveBeenCalled()
  })

  it('sends name, email and password and puts the server error next to the right field', async () => {
    const signup = vi.fn().mockRejectedValue(new AuthApiError('An account with this email already exists. Try logging in.', { field: 'email', status: 409 }))
    withAuth(<SignupPage />, { signup })
    type(/^Name/, 'Ada')
    type('Email', 'ada@example.com')
    type('Password', 'correct horse battery')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(signup).toHaveBeenCalledWith({ name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' }))
    const message = await screen.findByText(/already exists/)
    expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toContain(message.id)
  })
})

describe('VerifyEmailPage', () => {
  it('uses the one-time link exactly once even when React runs effects twice', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValue({ ok: true })
    const refresh = vi.fn()
    withAuth(<StrictMode><VerifyEmailPage params={{ token: 'tok' }} /></StrictMode>, { refresh })
    expect(await screen.findByText('Email confirmed.')).toBeTruthy()
    expect(api.verifyEmail).toHaveBeenCalledTimes(1)
    expect(api.verifyEmail).toHaveBeenCalledWith('tok')
    expect(refresh).toHaveBeenCalled()
  })

  it('shows why a link failed, and handles a link with no token', async () => {
    vi.mocked(api.verifyEmail).mockRejectedValue(new AuthApiError('This link is invalid or has expired. Request a new one.'))
    const { unmount } = withAuth(<VerifyEmailPage params={{ token: 'old' }} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/invalid or has expired/)
    unmount()
    withAuth(<VerifyEmailPage params={{}} />)
    expect(screen.getByRole('alert').textContent).toMatch(/missing its code/)
    expect(api.verifyEmail).toHaveBeenCalledTimes(1)
  })
})

describe('ResetPasswordPage', () => {
  it('needs a token, then sets the password and points to log in', async () => {
    const { unmount } = withAuth(<ResetPasswordPage params={{}} />)
    expect(screen.getByRole('alert').textContent).toMatch(/missing its code/)
    unmount()
    vi.mocked(api.resetPassword).mockResolvedValue({ ok: true })
    withAuth(<ResetPasswordPage params={{ token: 'tok' }} />)
    const submit = screen.getByRole('button', { name: 'Change password' })
    type('New password', 'short')
    expect(submit.disabled).toBe(true)
    type('New password', 'a brand new passphrase')
    fireEvent.click(submit)
    expect(await screen.findByText(/password has been changed/)).toBeTruthy()
    expect(api.resetPassword).toHaveBeenCalledWith('tok', 'a brand new passphrase')
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('#/login')
  })

  it('shows the server error for a weak password or a dead link', async () => {
    vi.mocked(api.resetPassword).mockRejectedValue(new AuthApiError('This link is invalid or has expired. Request a new one.', { field: 'token' }))
    withAuth(<ResetPasswordPage params={{ token: 'dead' }} />)
    type('New password', 'a brand new passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/invalid or has expired/)
  })
})

describe('AuthRouter', () => {
  it('shows the requested page to a visitor', () => {
    withAuth(<AuthRouter route={{ name: 'login', params: {} }} />)
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeTruthy()
  })

  it('sends a signed-in user away from the login page, and from signup to their account', async () => {
    window.location.hash = '#/login'
    const { unmount } = withAuth(<AuthRouter route={{ name: 'login', params: {} }} />, { user: USER })
    expect(screen.queryByRole('heading', { name: 'Welcome back.' })).toBeNull()
    await waitFor(() => expect(window.location.hash).toBe(''))
    unmount()
    withAuth(<AuthRouter route={{ name: 'signup', params: {} }} />, { user: USER })
    await waitFor(() => expect(window.location.hash).toBe('#/account'))
  })

  it('still shows reset and verify links to a signed-in user', () => {
    withAuth(<AuthRouter route={{ name: 'reset-password', params: { token: 't' } }} />, { user: USER })
    expect(screen.getByRole('heading', { name: 'Choose a new password.' })).toBeTruthy()
  })

  it('does not redirect while the session is still loading', () => {
    window.location.hash = '#/login'
    withAuth(<AuthRouter route={{ name: 'login', params: {} }} />, { loading: true, user: null })
    expect(window.location.hash).toBe('#/login')
  })
})
