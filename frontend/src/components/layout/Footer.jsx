import { Home } from 'lucide-react'
import { ThemeChoice } from './ThemeToggle'

const links = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#styles', label: 'Design Styles' },
  { href: '#redesign', label: 'Design My Space' },
]

const YEAR = new Date().getFullYear()

export default function Footer({ onHome }) {
  return (
    <footer className="border-t border-line bg-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-6">
          <a href="#top" onClick={onHome} aria-label="SpaceSense home" className="inline-flex items-center gap-2.5 font-display text-2xl font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2">
            <Home aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 text-sage-dark" /> SpaceSense
          </a>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">AI-assisted room advice, shaped around your style and budget. Saved briefs live in this browser only, product prices are as of the date checked, and AI-edited photos can be inaccurate.</p>
        </div>
        <nav aria-label="Footer" className="md:col-span-6 md:justify-self-end">
          <ul className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={onHome} className="rounded-xs text-muted transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <p className="text-xs text-muted">© {YEAR} SpaceSense. Photographs courtesy of Unsplash contributors; shown as examples only.</p>
          <ThemeChoice />
        </div>
      </div>
    </footer>
  )
}
