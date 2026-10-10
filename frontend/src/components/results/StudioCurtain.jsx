import { STYLES } from '../../data/sampleData'

export default function StudioCurtain({ form, imageUrl }) {
  const style = STYLES.find((s) => s.id === form.style)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream/92 px-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="max-w-md text-center">
        {imageUrl && (
          <img src={imageUrl} alt="" className="mx-auto mb-6 h-28 w-40 rounded-xl object-cover shadow-md" />
        )}
        <p className="eyebrow justify-center">Analysing your photo</p>
        <h2 className="mt-3 font-display text-4xl font-medium">Reading your room.</h2>
        <div className="mt-6 flex justify-center gap-2">
          {(style?.swatch || []).map((c) => (
            <span key={c} className="h-8 w-8 rounded-full border border-black/10" style={{ background: c }} />
          ))}
        </div>
        <p className="mt-5 text-sm text-muted">Your photo is being analysed for written advice. Nothing is edited yet; you decide that next.</p>
        <div className="mt-6 h-px overflow-hidden bg-line">
          <div className="h-full w-2/3 origin-left animate-pulse bg-ink" />
        </div>
      </div>
    </div>
  )
}
