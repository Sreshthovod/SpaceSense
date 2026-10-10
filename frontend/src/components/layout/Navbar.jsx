import { useEffect, useMemo, useRef, useState } from 'react'
import { Home, Menu, X } from 'lucide-react'
import useActiveSection from '../../hooks/useActiveSection'
import useNavCompact from '../../hooks/useNavCompact'
import { useAuth } from '../../context/auth'
import { STUDIO_LINKS } from '../results/studioLinks'

const links = [
  { href: '#how-it-works', id: 'how-it-works', label: 'How It Works' },
  { href: '#styles', id: 'styles', label: 'Design Styles' },
  { href: '#image-lab', id: 'image-lab', label: 'Image Lab' },
]

function AccountLink({ user }) {
  const cls = 'rounded-sm text-[0.78rem] uppercase tracking-[0.14em] text-muted underline-offset-8 transition-colors hover:text-ink hover:underline'
  return user ? (
    <a href="#/account" className={`${cls} max-w-[10rem] truncate`} title={user.email}>{user.name}</a>
  ) : (
    <a href="#/login" className={cls}>Log in</a>
  )
}

export default function Navbar({ onHome, studio, onOpenDesigner, onReset }) {
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const compact = useNavCompact()
  const { user, logout } = useAuth()
  const sectionIds = useMemo(() => ['top', 'how-it-works', 'styles', 'redesign', 'image-lab'], [])
  const active = useActiveSection(sectionIds, !studio)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = () => {
    setOpen(false)
    onHome?.()
  }

  return (
    <header className={`sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur-md transition-[height,background] ${compact ? 'shadow-sm' : ''}`}>
      <nav aria-label="Main" className={`mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 ${compact ? 'nav-compact' : 'h-16'}`}>
        <a href="#top" onClick={go} aria-label="SpaceSense home" className="flex items-center gap-2.5 rounded-sm">
          <Home aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 text-sage-dark" />
          <span className="font-display text-2xl font-semibold tracking-tight">SpaceSense</span>
        </a>
        {studio ? (
          <ul className="hidden items-center gap-6 text-[0.78rem] uppercase tracking-[0.14em] lg:flex">
            {STUDIO_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="rounded-sm text-muted underline-offset-8 transition-colors hover:text-ink hover:underline">{l.label}</a>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="hidden items-center gap-8 text-[0.78rem] uppercase tracking-[0.14em] lg:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={go}
                  className={`rounded-sm underline-offset-8 transition-colors ${active === l.href ? 'text-ink underline' : 'text-muted hover:text-ink hover:underline'}`}
                >
                  {l.label}
                </a>
              </li>
            ))}
            {onOpenDesigner && (
              <li>
                <button type="button" onClick={onOpenDesigner} className="rounded-sm uppercase tracking-[0.14em] text-muted underline-offset-8 transition-colors hover:text-ink hover:underline">
                  3D Designer
                </button>
              </li>
            )}
          </ul>
        )}
        {studio ? (
          <div className="hidden items-center gap-3 lg:flex">
            <AccountLink user={user} />
            {onOpenDesigner && (
              <button type="button" onClick={onOpenDesigner} className="border border-ink px-4 py-2 text-[0.78rem] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-cream">
                Open 3D
              </button>
            )}
            <button type="button" onClick={onReset} className="bg-ink px-5 py-2.5 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-cream transition-colors hover:bg-brass">
              Start over
            </button>
          </div>
        ) : (
          <div className="hidden items-center gap-5 lg:flex">
            <AccountLink user={user} />
            <a href="#redesign" onClick={go} className="bg-ink px-5 py-2.5 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-cream transition-colors hover:bg-brass">
            Design My Space
            </a>
          </div>
        )}
        <button
          ref={menuButtonRef}
          type="button"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-ink lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X aria-hidden="true" strokeWidth={1.5} className="h-6 w-6" /> : <Menu aria-hidden="true" strokeWidth={1.5} className="h-6 w-6" />}
        </button>
      </nav>
      {open && (
        <div id="mobile-menu" className="border-t border-line bg-cream px-5 pb-6 pt-2 lg:hidden">
          <ul>
            {(studio ? STUDIO_LINKS : links).map((l) => (
              <li key={l.href} className="border-b border-line">
                <a href={l.href} onClick={studio ? () => setOpen(false) : go} className="block py-4 font-display text-2xl">{l.label}</a>
              </li>
            ))}
          </ul>
          {onOpenDesigner && (
            <button type="button" onClick={() => { setOpen(false); onOpenDesigner() }} className="block w-full border-b border-line py-4 text-left font-display text-2xl">
              {studio ? 'Open 3D designer' : '3D Designer'}
            </button>
          )}
          <a href={user ? '#/account' : '#/login'} onClick={() => setOpen(false)} className="block border-b border-line py-4 font-display text-2xl">
            {user ? `Account (${user.name})` : 'Log in'}
          </a>
          {user && (
            <button type="button" onClick={() => { setOpen(false); logout() }} className="block w-full border-b border-line py-4 text-left font-display text-2xl">
              Log out
            </button>
          )}
          {studio ? (
            <button type="button" onClick={() => { setOpen(false); onReset?.() }} className="mt-6 block w-full bg-ink px-5 py-3 text-center text-sm font-medium text-cream">Start over</button>
          ) : (
            <a href="#redesign" onClick={go} className="mt-6 block bg-ink px-5 py-3 text-center text-sm font-medium text-cream">Design My Space</a>
          )}
        </div>
      )}
    </header>
  )
}
