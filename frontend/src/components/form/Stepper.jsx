const STEPS = [
  { n: 1, label: 'Photo & room' },
  { n: 2, label: 'Style & budget' },
  { n: 3, label: 'Preview brief' },
]

export default function Stepper({ step, onJump }) {
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Redesign steps">
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
                current ? 'border-ink text-ink' : done ? 'border-sage text-sage-dark' : 'border-line text-muted'
              }`}
            >
              <span className="font-display text-xl leading-none">{String(item.n).padStart(2, '0')}</span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em]">{item.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
