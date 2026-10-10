import { Monitor, Moon, Sun } from 'lucide-react'
import useTheme from '../../hooks/useTheme'

const centre = (el) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/**
 * Dark mode switch. A real toggle button: the name stays "Dark mode" and aria-pressed says whether it is
 * on. The new theme spreads out as a circle from the button where the browser supports it.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={(e) => toggle(centre(e.currentTarget))}
      aria-pressed={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`press relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-ink transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark ${className}`}
    >
      <Sun aria-hidden="true" strokeWidth={1.5} className={`absolute h-5 w-5 transition-all duration-500 ease-[var(--ease-spring)] ${dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`} />
      <Moon aria-hidden="true" strokeWidth={1.5} className={`absolute h-5 w-5 transition-all duration-500 ease-[var(--ease-spring)] ${dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
    </button>
  )
}

const CHOICES = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
]

/** Light / Dark / System. "System" forgets the saved choice and follows the operating system again. */
export function ThemeChoice({ className = '' }) {
  const { preference, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className={`relative inline-grid grid-cols-3 rounded-full border border-line bg-white p-1 ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-ink transition-transform duration-300 ease-[var(--ease-out)]"
        style={{ transform: `translateX(${CHOICES.findIndex((c) => c.id === preference) * 100}%)` }}
      />
      {CHOICES.map(({ id, label, Icon }) => {
        const on = preference === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={(e) => setTheme(id, centre(e.currentTarget))}
            className={`relative z-10 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${on ? 'text-cream' : 'text-muted hover:text-ink'}`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {label}
          </button>
        )
      })}
    </div>
  )
}
