import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** A labelled input with its error and hint wired up for screen readers. Passwords get a show/hide toggle. */
export default function TextField({ id, label, type = 'text', value, onChange, error, hint, autoComplete, required = true, ...rest }) {
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {!required && <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>}
      </label>
      <div className="relative">
        <input
          id={id} name={id} type={isPassword && shown ? 'text' : type} value={value} required={required}
          onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
          aria-invalid={!!error} aria-describedby={describedBy}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark ${
            isPassword ? 'pr-11' : ''
          } ${error ? 'border-red-400 bg-red-50/40' : 'border-line hover:border-muted/50'}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown}
            aria-label={shown ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-sage-dark"
          >
            {shown ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
          </button>
        )}
      </div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700">{error}</p>}
    </div>
  )
}
