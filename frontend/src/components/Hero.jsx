import { ArrowRight, Compass, IndianRupee, Wand2 } from 'lucide-react'
import Button from './ui/Button'

const perks = [
  { icon: Wand2, text: 'Style-matched redesign plans' },
  { icon: IndianRupee, text: 'Budgets in INR' },
  { icon: Compass, text: 'Optional Vastu guidance' },
]

export default function Hero() {
  return (
    <section id="top" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:pt-20">
      <div>
        <p className="mb-3 inline-block rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-wider text-clay">Prototype preview</p>
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Reimagine your room, one photo at a time.</h1>
        <p className="mt-4 max-w-lg text-lg text-muted">
          Upload a photo, share your dimensions, style and budget, and see how SpaceSense will plan your redesign.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button as="a" href="#redesign">Start your redesign <ArrowRight aria-hidden="true" className="h-4 w-4" /></Button>
          <Button as="a" href="#how-it-works" variant="secondary">How it works</Button>
        </div>
        <ul className="mt-8 space-y-2 text-sm text-muted">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2"><Icon aria-hidden="true" className="h-4 w-4 text-sage" /> {text}</li>
          ))}
        </ul>
      </div>
      <div aria-hidden="true" className="relative mx-auto aspect-[4/3] w-full max-w-md">
        <div className="absolute inset-0 rotate-3 rounded-3xl bg-sage/20" />
        <div className="absolute inset-0 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-sand to-white shadow-lg">
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-clay/20" />
          <div className="absolute bottom-[26%] left-[12%] h-[22%] w-[48%] rounded-xl bg-sage" />
          <div className="absolute bottom-[26%] left-[10%] h-[34%] w-[8%] rounded-lg bg-sage-dark" />
          <div className="absolute bottom-[26%] right-[14%] h-[14%] w-[20%] rounded-md bg-clay/70" />
          <div className="absolute right-[18%] top-[14%] h-[26%] w-[22%] rounded-md border-4 border-white bg-sand" />
        </div>
      </div>
    </section>
  )
}
