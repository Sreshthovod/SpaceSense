import { useEffect, useRef, useState } from 'react'
import { Compass as CompassIcon } from 'lucide-react'
import FacingPicker from '../panels/FacingPicker'

const LETTERS = [['N', 0], ['E', 90], ['S', 180], ['W', 270]]

/**
 * A compass in the corner of the 3D view. The rose turns with the camera (the scene writes its rotation
 * straight into `roseRef`, so orbiting never re-renders React), so N always points to the room's real
 * north. Clicking it sets which way the room faces. Without a direction it just offers to set one.
 */
export default function Compass({ facing, onChange, roseRef }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute bottom-3 right-3 z-10"
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) } }}
    >
      {open && (
        <div className="anim-scale absolute bottom-full right-0 mb-2 w-52 origin-bottom-right rounded-2xl border border-line bg-white p-3 text-xs shadow-xl">
          <FacingPicker facing={facing} onChange={(d) => { onChange(d); if (d) setOpen(false) }} compact />
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label={facing ? `Compass: the back wall faces ${facing}. Change the room's direction` : "Set which way the room faces"}
        title={facing ? 'Compass: click to change the direction' : 'Set the room direction'}
        onClick={() => setOpen((o) => !o)}
        className="press group relative flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white/95 shadow-md backdrop-blur transition-shadow hover:shadow-lg"
      >
        {facing ? (
          <svg ref={roseRef} viewBox="-32 -32 64 64" aria-hidden="true" className="h-full w-full" data-testid="compass-rose">
            <circle r="27" fill="none" stroke="var(--color-line)" strokeWidth="1" />
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1="0" y1="-27" x2="0" y2={i % 2 ? '-25' : '-23.5'} stroke="var(--color-muted)" strokeWidth="1" transform={`rotate(${i * 45})`} />
            ))}
            {/* The needle: a clay north half and a muted south half. */}
            <path d="M0 -11 L3.5 0 L-3.5 0 Z" style={{ fill: 'var(--color-clay)' }} />
            <path d="M0 11 L3.5 0 L-3.5 0 Z" style={{ fill: 'var(--color-muted)' }} opacity="0.55" />
            <circle r="2" style={{ fill: 'var(--color-ink)' }} />
            {LETTERS.map(([l, deg]) => {
              const a = (deg * Math.PI) / 180
              return (
                <text
                  key={l}
                  x={Math.sin(a) * 17.5}
                  y={-Math.cos(a) * 17.5 + 2.6}
                  textAnchor="middle"
                  fontSize={l === 'N' ? 8 : 6.5}
                  fontWeight="700"
                  // Counter-rotated (the scene sets --counter), so the letters stay upright as the rose turns.
                  style={{
                    fill: l === 'N' ? 'var(--color-clay)' : 'var(--color-ink)',
                    transformBox: 'view-box',
                    transformOrigin: `${Math.sin(a) * 17.5}px ${-Math.cos(a) * 17.5}px`,
                    transform: 'rotate(var(--counter, 0deg))',
                  }}
                >
                  {l}
                </text>
              )
            })}
          </svg>
        ) : (
          <span className="flex flex-col items-center gap-0.5 text-[9px] font-semibold leading-tight text-muted group-hover:text-ink">
            <CompassIcon aria-hidden="true" className="h-5 w-5" />
            Set N
          </span>
        )}
      </button>
    </div>
  )
}
