import { Check } from 'lucide-react'

const STEPS = [
  { n: 1, label: 'Photo & room' },
  { n: 2, label: 'Style & budget' },
  { n: 3, label: 'Preview brief' },
]

export default function Stepper({ step, onJump }) {
  return (
    <div className="relative mb-8">
    {/* The ink bar slides along the top as steps are completed. */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0.5">
      <div className="h-full origin-left bg-ink transition-transform duration-500 ease-[var(--ease-out)]" style={{ transform: `scaleX(${step / STEPS.length})` }} />
    </div>
    <ol className="grid grid-cols-3 gap-2" aria-label="Redesign steps">
      {STEPS.map((item) => {
        const current = item.n === step
        const done = item.n < step
        return (
          <li key={item.n}>
            <button
              type="button"
              onClick={() => onJump?.(item.n)}
              aria-current={current ? 'step' : undefined}
              className={`flex w-full items-center gap-2 border-t-2 pt-3 text-left transition-colors ${
                current ? 'border-line text-ink' : done ? 'border-sage text-sage-dark' : 'border-line text-muted'
              }`}
            >
              <span className="font-display text-xl leading-none">{done ? <Check aria-hidden="true" className="check-pop inline h-5 w-5" /> : String(item.n).padStart(2, '0')}</span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em]">{item.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
    </div>
  )
}
