import { useEffect, useRef, useState } from 'react'
import { Home, Menu, X } from 'lucide-react'

const links = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#styles', label: 'Design Styles' },
  { href: '#about', label: 'About' },
]

export default function Navbar({ onHome }) {
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = () => { setOpen(false); onHome?.() }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#top" onClick={go} aria-label="SpaceSense home" className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4">
          <Home aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 text-sage-dark" />
          <span className="font-display text-2xl font-semibold tracking-tight">SpaceSense</span>
        </a>
        <ul className="hidden items-center gap-9 text-[0.8rem] uppercase tracking-[0.14em] lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={go} className="rounded-sm text-muted underline-offset-8 transition-colors hover:text-ink hover:underline focus-visible:outline-2">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a href="#redesign" onClick={go} className="hidden bg-ink px-5 py-3 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-cream transition-colors duration-200 hover:bg-brass lg:inline-block">
          Design My Space
        </a>
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
            {links.map((l) => (
              <li key={l.href} className="border-b border-line">
                <a href={l.href} onClick={go} className="block py-4 font-display text-2xl">{l.label}</a>
              </li>
            ))}
          </ul>
          <a href="#redesign" onClick={go} className="mt-6 block bg-ink px-5 py-3 text-center text-sm font-medium text-cream">Design My Space</a>
        </div>
      )}
    </header>
  )
}
