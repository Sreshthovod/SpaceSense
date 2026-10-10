import { Hand, MousePointerClick, PanelLeft, ZoomIn } from 'lucide-react'

const TIPS = [
  { icon: Hand, text: 'Drag to rotate the room' },
  { icon: ZoomIn, text: 'Scroll or pinch to zoom' },
  { icon: MousePointerClick, text: 'Click a piece to select it' },
  { icon: PanelLeft, text: 'Add furniture from the library' },
]

/** A small first-visit hint about getting around. Dismissed for good; Help shows it again. */
export default function OnboardingHint({ onClose }) {
  return (
    <div role="dialog" aria-labelledby="tips-title" className="pointer-events-auto absolute bottom-16 left-1/2 z-20 w-[min(30rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-line bg-white/95 p-3 shadow-lg">
      <h3 id="tips-title" className="text-sm font-semibold">Getting around</h3>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-xs">
        {TIPS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-sage-dark" /> {text}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">Help (top right) lists every shortcut.</p>
        <button type="button" onClick={onClose} className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream hover:bg-ink/90">Got it</button>
      </div>
    </div>
  )
}
