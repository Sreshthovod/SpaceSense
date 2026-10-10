import { useEffect, useState } from 'react'
import { BadgeCheck, Loader2, LogOut, MailWarning } from 'lucide-react'
import { useAuth } from '../../context/auth'
import useAsyncForm from '../../hooks/useAsyncForm'
import { goTo, leaveAuth } from '../../hooks/useAuthRoute'
import { changePassword, deleteAccount, resendVerification } from '../../services/authApi'
import Button from '../ui/Button'
import AuthShell, { FormError } from './AuthShell'
import TextField from './TextField'
import { PASSWORD_MIN } from './SignupPage'

function VerificationNotice({ user, emailEnabled, refresh }) {
  const { pending, error, run } = useAsyncForm()
  const [note, setNote] = useState('')

  if (user.email_verified) {
    return (
      <p className="flex items-center gap-2 text-sm text-sage-dark">
        <BadgeCheck aria-hidden="true" className="h-4 w-4" /> Email confirmed
      </p>
    )
  }

  const resend = async () => {
    const data = await run(resendVerification)
    if (!data) return
    if (data.already_verified) refresh()
    else setNote(data.sent ? 'Sent. Check your inbox for the new link.' : emailEnabled ? 'The email could not be sent. Try again later.' : 'Email is not set up on this server, so nothing was sent. In development, the link is in the backend log.')
  }

  return (
    <div className="rounded-xl border border-clay/40 bg-sand/60 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-clay"><MailWarning aria-hidden="true" className="h-4 w-4" /> Confirm your email</p>
      <p className="mt-1 text-muted">We sent a link to {user.email}. It works once and expires in 24 hours.</p>
      <Button variant="secondary" className="mt-3" onClick={resend} disabled={pending}>
        {pending ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Sending…</> : 'Resend confirmation email'}
      </Button>
      {note && <p role="status" className="mt-2 text-xs text-muted">{note}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error.message}</p>}
    </div>
  )
}

function ChangePassword({ user }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saved, setSaved] = useState(false)
  const { pending, error, run } = useAsyncForm()
  const { refresh } = useAuth()

  const submit = async (e) => {
    e.preventDefault()
    setSaved(false)
    if (await run(() => changePassword(current, next))) {
      setSaved(true)
      setCurrent('')
      setNext('')
      refresh() // a Google-only account now has a password too
    }
  }

  const fieldError = (field) => (error?.field === field ? error.message : '')
  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-labelledby="password-heading">
      <h2 id="password-heading" className="font-display text-2xl font-semibold">{user.has_password ? 'Change password' : 'Add a password'}</h2>
      {!user.has_password && <p className="text-sm text-muted">You signed in with Google. A password lets you log in with your email too.</p>}
      {user.has_password && (
        <TextField id="current-password" label="Current password" type="password" value={current} onChange={setCurrent} autoComplete="current-password" error={fieldError('current_password')} />
      )}
      <TextField id="new-password" label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" hint={`At least ${PASSWORD_MIN} characters. Other devices are logged out.`} error={fieldError('new_password')} />
      {error && !['current_password', 'new_password'].includes(error.field) && <FormError>{error.message}</FormError>}
      {saved && <p role="status" className="text-sm text-sage-dark">Password updated. Other devices have been logged out.</p>}
      <Button type="submit" disabled={pending || next.length < PASSWORD_MIN || (user.has_password && !current)}>
        {pending ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Saving…</> : 'Save password'}
      </Button>
    </form>
  )
}

function DeleteAccount({ user, onDeleted }) {
  const [value, setValue] = useState('')
  const { pending, error, run } = useAsyncForm()

  const submit = async (e) => {
    e.preventDefault()
    const body = user.has_password ? { password: value } : { confirm_email: value }
    if (await run(() => deleteAccount(body))) onDeleted()
  }

  return (
    <details className="rounded-xl border border-red-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-red-800">Delete my account</summary>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <p className="text-sm text-muted">This permanently removes your account and logs you out everywhere. It cannot be undone.</p>
        <TextField
          id="delete-confirm" label={user.has_password ? 'Your password' : 'Type your email to confirm'}
          type={user.has_password ? 'password' : 'email'} value={value} onChange={setValue}
          autoComplete={user.has_password ? 'current-password' : 'off'} error={error?.message}
        />
        <button
          type="submit" disabled={pending || !value}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-red-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Deleting…</> : 'Delete account permanently'}
        </button>
      </form>
    </details>
  )
}

export default function AccountPage() {
  const { user, loading, emailEnabled, logout, refresh } = useAuth()

  useEffect(() => {
    if (!loading && !user) goTo('login')
  }, [loading, user])

  if (loading || !user) {
    return (
      <AuthShell title="Your account.">
        <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Loading…</p>
      </AuthShell>
    )
  }

  const signOut = async () => {
    await logout()
    leaveAuth()
  }

  return (
    <AuthShell title={`Hello, ${user.name}.`} intro={user.email}>
      <div className="space-y-8">
        <div className="space-y-4">
          <VerificationNotice user={user} emailEnabled={emailEnabled} refresh={refresh} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Sign-in methods</dt>
            <dd>{[user.has_password && 'Email and password', user.google_linked && 'Google'].filter(Boolean).join(', ')}</dd>
            <dt className="text-muted">Member since</dt>
            <dd>{new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
          </dl>
        </div>
        <ChangePassword user={user} />
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Button variant="secondary" onClick={signOut}><LogOut aria-hidden="true" className="h-4 w-4" /> Log out</Button>
        </div>
        <DeleteAccount user={user} onDeleted={() => { refresh(); leaveAuth() }} />
      </div>
    </AuthShell>
  )
}
