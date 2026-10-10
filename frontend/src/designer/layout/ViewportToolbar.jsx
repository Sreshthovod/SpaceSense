import { useEffect, useRef, useState } from 'react'
import { Camera, CircleHelp, Crosshair, Hand, Magnet, Maximize2, Move, MousePointer2, RotateCw } from 'lucide-react'
import { MODES, PRESETS, PRESET_LABELS } from '../model/camera'

const MODE_ICONS = { navigate: Hand, select: MousePointer2, move: Move, rotate: RotateCw }
const chip = 'pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-white'

function Popover({ label, icon: Icon, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div ref={ref} className="pointer-events-auto relative" onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) } }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={chip}>
        <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {label}
      </button>
      {open && (
        <div className={`absolute top-full z-20 mt-2 w-64 rounded-2xl border border-line bg-white p-2 text-xs shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

/**
 * Viewport controls: interaction mode, snapping, 3D/plan view, camera presets and help.
 * Everything here is UI state: none of it creates undo history.
 */
export default function ViewportToolbar({ mode, setMode, snap, setSnap, view, setView, onCamera, canFocus, gesture, setGesture }) {
  const current = MODES.find((m) => m.id === mode)
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Interaction mode" className="pointer-events-auto flex rounded-full bg-white/95 p-0.5 shadow-sm">
            {MODES.map((m) => {
              const Icon = MODE_ICONS[m.id]
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={mode === m.id}
                  onClick={() => setMode(m.id)}
                  title={`${m.label} (${m.key.toUpperCase()})`}
                  aria-keyshortcuts={m.key.toUpperCase()}
                  aria-label={m.label}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${mode === m.id ? 'bg-ink text-cream' : 'text-muted hover:text-ink'}`}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  <span aria-hidden="true" className="hidden sm:inline">{m.label}</span>
                </button>
              )
            })}
          </div>
          <button type="button" aria-pressed={snap} onClick={() => setSnap(!snap)} className={`${chip} ${snap ? '' : 'text-muted'}`} title="Snap to the grid, walls and other furniture">
            <Magnet aria-hidden="true" className="h-3.5 w-3.5" /> Snap {snap ? 'on' : 'off'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="View" className="pointer-events-auto flex rounded-full bg-white/95 p-0.5 shadow-sm">
            {[['3d', '3D'], ['plan', 'Plan']].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${view === id ? 'bg-ink text-cream' : 'text-muted hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
          <Popover label="Camera" icon={Camera}>
            {(close) => (
              <ul className="space-y-0.5">
                {PRESETS.map((p) => (
                  <li key={p}>
                    <button type="button" disabled={view === 'plan'} onClick={() => { onCamera({ kind: 'preset', name: p }); close() }} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-sand disabled:opacity-40">
                      {PRESET_LABELS[p]}
                    </button>
                  </li>
                ))}
                <li className="border-t border-line pt-0.5">
                  <button type="button" onClick={() => { onCamera({ kind: 'fit' }); close() }} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-sand">
                    <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" /> Fit room
                  </button>
                </li>
                <li>
                  <button type="button" disabled={!canFocus} onClick={() => { onCamera({ kind: 'focus' }); close() }} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-sand disabled:opacity-40">
                    <Crosshair aria-hidden="true" className="h-3.5 w-3.5" /> Focus selected (F)
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => { onCamera({ kind: 'preset', name: 'perspective' }); close() }} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-sand">
                    Reset camera
                  </button>
                </li>
              </ul>
            )}
          </Popover>
          <Popover label="Help" icon={CircleHelp}>
            {() => (
              <div className="space-y-2 p-1">
                <fieldset>
                  <legend className="font-semibold">Two-finger scroll / wheel</legend>
                  {[['auto', 'Automatic (trackpad pans, mouse wheel zooms)'], ['zoom', 'Always zoom'], ['pan', 'Always pan']].map(([id, label]) => (
                    <label key={id} className="mt-1 flex items-center gap-2">
                      <input type="radio" name="scroll-gesture" checked={gesture === id} onChange={() => setGesture(id)} /> {label}
                    </label>
                  ))}
                  <p className="mt-1 text-muted">Pinch always zooms.</p>
                </fieldset>
                <div>
                  <p className="font-semibold">Mouse and trackpad</p>
                  <ul className="mt-0.5 space-y-0.5 text-muted">
                    <li>Drag empty space: orbit (in Plan: pan)</li>
                    <li>Right-drag or Shift+drag: pan</li>
                    <li>Scroll or pinch: zoom</li>
                    <li>Double-click an object: focus on it</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Keys</p>
                  <ul className="mt-0.5 space-y-0.5 text-muted">
                    <li>H / V / M / E: Navigate, Select, Move, Rotate</li>
                    <li>F: focus selected · Esc: cancel / deselect</li>
                    <li>Arrows: nudge (Shift: 1 ft) · R: turn 15°</li>
                    <li>Delete: remove · Ctrl/Cmd+D: duplicate</li>
                    <li>Ctrl/Cmd+Z: undo · Ctrl/Cmd+Shift+Z: redo</li>
                  </ul>
                </div>
              </div>
            )}
          </Popover>
        </div>
      </div>
      <p className="pointer-events-auto self-start rounded-2xl bg-white/90 px-3 py-1 text-[11px] text-muted shadow-sm" data-testid="mode-hint">
        {view === 'plan' ? 'Plan view: drag empty space to pan, scroll or pinch to zoom. ' : ''}{current.hint}
      </p>
    </div>
  )
}
