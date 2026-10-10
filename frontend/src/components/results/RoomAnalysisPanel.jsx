import Card from '../ui/Card'

const label = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function RoomAnalysisPanel({ analysis }) {
  const stats = [
    ['Floor area', `${analysis.area_sqft.toLocaleString('en-IN')} sq ft`],
    ['Room size', label(analysis.size_category)],
    ['Budget tier', label(analysis.budget_tier)],
  ]
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl font-semibold">Room analysis</h3>
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-clay">From your inputs</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        {stats.map(([k, v]) => (
          <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
        ))}
      </dl>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
        {analysis.style_notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
      {analysis.vastu_notes.length > 0 && (
        <div className="mt-4 rounded-xl bg-sand p-3 text-sm">
          <p className="font-semibold">Vastu notes</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{analysis.vastu_notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
    </Card>
  )
}
