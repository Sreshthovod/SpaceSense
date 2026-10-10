const steps = [
  { n: '01', title: 'Share your space', text: 'Upload a room photo and enter your room dimensions.' },
  { n: '02', title: 'Make it yours', text: 'Choose your style, budget, and optional Vastu preferences.' },
  { n: '03', title: 'See the transformation', text: 'Explore a redesigned room and budget-conscious furniture ideas.' },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <div className="reveal">
        <p className="eyebrow">How It Works</p>
        <h2 id="how-it-works-heading" className="mt-4 font-display text-4xl font-medium leading-none sm:text-5xl lg:text-6xl">Three simple steps.</h2>
      </div>
      <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
        {steps.map((s, i) => (
          <li key={s.n} className="reveal border-t border-ink/80 pt-6 md:pr-10" style={{ transitionDelay: `${i * 120}ms` }}>
            <span className="font-display text-4xl font-medium text-sage sm:text-5xl">{s.n}</span>
            <h3 className="mt-4 font-display text-2xl font-medium sm:text-3xl">{s.title}</h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted sm:text-base">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
