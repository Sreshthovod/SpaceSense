import { useEffect, useRef } from 'react'
import Card from '../ui/Card'

/** The frame every account page shares: a focused heading, a card, and a place for links underneath. */
export default function AuthShell({ eyebrow = 'Your account', title, intro, children, footer }) {
  const headingRef = useRef(null)
  useEffect(() => {
    headingRef.current?.focus()
    window.scrollTo(0, 0)
  }, [title])
  return (
    <section aria-labelledby="auth-heading" className="mx-auto max-w-md px-5 py-14 sm:py-20">
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="auth-heading" ref={headingRef} tabIndex={-1} className="mt-3 font-display text-4xl font-medium leading-tight focus:outline-none sm:text-5xl">
        {title}
      </h1>
      {intro && <p className="mt-3 text-sm leading-relaxed text-muted">{intro}</p>}
      <Card className="mt-8">{children}</Card>
      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </section>
  )
}

export function FormError({ children }) {
  if (!children) return null
  return <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>
}

export function TextLink({ to, children }) {
  return (
    <a href={`#/${to}`} className="font-semibold text-sage-dark underline underline-offset-4 hover:text-ink">{children}</a>
  )
}
