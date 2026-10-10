import { useToast } from '../../context/toast'

export default function PaletteStrip({ colors, title = 'Palette from your photo' }) {
  const { toast } = useToast()
  if (!colors?.length) return null

  const copy = async (c) => {
    try {
      await navigator.clipboard.writeText(c)
      toast(`Copied ${c}`)
    } catch {
      toast('Could not copy the colour.', { tone: 'error' })
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <ul className="stagger mt-2 flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <li key={c} style={{ '--i': i }}>
            <button
              type="button"
              onClick={() => copy(c)}
              title={`Copy ${c}`}
              aria-label={`Copy colour ${c}`}
              className="group flex flex-col items-center gap-1 rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-sage-dark"
            >
              <span
                className="h-10 w-10 rounded-full border border-black/10 shadow-xs transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-1 group-hover:scale-110 group-active:scale-95"
                style={{ background: c }}
              />
              <span className="font-mono text-[0.65rem] text-muted transition-colors group-hover:text-ink">{c}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
