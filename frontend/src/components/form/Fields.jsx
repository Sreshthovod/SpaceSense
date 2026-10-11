import { AlertCircle, ChevronDown } from 'lucide-react'

export function FieldShell({ id, label, error, hint, required = true, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-center justify-between text-sm font-semibold text-ink">
        <span>
          {label}
          {required ? (
            <span className="ml-1 text-clay text-xs font-normal" title="Required">*</span>
          ) : (
            <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>
          )}
        </span>
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="anim-up mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-700">
          <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// Inset fields: a step darker than the card, a sage ring on focus, a firmer border once filled.
const inputClass = (error, filled) =>
  `field h-11 w-full rounded-lg border bg-cream px-3.5 text-sm text-ink focus:outline-none ${
    error ? 'border-red-400' : filled ? 'border-muted/45 hover:border-muted/70' : 'border-line hover:border-muted/50'
  }`

const describe = (id, error, hint) =>
  [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined

export function SelectField({ id, label, value, onChange, options, error, required = true, placeholder = 'Select…' }) {
  return (
    <FieldShell id={id} label={label} error={error} required={required}>
      <div className={`relative ${error ? 'anim-shake' : ''}`}>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={describe(id, error)}
        className={`${inputClass(error, !!value)} cursor-pointer appearance-none pr-10 ${value ? '' : 'text-muted'}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </FieldShell>
  )
}

export function NumberField({ id, label, value, onChange, error, hint, suffix, prefix, min, max, step = 'any', required = true }) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <div className={`relative ${error ? 'anim-shake' : ''}`}>
        {prefix && (
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
            {prefix}
          </span>
        )}
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describe(id, error, hint)}
          className={`${inputClass(error, value !== '' && value != null)} tabular-nums ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wider text-muted">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  )
}

export function ToggleSwitch({ id, label, description, checked, onChange }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onChange(!checked)
        }
      }}
      className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-cream p-4 transition-colors hover:border-sage/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark"
    >
      <div>
        <span className="block text-sm font-semibold text-ink">{label} <span className="ml-1 text-xs font-normal text-muted">(optional)</span></span>
        <p id={`${id}-desc`} className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-desc`}
        onClick={(e) => {
          e.stopPropagation()
          onChange(!checked)
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark ${
          checked ? 'bg-sage-dark' : 'bg-line'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}
