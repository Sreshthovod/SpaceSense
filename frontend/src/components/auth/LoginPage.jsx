import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../context/auth'
import useAsyncForm from '../../hooks/useAsyncForm'
import Button from '../ui/Button'
import AuthShell, { FormError, TextLink } from './AuthShell'
import GoogleButton, { OrDivider } from './GoogleButton'
import TextField from './TextField'

const GOOGLE_ERRORS = {
  google: 'Google sign-in did not complete. Please try again.',
  google_unavailable: 'Google sign-in is not set up on this server.',
}

export default function LoginPage({ params }) {
  const { login, googleEnabled } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { pending, error, run } = useAsyncForm()

  const submit = async (e) => {
    e.preventDefault()
    await run(() => login({ email, password })) // AuthRouter leaves this page once the user is signed in
  }

  return (
    <AuthShell
      title="Welcome back."
      intro="Log in to manage your account. You can use the planner without one too."
      footer={<>New to SpaceSense? <TextLink to="signup">Create an account</TextLink></>}
    >
      <FormError>{GOOGLE_ERRORS[params?.error]}</FormError>
      {googleEnabled && (
        <>
          <GoogleButton />
          <OrDivider />
        </>
      )}
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" error={error?.field === 'email' ? error.message : ''} />
        <TextField id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="text-right text-sm"><TextLink to="forgot-password">Forgot your password?</TextLink></div>
        {error && error.field !== 'email' && <FormError>{error.message}</FormError>}
        <Button type="submit" className="w-full" disabled={pending || !email || !password}>
          {pending ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Logging in…</> : 'Log in'}
        </Button>
      </form>
    </AuthShell>
  )
}
