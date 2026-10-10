import { googleStartUrl } from '../../services/authApi'

const GoogleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
  </svg>
)

/** Only shown when the server has Google credentials. A real link: the whole sign-in is a redirect round trip. */
export default function GoogleButton({ label = 'Continue with Google' }) {
  return (
    <a
      href={googleStartUrl}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark"
    >
      <GoogleMark /> {label}
    </a>
  )
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  )
}
