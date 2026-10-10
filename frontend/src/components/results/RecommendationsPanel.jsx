import { SECTIONS } from '../../utils/recommendations'
import Card from '../ui/Card'

export default function RecommendationsPanel({ analysis }) {
  const recs = analysis.recommendations
  const isAI = analysis.method === 'gemini'
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-3xl font-semibold">Design recommendations</h2>
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-clay">
          {isAI ? 'AI analysis of your photo' : 'Rule-based'}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{analysis.disclaimer}</p>
      {recs.summary && <p className="mt-4 leading-relaxed">{recs.summary}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {SECTIONS.filter((s) => recs[s.key]?.length).map((s) => (
          <section key={s.key} aria-labelledby={`rec-${s.key}`}>
            <h3 id={`rec-${s.key}`} className="eyebrow">{s.label}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {recs[s.key].map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
