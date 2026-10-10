import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/auth'
import { verifyEmail } from '../../services/authApi'
import AuthShell, { FormError, TextLink } from './AuthShell'

export default function VerifyEmailPage({ params }) {
  const token = params?.token || ''
  const { refresh, user } = useAuth()
  const [state, setState] = useState(
    token ? { status: 'working' } : { status: 'error', message: 'This link is missing its code. Open the link from your email again.' },
  )
  // A verification link works once, so the request must be sent exactly once (StrictMode runs effects twice).
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => { setState({ status: 'ok' }); refresh() })
      .catch((err) => setState({ status: 'error', message: err.message }))
  }, [token, refresh])

  const title = state.status === 'ok' ? 'Email confirmed.' : state.status === 'error' ? 'We could not confirm that.' : 'Confirming your email…'

  return (
    <AuthShell title={title} footer={<TextLink to={user ? 'account' : 'login'}>{user ? 'Go to your account' : 'Log in'}</TextLink>}>
      {state.status === 'working' && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> One moment…</p>
      )}
      {state.status === 'ok' && (
        <p role="status" className="flex items-start gap-3 text-sm"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sage-dark" /> Thanks, your email address is confirmed.</p>
      )}
      {state.status === 'error' && (
        <>
          <FormError>{state.message}</FormError>
          <p className="mt-3 text-sm text-muted">Log in and choose "Resend confirmation email" on your account page to get a fresh link.</p>
        </>
      )}
    </AuthShell>
  )
}
