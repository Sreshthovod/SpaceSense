import { useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import useAsyncForm from '../../hooks/useAsyncForm'
import { forgotPassword } from '../../services/authApi'
import Button from '../ui/Button'
import AuthShell, { FormError, TextLink } from './AuthShell'
import TextField from './TextField'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { pending, error, run } = useAsyncForm()

  const submit = async (e) => {
    e.preventDefault()
    const done = await run(() => forgotPassword(email))
    if (done) setSent(true)
  }

  return (
    <AuthShell
      title="Reset your password."
      intro="Enter your email and we will send you a link to choose a new password."
      footer={<TextLink to="login">Back to log in</TextLink>}
    >
      {sent ? (
        <div role="status" className="flex items-start gap-3">
          <MailCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sage-dark" />
          <p className="text-sm leading-relaxed">
            If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. It works once and expires in an hour.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" error={error?.field === 'email' ? error.message : ''} />
          {error && error.field !== 'email' && <FormError>{error.message}</FormError>}
          <Button type="submit" className="w-full" disabled={pending || !email}>
            {pending ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Sending…</> : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
