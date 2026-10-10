import { useEffect } from 'react'
import { useAuth } from '../../context/auth'
import { goTo, leaveAuth } from '../../hooks/useAuthRoute'
import AccountPage from './AccountPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import LoginPage from './LoginPage'
import ResetPasswordPage from './ResetPasswordPage'
import SignupPage from './SignupPage'
import VerifyEmailPage from './VerifyEmailPage'

const PAGES = {
  login: LoginPage,
  signup: SignupPage,
  'forgot-password': ForgotPasswordPage,
  'reset-password': ResetPasswordPage,
  'verify-email': VerifyEmailPage,
  account: AccountPage,
}

// Pages that make no sense once you are logged in, and where to go instead. This is the only place that
// redirects, so a page never races it. Reset and verify links still work when logged in.
const GUEST_ONLY = { login: leaveAuth, signup: () => goTo('account'), 'forgot-password': leaveAuth }

export default function AuthRouter({ route }) {
  const { user, loading } = useAuth()
  const redirect = !loading && user ? GUEST_ONLY[route.name] : undefined
  const signedInOnGuestPage = !!redirect

  useEffect(() => {
    redirect?.()
  }, [redirect])

  if (signedInOnGuestPage) return null
  const Page = PAGES[route.name]
  return <Page params={route.params} />
}
