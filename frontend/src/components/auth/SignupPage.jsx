import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../context/auth'
import useAsyncForm from '../../hooks/useAsyncForm'
import Button from '../ui/Button'
import AuthShell, { FormError, TextLink } from './AuthShell'
import GoogleButton, { OrDivider } from './GoogleButton'
import TextField from './TextField'

export const PASSWORD_MIN = 10

export default function SignupPage() {
  const { signup, googleEnabled } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tooShort, setTooShort] = useState(false)
  const { pending, error, run } = useAsyncForm()

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < PASSWORD_MIN) {
      setTooShort(true)
      return
    }
    await run(() => signup({ name, email, password })) // AuthRouter moves on to the account page
  }

  const fieldError = (field) => (error?.field === field ? error.message : '')
  const passwordError = fieldError('password') || (tooShort && password.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : '')

  return (
    <AuthShell
      title="Create your account."
      intro="Free and optional. We will email you a link to confirm your address."
      footer={<>Already have an account? <TextLink to="login">Log in</TextLink></>}
    >
      {googleEnabled && (
        <>
          <GoogleButton label="Sign up with Google" />
          <OrDivider />
        </>
      )}
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField id="name" label="Name" value={name} onChange={setName} autoComplete="name" required={false} maxLength={80} error={fieldError('name')} />
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" error={fieldError('email')} />
        <TextField
          id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters. A few unrelated words make a strong one.`} error={passwordError}
        />
        {error && !['name', 'email', 'password'].includes(error.field) && <FormError>{error.message}</FormError>}
        <Button type="submit" className="w-full" disabled={pending || !email || !password}>
          {pending ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Creating account…</> : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}
