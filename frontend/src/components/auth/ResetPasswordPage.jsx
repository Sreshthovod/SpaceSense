import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import useAsyncForm from '../../hooks/useAsyncForm'
import { resetPassword } from '../../services/authApi'
import Button from '../ui/Button'
import AuthShell, { FormError, TextLink } from './AuthShell'
import TextField from './TextField'
import { PASSWORD_MIN } from './SignupPage'

export default function ResetPasswordPage({ params }) {
  const token = params?.token || ''
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const { pending, error, run } = useAsyncForm()

  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => resetPassword(token, password))) setDone(true)
  }

  if (!token) {
    return (
      <AuthShell title="This link is incomplete." footer={<TextLink to="forgot-password">Request a new reset link</TextLink>}>
        <FormError>The reset link is missing its code. Open the link from your email again, or request a new one.</FormError>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password." footer={!done && <TextLink to="forgot-password">Need a new link?</TextLink>}>
      {done ? (
        <div role="status" className="space-y-4">
          <p className="flex items-start gap-3 text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sage-dark" />
            Your password has been changed and you have been logged out everywhere.
          </p>
          <Button as="a" href="#/login" className="w-full">Log in</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <TextField
            id="new-password" label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN} characters.`} error={error?.field === 'new_password' ? error.message : ''}
          />
          {error && error.field !== 'new_password' && <FormError>{error.message}</FormError>}
          <Button type="submit" className="w-full" disabled={pending || password.length < PASSWORD_MIN}>
            {pending ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Saving…</> : 'Change password'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
