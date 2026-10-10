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
        <PasswordMeter password={password} />
        {error && !['name', 'email', 'password'].includes(error.field) && <FormError>{error.message}</FormError>}
        <Button type="submit" className="w-full" disabled={pending || !email || !password}>
          {pending ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Creating account…</> : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}

/** A rough guide only: length matters most, mixing kinds of characters helps a little. */
function passwordStrength(password) {
  if (password.length < PASSWORD_MIN) return 0
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
  return Math.min(3, 1 + (password.length >= 14 ? 1 : 0) + (kinds >= 3 ? 1 : 0))
}

const LEVELS = [
  { label: 'Too short', bar: 'bg-red-400' },
  { label: 'Okay', bar: 'bg-brass' },
  { label: 'Good', bar: 'bg-sage' },
  { label: 'Strong', bar: 'bg-sage-dark' },
]

function PasswordMeter({ password }) {
  if (!password) return null
  const level = passwordStrength(password)
  return (
    <div className="anim-fade -mt-1" aria-live="polite">
      <div aria-hidden="true" className="grid grid-cols-3 gap-1">
        {[1, 2, 3].map((n) => (
          <span key={n} className="h-1 overflow-hidden rounded-full bg-line">
            <span className={`block h-full origin-left rounded-full transition-transform duration-500 ease-[var(--ease-out)] ${LEVELS[level].bar}`} style={{ transform: `scaleX(${level >= n ? 1 : 0})` }} />
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">Password strength: <span className="font-semibold text-ink">{LEVELS[level].label}</span></p>
    </div>
  )
}
