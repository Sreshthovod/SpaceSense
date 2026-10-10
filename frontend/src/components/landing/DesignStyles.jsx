import { ArrowUpRight } from 'lucide-react'

const tiles = [
  { id: 'modern-indian', name: 'Modern Indian', text: 'Warm timber, earthy tones and tactile textiles with a contemporary line.', img: '/images/style-modern-indian.jpg', alt: 'Living room with timber wall panels, terracotta cushion and dark stone fireplace', span: 'md:col-span-7' },
  { id: 'minimalist', name: 'Minimalist', text: 'Quiet rooms, honest materials and only what you need.', img: '/images/style-minimalist.jpg', alt: 'Minimal white interior with a pendant lamp, round table and timber stools', span: 'md:col-span-5' },
  { id: 'scandinavian', name: 'Scandinavian', text: 'Soft light, pale linens and calm, functional comfort.', img: '/images/style-scandinavian.jpg', alt: 'Bright room with sheer curtains, linen cushions and a framed print', span: 'md:col-span-5' },
  { id: 'contemporary-luxury', name: 'Contemporary Luxury', text: 'Marble, deep wood and layered symmetry for a refined finish.', img: '/images/style-contemporary-luxury.jpg', alt: 'Formal living room with marble fireplace wall and dark wood shelving', span: 'md:col-span-7' },
]

export default function DesignStyles({ onSelectStyle, selected }) {
  return (
    <section id="styles" aria-labelledby="styles-heading" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
      <div className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Design Styles</p>
          <h2 id="styles-heading" className="mt-4 font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">Find your look.</h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted sm:text-base">Click any style to start your redesign with it already chosen.</p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-12">
        {tiles.map((t) => {
          const active = selected === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectStyle(t.id)}
              aria-pressed={active}
              aria-label={`Start a redesign in the ${t.name} style`}
              className={`reveal group relative block cursor-pointer overflow-hidden rounded-xl text-left transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark ${t.span} ${active ? 'ring-2 ring-brass ring-offset-2 ring-offset-cream' : ''}`}
            >
              <img
                src={t.img}
                alt={t.alt}
                width="1000"
                height="667"
                loading="lazy"
                className="style-ken aspect-[4/3] w-full object-cover md:aspect-auto md:h-[26rem]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
              <div className="style-caption absolute inset-x-0 bottom-0 p-5 text-cream sm:p-6">
                <h3 className="flex items-center gap-2 font-display text-2xl font-medium sm:text-3xl">
                  {t.name}
                  <ArrowUpRight aria-hidden="true" className="h-5 w-5 text-cream/80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-cream/85 sm:text-sm">{t.text}</p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
