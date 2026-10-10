import { useEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Box, PaintRoller, RotateCcw, TriangleAlert } from 'lucide-react'
import { STYLES } from '../data/sampleData'
import { formatINR } from '../utils/format'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import Button from '../components/ui/Button'
import { WALLS, WALL_LABELS, createDesign, findPlaced, onWall, roomSize, styleLabel } from './model/design'
import { newUid } from './model/ids'
import { GRID } from './model/wallPlacement'
import { ROTATE_STEP, floorWarnings, itemWorldCenter } from './model/floorPlacement'
import { wallItemSpec } from './model/catalog'
import useBudget from './hooks/useBudget'
import useStudioCatalog from './hooks/useStudioCatalog'
import BudgetPanel, { BudgetMeter } from './panels/BudgetPanel'
import { FurnitureCatalog, FurnitureInspector } from './panels/FurnitureCatalog'
import { designReducer } from './model/reducer'
import RoomSettings from './panels/RoomSettings'
import WallPanel from './panels/WallPanel'
import WallEditor from './wall/WallEditor'
import DesignerScene from './scene/DesignerScene'
import { hasWebGL } from './webgl'

function NoWebGL() {
  return (
    <div role="alert" className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <Box aria-hidden="true" className="mx-auto h-10 w-10 text-sage-dark" />
        <p className="mt-3 font-display text-2xl font-semibold">3D isn't available in this browser</p>
        <p className="mt-2 text-sm text-muted">
          The designer needs WebGL. Turn on hardware acceleration in your browser settings, update your graphics driver,
          or try a recent Chrome, Edge, Firefox or Safari. Your room settings still work.
        </p>
      </div>
    </div>
  )
}

/** Full-screen 3D designer layered over the results page. Loaded lazily so the rest of the app stays fast. */
export default function RoomDesigner({ form, photo, photoUrl, onClose }) {
  const reduced = usePrefersReducedMotion()
  const [design, dispatch] = useReducer(designReducer, { form, photoName: photo?.name }, createDesign)
  const [webgl] = useState(hasWebGL)
  const [viewKey, setViewKey] = useState(0)
  const [activeWall, setActiveWall] = useState(null)
  const [selected, setSelected] = useState(null)
  const [focus, setFocus] = useState(null) // { position, radius, key } — a camera focus request
  const { catalog, error: catalogError } = useStudioCatalog()
  const budget = useBudget(design)
  const headingRef = useRef(null)

  const size = roomSize(design)
  const warnings = floorWarnings(design)
  const warned = new Set(warnings.flatMap((w) => w.ids))
  const selectedItem = selected ? findPlaced(design, selected)?.item : null
  const styleName = styleLabel(design.style, STYLES.find((s) => s.id === design.style)?.name)

  // Modal behaviour: the page underneath is inert and doesn't scroll; focus starts on the heading.
  useEffect(() => {
    const root = document.getElementById('root')
    const overflow = document.body.style.overflow
    if (root) root.inert = true
    document.body.style.overflow = 'hidden'
    headingRef.current?.focus()
    return () => {
      if (root) root.inert = false
      document.body.style.overflow = overflow
      document.body.style.cursor = ''
    }
  }, [])

  const openWall = (wall) => {
    setActiveWall(wall)
    setSelected(null)
  }
  const selectItem = (item) => {
    setActiveWall(item.wall)
    setSelected(item.uid)
  }
  const addFloorItem = (catalogId) => {
    const uid = newUid()
    dispatch({ type: 'addFloorItem', uid, catalogId })
    setSelected(uid)
  }
  const duplicateSelected = () => {
    if (!selectedItem) return
    const uid = newUid()
    dispatch({ type: 'duplicatePlaced', uid: selectedItem.uid, newUid: uid })
    setSelected(uid)
  }
  const deleteSelected = () => {
    if (!selectedItem) return
    dispatch({ type: 'removePlaced', uid: selectedItem.uid })
    setSelected(null)
  }
  // A cost row: select that object and bring it into view, staying in the 3D view.
  const focusItem = (uid) => {
    const found = findPlaced(design, uid)
    if (!found) return
    setActiveWall(null)
    setSelected(uid)
    setFocus((f) => ({ ...itemWorldCenter(design, found.item), key: (f?.key || 0) + 1 }))
  }
  // A suggestion is only added when the user asks; it arrives with its product already chosen.
  const addSuggestion = ({ type, product }) => {
    const uid = newUid()
    if (wallItemSpec(type)) dispatch({ type: 'addWallItem', uid, wall: activeWall || 'back', catalogId: type, productId: product.product_id })
    else dispatch({ type: 'addFloorItem', uid, catalogId: type, productId: product.product_id })
    setSelected(uid)
  }
  const addWallItem = (catalogId) => {
    const uid = newUid()
    dispatch({ type: 'addWallItem', uid, wall: activeWall, catalogId })
    setSelected(uid)
  }

  // Keyboard: Esc deselects (then leaves the wall), Delete removes, arrows nudge (Shift for 1 ft),
  // R turns (Shift+R the other way), Ctrl/Cmd+D duplicates.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName))) return
      const item = selected ? findPlaced(design, selected)?.item : null
      if (e.key === 'Escape') {
        if (selected) setSelected(null)
        else if (activeWall) setActiveWall(null)
        return
      }
      if (!item) return
      const uid = item.uid
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        dispatch({ type: 'removePlaced', uid })
        setSelected(null)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        const copy = newUid()
        dispatch({ type: 'duplicatePlaced', uid, newUid: copy })
        setSelected(copy)
        return
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        dispatch({ type: 'updatePlaced', uid, changes: { rotation: item.rotation + (e.shiftKey ? -ROTATE_STEP : ROTATE_STEP) } })
        return
      }
      const step = e.shiftKey ? 1 : GRID
      const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]
      if (!nudge) return
      e.preventDefault()
      // On a wall, up is up; on the floor, up moves towards the back wall.
      const changes = item.wall ? { x: item.x + nudge[0], y: item.y + nudge[1] } : { x: item.x + nudge[0], z: item.z - nudge[1] }
      dispatch({ type: 'updatePlaced', uid, changes })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [design, selected, activeWall])

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="designer-heading" className="fixed inset-0 z-[60] flex flex-col bg-cream text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 id="designer-heading" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold leading-tight focus:outline-none">
            3D Room Designer
          </h2>
          <p className="truncate text-xs text-muted">
            {styleName} · Budget {formatINR(design.budget)} · Build your dream room. Place every item yourself.
          </p>
        </div>
        <div className="hidden sm:block" aria-hidden={!budget.data}>
          <BudgetMeter data={budget.data} compact />
        </div>
        <Button variant="secondary" onClick={onClose}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to results
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(16rem,55vh)_1fr] lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-1">
        <div className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
          {activeWall && (
            <div className="min-h-0 flex-[3]">
              <WallEditor
                design={design}
                wallId={activeWall}
                selected={selected}
                onSelect={setSelected}
                dispatch={dispatch}
                onDone={() => openWall(null)}
                newUid={newUid}
              />
            </div>
          )}
          {/* The canvas stays mounted while a wall is open; on small screens the wall editor replaces it. */}
          <div className={`relative min-h-0 ${activeWall ? 'hidden flex-[2] border-t border-line lg:block' : 'flex-1'}`}>
          {webgl ? (
            <>
              <DesignerScene
                design={design}
                size={size}
                viewKey={viewKey}
                focus={focus}
                reduced={reduced}
                activeWall={activeWall}
                selected={selected}
                warned={warned}
                onSelectWall={openWall}
                onSelectItem={selectItem}
                onDeselect={() => setSelected(null)}
                dispatch={dispatch}
                label={`3D view of a ${size.width} by ${size.length} foot room, ${size.height} feet high`}
              />
              <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between gap-2">
                <p className="pointer-events-auto rounded-2xl bg-white/90 px-3 py-1.5 text-[11px] leading-snug text-muted shadow-sm sm:text-xs">
                  Click a wall to decorate it · Drag furniture to move it · Drag the room to orbit · Scroll or pinch to zoom · Right-drag or two fingers to pan
                </p>
                <button
                  type="button"
                  onClick={() => setViewKey((k) => k + 1)}
                  className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-white"
                >
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" /> Reset view
                </button>
              </div>
              {warnings.length > 0 && (
                <ul aria-live="polite" className="absolute bottom-3 left-3 right-3 max-h-28 space-y-0.5 overflow-y-auto rounded-xl bg-white/95 px-3 py-2 text-xs shadow-sm sm:right-auto sm:max-w-md">
                  {warnings.map((w) => (
                    <li key={`${w.kind}-${w.ids.join('-')}`} className={`flex items-center gap-1.5 ${w.kind === 'overlap' || w.kind === 'too-big' ? 'text-red-700' : 'text-clay'}`}>
                      <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <NoWebGL />
          )}
          </div>
        </div>
        <aside aria-label={activeWall ? 'Wall tools' : 'Room settings'} className="min-h-0 overflow-y-auto p-5">
          <div className="mb-6">
            <BudgetPanel
              design={design}
              dispatch={dispatch}
              budget={budget}
              selected={selected}
              onSelectLine={focusItem}
              onAddSuggestion={addSuggestion}
              defaultOpen={false}
            />
          </div>
          {activeWall ? (
            <WallPanel design={design} wallId={activeWall} selected={selected} dispatch={dispatch} onAdd={addWallItem} catalog={catalog} catalogError={catalogError} />
          ) : (
            <>
              {selectedItem && !selectedItem.wall && (
                <div className="mb-6">
                  <FurnitureInspector item={selectedItem} dispatch={dispatch} onDuplicate={duplicateSelected} onDelete={deleteSelected} onDeselect={() => setSelected(null)} catalog={catalog} catalogError={catalogError} />
                </div>
              )}
              <section aria-labelledby="walls-heading" className="mb-6">
                <div className="flex items-center gap-2">
                  <PaintRoller aria-hidden="true" className="h-4 w-4 text-sage-dark" />
                  <h3 id="walls-heading" className="font-display text-xl font-semibold">Decorate a wall</h3>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {WALLS.map((w) => {
                    const count = onWall(design, w).length
                    return (
                      <button key={w} type="button" onClick={() => openWall(w)} className="rounded-xl border border-line bg-white px-3 py-2 text-left text-sm font-medium hover:border-sage hover:bg-sand/50">
                        {WALL_LABELS[w]}
                        <span className="block text-[11px] font-normal text-muted">{count ? `${count} item${count > 1 ? 's' : ''}` : 'Empty'}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
              <div className="mb-6 border-b border-line pb-6"><FurnitureCatalog onAdd={addFloorItem} catalog={catalog} /></div>
              <RoomSettings design={design} dispatch={dispatch} photoUrl={photoUrl} />
            </>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  )
}
