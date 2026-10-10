import { Check } from 'lucide-react'
import { STYLES } from '../../data/sampleData'

export default function StyleSelector({ value, onChange, error }) {
  return (
    <fieldset aria-describedby={error ? 'style-error' : undefined}>
      <legend className="mb-2 text-sm font-semibold">Preferred style</legend>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {STYLES.map((s) => (
          <label key={s.id} className={`relative cursor-pointer rounded-xl border p-3 text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-dark ${value === s.id ? 'border-sage bg-sage/10' : 'border-line bg-white hover:bg-sand'}`}>
            <input type="radio" name="style" value={s.id} checked={value === s.id} onChange={() => onChange(s.id)} className="sr-only" />
            <span className="mb-2 flex gap-1" aria-hidden="true">
              {s.swatch.map((c) => <span key={c} className="h-4 w-4 rounded-full border border-black/10" style={{ background: c }} />)}
            </span>
            <span className="block text-sm font-semibold">{s.name}</span>
            <span className="block text-xs text-muted">{s.blurb}</span>
            {value === s.id && <Check aria-hidden="true" className="absolute right-2 top-2 h-4 w-4 text-sage-dark" />}
          </label>
        ))}
      </div>
      <p id="style-error" role="alert" className="mt-1 min-h-4 text-xs text-red-700">{error}</p>
    </fieldset>
  )
}
