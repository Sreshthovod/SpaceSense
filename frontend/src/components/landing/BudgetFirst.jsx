import { Compass, Palette, Wallet } from 'lucide-react'

const points = [
  { icon: Palette, title: 'Personalized style suggestions', text: 'Pick a look you love and see a plan shaped around it.' },
  { icon: Wallet, title: 'Budget-aware furniture ideas', text: 'Set your budget in rupees and explore pieces that fit within it.' },
  { icon: Compass, title: 'Optional Vastu preferences', text: 'Switch on Vastu-aware placement guidance when it matters to you.' },
]

export default function BudgetFirst() {
  return (
    <section id="about" className="on-dark bg-ink py-20 text-cream lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-12">
        <div className="reveal lg:col-span-6">
          <p className="eyebrow !text-[#b4bfa5]">Budget-First Design</p>
          <h2 className="mt-4 font-display text-5xl font-medium leading-[1.02] sm:text-6xl">Beautiful spaces.<br /><em className="font-normal text-[#b4bfa5]">Thoughtful budgets.</em></h2>
          <p className="mt-7 max-w-md leading-relaxed text-cream/75">
            SpaceSense is designed to help you explore room transformations and furniture recommendations within the budget you choose. We are building towards this — the furniture and prices shown today are sample data, not live product listings.
          </p>
        </div>
        <ul className="lg:col-span-6 lg:pl-10">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="reveal flex gap-5 border-t border-cream/20 py-7 first:border-t-0 first:pt-0 lg:first:border-t lg:first:pt-7">
              <Icon aria-hidden="true" strokeWidth={1.4} className="mt-1 h-7 w-7 shrink-0 text-[#b4bfa5]" />
              <div>
                <h3 className="font-display text-2xl font-medium">{title}</h3>
                <p className="mt-1 text-cream/70">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
