export default function PaletteStrip({ colors, title = 'Palette from your photo' }) {
  if (!colors?.length) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <ul className="mt-2 flex gap-2">
        {colors.map((c) => (
          <li key={c} className="flex flex-col items-center gap-1">
            <span className="h-10 w-10 rounded-full border border-black/10 shadow-xs" style={{ background: c }} />
            <span className="font-mono text-[0.65rem] text-muted">{c}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
