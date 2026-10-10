export function FieldShell({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      <p id={`${id}-error`} role="alert" className="mt-1 min-h-4 text-xs text-red-700">{error}</p>
    </div>
  )
}

const inputClass = (error) =>
  `w-full rounded-xl border bg-white px-3 py-2.5 text-sm ${error ? 'border-red-400' : 'border-line'}`

const describe = (id, error, hint) => [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined

export function SelectField({ id, label, value, onChange, options, error, placeholder = 'Select…' }) {
  return (
    <FieldShell id={id} label={label} error={error}>
      <select id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={describe(id, error)} className={inputClass(error)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </FieldShell>
  )
}

export function NumberField({ id, label, value, onChange, error, hint, suffix, prefix, min, max, step = 'any' }) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        {prefix && <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">{prefix}</span>}
        <input
          id={id} name={id} type="number" inputMode="decimal" min={min} max={max} step={step}
          value={value} onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error} aria-describedby={describe(id, error, hint)}
          className={`${inputClass(error)} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>}
      </div>
    </FieldShell>
  )
}

export function ToggleSwitch({ id, label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-cream p-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <p id={`${id}-desc`} className="text-xs text-muted">{description}</p>
      </div>
      <button
        id={id} type="button" role="switch" aria-checked={checked} aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-sage' : 'bg-line'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}
