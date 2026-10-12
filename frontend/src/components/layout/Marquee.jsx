const ITEMS = ['Advice first', 'Vastu-aware', 'Budgets in INR', 'Modern Indian', 'Minimalist', 'Scandinavian', 'Contemporary Luxury', '3D room designer', 'Your photo, only with approval']

function Row({ hidden }) {
  return (
    <ul aria-hidden={hidden || undefined} className="marquee-row flex shrink-0 items-center">
      {ITEMS.map((t) => (
        <li key={t} className="flex items-center gap-10 pr-10 font-display text-2xl italic text-ink/70 sm:text-3xl">
          {t}<span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-brass" />
        </li>
      ))}
    </ul>
  )
}

/** A slow ticker of what SpaceSense offers. Pauses on hover; stands still with reduced motion. */
export default function Marquee() {
  return (
    <section aria-label="What SpaceSense offers" className="marquee overflow-hidden border-y border-line bg-sand/40 py-5">
      <div className="marquee-track flex w-max">
        <Row />
        <Row hidden />
      </div>
    </section>
  )
}
