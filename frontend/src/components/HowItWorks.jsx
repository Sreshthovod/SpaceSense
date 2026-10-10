import { Camera, Ruler, Sparkles } from 'lucide-react'
import Card from './ui/Card'

const steps = [
  { icon: Camera, title: '1. Upload', text: 'Add a clear photo of your room.' },
  { icon: Ruler, title: '2. Describe', text: 'Enter dimensions, style, budget and Vastu preference.' },
  { icon: Sparkles, title: '3. Preview', text: 'Review the redesign layout and furniture suggestions. AI generation is coming soon.' },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-sand/50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-semibold">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <Icon aria-hidden="true" className="h-6 w-6 text-sage" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
