import { SHORT, wallDirections } from '../model/compass'

// The 8 directions laid out like a compass rose, with "not set" in the middle.
const GRID = ['north-west', 'north', 'north-east', 'west', null, 'east', 'south-west', 'south', 'south-east']

/**
 * Asks which compass side the back wall is on, as a little rose of buttons. Shared by the viewport
 * compass, the Vastu check and AI arrange so the answer is set once for the whole room.
 */
export default function FacingPicker({ facing, onChange, compact = false }) {
  const walls = wallDirections(facing)
  return (
    <div>
      <p id="facing-label" className="text-[11px] font-semibold">Which side of the compass is the back wall on?</p>
      <div role="radiogroup" aria-labelledby="facing-label" className={`mt-1.5 grid grid-cols-3 gap-1 ${compact ? 'w-32' : 'w-40'}`}>
        {GRID.map((d) => {
          const on = (facing ?? null) === d
          return (
            <button
              key={d ?? 'unset'}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={d ? `Back wall faces ${d}` : 'Direction not set'}
              title={d ?? 'Not set'}
              onClick={() => onChange(d)}
              className={`press rounded-lg border py-1 text-[11px] font-semibold transition-colors ${on ? 'border-ink bg-ink text-cream' : 'border-line bg-white hover:bg-sand'} ${d ? '' : 'text-muted'}`}
            >
              {d ? SHORT[d] : '?'}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {walls
          ? `Back ${SHORT[walls.back]} · Right ${SHORT[walls.right]} · Front ${SHORT[walls.front]} · Left ${SHORT[walls.left]}`
          : 'Stand facing the back wall (the far wall in the first 3D view) and check a phone compass.'}
      </p>
    </div>
  )
}
