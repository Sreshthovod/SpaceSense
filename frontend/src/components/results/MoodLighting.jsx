const MOODS = [
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
]

const LIGHT = [
  { id: 'day', label: 'Day' },
  { id: 'evening', label: 'Evening' },
]

function ChipGroup({ legend, value, options, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{legend}</legend>
      <div className="flex gap-2">
        {options.map((opt) => (
          <label key={opt.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${value === opt.id ? 'border-ink bg-ink text-cream' : 'border-line bg-white hover:bg-sand'}`}>
            <input type="radio" name={legend} value={opt.id} checked={value === opt.id} onChange={() => onChange(opt.id)} className="sr-only" />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function MoodLighting({ mood, lighting, onMood, onLighting }) {
  return (
    <div className="flex flex-wrap gap-6">
      <ChipGroup legend="Mood" value={mood} options={MOODS} onChange={onMood} />
      <ChipGroup legend="Lighting" value={lighting} options={LIGHT} onChange={onLighting} />
    </div>
  )
}
