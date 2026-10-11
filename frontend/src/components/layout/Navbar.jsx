import { useEffect, useMemo, useRef, useState } from 'react'
import { Home, Menu, Search, X } from 'lucide-react'
import useActiveSection from '../../hooks/useActiveSection'
import useNavCompact from '../../hooks/useNavCompact'
import { useAuth } from '../../context/auth'
import { STUDIO_LINKS } from '../results/studioLinks'
import ThemeToggle from './ThemeToggle'
import { isMac } from '../../utils/fuzzy'

const links = [
  { href: '#how-it-works', id: 'how-it-works', label: 'How It Works' },
  { href: '#vastu', id: 'vastu', label: 'Vastu' },
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

/** Opens the Cmd/Ctrl+K quick-action palette. */
function SearchButton({ onClick }) {
  if (!onClick) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Quick actions"
      aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}
      className="press inline-flex h-11 items-center gap-2 rounded-full px-3 text-muted transition-colors hover:bg-sand hover:text-ink"
    >
      <Search aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
      <kbd aria-hidden="true" className="hidden rounded border border-line px-1.5 py-0.5 font-sans text-[10px] font-semibold xl:inline">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  )
}

export default function Navbar({ onHome, studio, onOpenDesigner, onReset, onOpenPalette }) {
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const headerRef = useRef(null)
  const compact = useNavCompact()
  const { user, logout } = useAuth()
  const sectionIds = useMemo(
    () => (studio ? STUDIO_LINKS.map((l) => l.id) : ['top', 'how-it-works', 'vastu', 'styles', 'redesign', 'image-lab']),
    [studio],
  )
  const active = useActiveSection(sectionIds)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    // A tap outside the header closes the menu too.
    const onPointer = (e) => { if (!headerRef.current?.contains(e.target)) setOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const go = () => {
    setOpen(false)
    onHome?.()
  }

  return (
    <header ref={headerRef} className={`sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur-md transition-[height,background] ${compact ? 'shadow-sm' : ''}`}>
      <nav aria-label="Main" className={`mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 ${compact ? 'nav-compact' : 'h-16'}`}>
        <a href="#top" onClick={go} aria-label="SpaceSense home" className="flex items-center gap-2.5 rounded-sm">
          <Home aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 text-sage-dark" />
          <span className="font-display text-2xl font-semibold tracking-tight">SpaceSense</span>
        </a>
        {studio ? (
          <ul className="hidden items-center gap-6 text-[0.78rem] uppercase tracking-[0.14em] lg:flex">
            {STUDIO_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} aria-current={active === l.href ? 'true' : undefined} className={`nav-link rounded-sm transition-colors ${active === l.href ? 'text-ink' : 'text-muted hover:text-ink'}`}>{l.label}</a>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="hidden items-center gap-5 whitespace-nowrap text-[0.78rem] uppercase tracking-[0.14em] lg:flex xl:gap-8">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={go}
                  aria-current={active === l.href ? 'true' : undefined}
                  className={`nav-link rounded-sm transition-colors ${active === l.href ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {l.label}
                </a>
              </li>
            ))}
            {onOpenDesigner && (
              // Below xl there isn't room; the hero, the Vastu section and Cmd+K still open the designer.
              <li className="hidden xl:list-item">
                <button type="button" onClick={onOpenDesigner} className="nav-link rounded-sm uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink">
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
            <button type="button" onClick={onReset} className="press bg-ink px-5 py-2.5 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-cream transition-colors hover:bg-brass">
              Start over
            </button>
            <SearchButton onClick={onOpenPalette} />
            <ThemeToggle />
          </div>
        ) : (
          <div className="hidden items-center gap-3 whitespace-nowrap lg:flex xl:gap-5">
            <AccountLink user={user} />
            <a href="#redesign" onClick={go} className="press bg-ink px-4 py-2.5 xl:px-5 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-cream transition-colors hover:bg-brass">
            Design My Space
            </a>
            <SearchButton onClick={onOpenPalette} />
            <ThemeToggle />
          </div>
        )}
        <div className="flex items-center gap-1 lg:hidden">
        <SearchButton onClick={onOpenPalette} />
        <ThemeToggle />
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
        </div>
      </nav>
      {open && (
        <div id="mobile-menu" className="anim-scale origin-top max-h-[calc(100svh-4rem)] overflow-y-auto border-t border-line bg-cream px-5 pb-6 pt-2 lg:hidden">
          <ul className="stagger">
            {(studio ? STUDIO_LINKS : links).map((l, i) => (
              <li key={l.href} className="border-b border-line" style={{ '--i': i }}>
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
