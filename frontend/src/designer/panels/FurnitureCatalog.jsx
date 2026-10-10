import { Copy, RotateCcw, RotateCw, Trash2, X } from 'lucide-react'
import { FLOOR_CATEGORIES, FLOOR_ITEMS, floorItemSpec } from '../model/catalog'
import { footprint } from '../model/floorPlacement'
import { formatFeet } from '../model/wallPlacement'
import { priceHint } from '../hooks/useStudioCatalog'
import ProductPicker from './ProductPicker'

// Flat items (rugs) are shown as width × depth only.
const sizeLabel = ({ w, d, h }) => (h < 1 / 12 ? `${formatFeet(w)} × ${formatFeet(d)}` : `${formatFeet(w)} × ${formatFeet(d)} × ${formatFeet(h)}`)

/** Floor furniture, grouped by category. Every button adds one item to a free spot. */
export function FurnitureCatalog({ onAdd, catalog }) {
  return (
    <section aria-labelledby="catalog-heading">
      <h3 id="catalog-heading" className="font-display text-xl font-semibold">Add furniture</h3>
      <p className="mt-1 text-xs text-muted">Simple 3D shapes at typical sizes (width × depth × height). New pieces go to the nearest free spot. Pick a real product in the inspector to add its verified price.</p>
      <div className="mt-3 space-y-3">
        {FLOOR_CATEGORIES.map((cat) => {
          const ids = Object.keys(FLOOR_ITEMS).filter((id) => FLOOR_ITEMS[id].category === cat.id)
          if (!ids.length) return null
          return (
            <div key={cat.id}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{cat.label}</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onAdd(id)}
                    aria-label={`Add ${FLOOR_ITEMS[id].name.toLowerCase()}`}
                    className="flex items-start gap-2 rounded-xl border border-line bg-white px-2.5 py-2 text-left hover:border-sage hover:bg-sand/50"
                  >
                    <span aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ background: FLOOR_ITEMS[id].color }} />
                    <span>
                      <span className="block text-xs font-medium">{FLOOR_ITEMS[id].name}</span>
                      <span className="block text-[10px] text-muted">{sizeLabel(FLOOR_ITEMS[id].size)}</span>
                      {catalog && <span className="block text-[10px] text-sage-dark">{priceHint(catalog, id)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const tool = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-sand'

/** The selected floor item: size, rotation, optional resize, duplicate, delete. */
export function FurnitureInspector({ item, dispatch, onDuplicate, onDelete, onDeselect, catalog, catalogError }) {
  const spec = floorItemSpec(item.catalogId)
  const size = footprint(item)
  const rotate = (by) => dispatch({ type: 'updatePlaced', uid: item.uid, changes: { rotation: item.rotation + by } })
  return (
    <section aria-labelledby="furniture-inspector-heading" className="rounded-xl border border-sage bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="furniture-inspector-heading" className="text-sm font-semibold">{spec.name}</h3>
          <p className="text-[11px] text-muted">{sizeLabel(size)} · turned {item.rotation}°</p>
        </div>
        <button type="button" onClick={onDeselect} aria-label="Deselect" className="rounded-full p-1 hover:bg-sand">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" className={tool} onClick={() => rotate(-15)}><RotateCcw aria-hidden="true" className="h-3.5 w-3.5" /> Turn left</button>
        <button type="button" className={tool} onClick={() => rotate(15)}><RotateCw aria-hidden="true" className="h-3.5 w-3.5" /> Turn right</button>
        <button type="button" className={tool} onClick={() => rotate(90)}>Turn 90°</button>
        <button type="button" className={tool} onClick={onDuplicate}><Copy aria-hidden="true" className="h-3.5 w-3.5" /> Duplicate</button>
        <button type="button" className={tool} onClick={onDelete}><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Delete</button>
      </div>
      {spec.scale && (
        <label className="mt-3 block text-xs font-semibold">
          Size {Math.round(item.scale * 100)}%
          <input
            type="range"
            min={spec.scale[0] * 100}
            max={spec.scale[1] * 100}
            step="5"
            value={Math.round(item.scale * 100)}
            onChange={(e) => dispatch({ type: 'updatePlaced', uid: item.uid, changes: { scale: Number(e.target.value) / 100 }, coalesce: `scale:${item.uid}` })}
            className="mt-1 w-full accent-sage-dark"
          />
        </label>
      )}
      <div className="mt-3 border-t border-line pt-3">
        <ProductPicker item={item} catalog={catalog} catalogError={catalogError} dispatch={dispatch} />
      </div>
      <p className="mt-2 text-[11px] text-muted">Drag it in the 3D view, or use arrow keys (Shift for 1 ft). R turns it, Delete removes it.</p>
    </section>
  )
}
