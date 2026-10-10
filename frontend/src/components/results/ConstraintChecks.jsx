import { CheckCircle2, Info } from 'lucide-react'
import { VASTU_NOTES } from '../../data/sampleData'
import Card from '../ui/Card'

export default function ConstraintChecks({ form, spent }) {
  const area = Number(form.length) * Number(form.width)
  const checks = [
    { ok: spent <= Number(form.budget), text: `Sample items fit within your budget` },
    { ok: area >= 80, text: `Room area ${area.toLocaleString('en-IN')} sq ft ${area >= 80 ? 'can host the sample layout' : 'is small; fewer pieces recommended'}` },
  ]
  return (
    <Card>
      <h3 className="font-display text-xl font-semibold">Constraint checks</h3>
      <p className="mt-1 text-xs text-muted">Basic calculations from your inputs. Layout checks on the real room are not implemented yet.</p>
      <ul className="mt-3 space-y-2 text-sm">
        {checks.map((c) => (
          <li key={c.text} className="flex items-start gap-2">
            {c.ok ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 text-sage" /> : <Info aria-hidden="true" className="mt-0.5 h-4 w-4 text-clay" />}
            {c.text}
          </li>
        ))}
      </ul>
      {form.vastu && (
        <div className="mt-4 rounded-xl bg-sand p-3 text-sm">
          <p className="font-semibold">Vastu notes</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{VASTU_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
    </Card>
  )
}
