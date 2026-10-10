import { Moon, Sun } from 'lucide-react'
import useTheme from '../../hooks/useTheme'

/** Dark mode switch. A real toggle button: the name stays "Dark mode" and aria-pressed says whether it is on. */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark ${className}`}
    >
      {dark
        ? <Sun aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
        : <Moon aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />}
    </button>
  )
}
