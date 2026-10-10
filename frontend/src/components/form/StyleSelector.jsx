import { Check } from 'lucide-react'
import { STYLES } from '../../data/sampleData'

export default function StyleSelector({ value, onChange, error }) {
  return (
    <fieldset aria-describedby={error ? 'style-error' : undefined}>
      <legend className="mb-2.5 text-sm font-semibold text-ink">
        Preferred style <span className="ml-0.5 text-xs font-normal text-clay" title="Required">*</span>
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STYLES.map((s) => {
          const isSelected = value === s.id
          return (
            <label
              key={s.id}
              className={`relative cursor-pointer rounded-xl border p-3.5 text-left transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sage-dark has-[:focus-visible]:ring-offset-2 ${
                isSelected
                  ? 'border-sage-dark bg-sage/15 shadow-sm ring-2 ring-sage-dark'
                  : 'border-line bg-white hover:border-muted/50 hover:bg-sand/60'
              }`}
            >
              <input
                type="radio"
                name="style"
                value={s.id}
                checked={isSelected}
                onChange={() => onChange(s.id)}
                className="sr-only"
              />
              <span className="mb-2.5 flex items-center gap-1.5" aria-hidden="true">
                {s.swatch.map((c) => (
                  <span key={c} className="h-4 w-4 rounded-full border border-black/15 shadow-xs" style={{ background: c }} />
                ))}
              </span>
              <span className="block text-sm font-semibold text-ink">{s.name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{s.blurb}</span>
              {isSelected && (
                <span className="check-pop absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-sage-dark text-white">
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
              )}
            </label>
          )
        })}
      </div>
      {error && (
        <p id="style-error" role="alert" className="mt-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}
