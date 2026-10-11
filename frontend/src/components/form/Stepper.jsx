import { Check } from 'lucide-react'

const STEPS = [
  { n: 1, label: 'Photo & room' },
  { n: 2, label: 'Style & budget' },
  { n: 3, label: 'Preview brief' },
]

/**
 * The three steps of the brief. Each has a track that fills in sage once you reach it, and a marker
 * that turns into a tick when the step is done. Driven by the form's real step; earlier steps can be
 * revisited, later ones only after the current one checks out (RoomForm decides).
 */
export default function Stepper({ step, onJump }) {
  return (
    <nav aria-label="Redesign steps" className="mb-7">
      <p className="mb-3 text-xs font-medium text-muted sm:hidden" aria-hidden="true">
        Step {step} of {STEPS.length} · <span className="text-ink">{STEPS[step - 1].label}</span>
      </p>
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {STEPS.map((item) => {
          const current = item.n === step
          const done = item.n < step
          const reached = done || current
          return (
            <li key={item.n}>
              <button
                type="button"
                onClick={() => onJump?.(item.n)}
                aria-current={current ? 'step' : undefined}
                aria-label={`Step ${item.n}: ${item.label}${done ? ' (done)' : ''}`}
                className="group block w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage-dark"
              >
                <span aria-hidden="true" className="block h-[3px] overflow-hidden rounded-full bg-line">
                  <span
                    className="step-fill block h-full origin-left rounded-full bg-sage-dark"
                    style={{ transform: `scaleX(${reached ? 1 : 0})` }}
                  />
                </span>
                <span className="mt-3 flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors duration-300 ${
                      done ? 'border-sage-dark bg-sage-dark text-cream' : current ? 'border-ink bg-ink text-cream' : 'border-line text-muted group-hover:border-muted'
                    }`}
                  >
                    {done ? <Check className="check-pop h-3.5 w-3.5" strokeWidth={3} /> : item.n}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`hidden text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 sm:inline ${
                      current ? 'text-ink' : done ? 'text-sage-dark' : 'text-muted group-hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
