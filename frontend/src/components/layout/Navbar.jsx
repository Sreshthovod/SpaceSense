import { useState } from 'react'
import { Menu, Sofa, X } from 'lucide-react'

const links = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#redesign', label: 'Start redesign' },
]

export default function Navbar({ onHome }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" onClick={onHome} className="flex items-center gap-2 font-display text-xl font-semibold">
          <Sofa aria-hidden="true" className="h-6 w-6 text-sage" /> SpaceSense
        </a>
        <ul className="hidden items-center gap-6 text-sm font-medium sm:flex">
          {links.map((l) => (
            <li key={l.href}><a href={l.href} onClick={onHome} className="text-muted hover:text-ink">{l.label}</a></li>
          ))}
        </ul>
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-sand sm:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </nav>
      {open && (
        <ul id="mobile-menu" className="border-t border-line px-4 pb-3 sm:hidden">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="block py-3 text-sm font-medium" onClick={() => { setOpen(false); onHome?.() }}>{l.label}</a>
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
