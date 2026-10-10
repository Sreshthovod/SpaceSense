import { Home } from 'lucide-react'

const links = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#styles', label: 'Design Styles' },
  { href: '#about', label: 'About' },
  { href: '#redesign', label: 'Design My Space' },
]

const YEAR = new Date().getFullYear()

export default function Footer({ onHome }) {
  return (
    <footer className="border-t border-line bg-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-6">
          <p className="flex items-center gap-2.5 font-display text-2xl font-semibold"><Home aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 text-sage-dark" /> SpaceSense</p>
          <p className="mt-3 max-w-sm text-sm text-muted">AI-assisted interior redesign, shaped around your style, budget and way of living. A hackathon prototype in active development.</p>
        </div>
        <nav aria-label="Footer" className="md:col-span-6 md:justify-self-end">
          <ul className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
            {links.map((l) => <li key={l.href}><a href={l.href} onClick={onHome} className="text-muted hover:text-ink hover:underline">{l.label}</a></li>)}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted sm:px-8">© {YEAR} SpaceSense. Photographs courtesy of Unsplash contributors; shown as examples only.</p>
      </div>
    </footer>
  )
}
