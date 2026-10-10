import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Box, History, PaintRoller, Redo2, TriangleAlert, Undo2 } from 'lucide-react'
import { STYLES } from '../data/sampleData'
import { formatINR } from '../utils/format'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import Button from '../components/ui/Button'
import { WALLS, WALL_LABELS, createDesign, findPlaced, onWall, roomSize, styleLabel } from './model/design'
import { newUid } from './model/ids'
import { floorWarnings, itemWorldCenter } from './model/floorPlacement'
import { wallItemSpec } from './model/catalog'
import useBudget from './hooks/useBudget'
import useStudioCatalog from './hooks/useStudioCatalog'
import BudgetPanel, { BudgetMeter } from './panels/BudgetPanel'
import { FurnitureCatalog, FurnitureInspector } from './panels/FurnitureCatalog'
import { readDraft, saveLastCleared } from './model/storage'
import useDesignStore from './hooks/useDesignStore'
import useDesignerKeys from './hooks/useDesignerKeys'
import DesignsMenu from './layout/DesignsMenu'
import ViewportToolbar from './layout/ViewportToolbar'
import useGestureSetting from './hooks/useGestureSetting'
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

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function RecoveryBanner({ draft, onRecover, onFresh, onDismiss }) {
  if (draft.error) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 border-b border-line bg-[#fbefe9] px-4 py-2 text-xs sm:px-6">
        <span className="flex-1">Your last session couldn't be recovered: {draft.error}</span>
        <button type="button" onClick={onDismiss} className="rounded-full border border-line bg-white px-3 py-1 font-semibold">OK</button>
      </div>
    )
  }
  const count = draft.design.items.length + draft.design.openings.length
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-line bg-sand px-4 py-2 text-xs sm:px-6">
      <History aria-hidden="true" className="h-4 w-4 text-sage-dark" />
      <span className="flex-1">
        Recover your last session{draft.name ? ` (“${draft.name}”)` : ''} from {when(draft.savedAt)}? It has {count} item{count === 1 ? '' : 's'}.
      </span>
      <button type="button" onClick={onRecover} className="rounded-full bg-ink px-3 py-1 font-semibold text-cream">Recover</button>
      <button type="button" onClick={onFresh} className="rounded-full border border-line bg-white px-3 py-1 font-semibold">Start fresh</button>
    </div>
  )
}

/**
 * Full-screen 3D designer. Opened from the results page (with the room's brief and photo) or from
 * the landing page (demo room). Loaded lazily so the rest of the app stays fast.
 */
export default function RoomDesigner({ form = {}, photo, photoUrl, onClose, closeLabel = 'Back to results' }) {
  const reduced = usePrefersReducedMotion()
  const [current, setCurrent] = useState({ id: null, name: null }) // the named design being edited, if any
  const meta = useMemo(() => ({ designId: current.id, name: current.name }), [current])
  const [initialDesign] = useState(() => createDesign({ form, photoName: photo?.name }))
  const { design, dispatch, undo, redo, clearHistory, canUndo, canRedo, saveStatus } = useDesignStore(initialDesign, meta)
  const [draft, setDraft] = useState(() => readDraft()) // the previous session, offered for recovery
  const [dialogOpen, setDialogOpen] = useState(false)
  const [webgl] = useState(hasWebGL)
  const [view, setView] = useState('3d') // '3d' | 'plan'
  const [mode, setMode] = useState('select') // navigate | select | move | rotate
  const [snap, setSnap] = useState(true)
  const [gesture, setGesture] = useGestureSetting()
  const [command, setCommand] = useState(null) // a camera request: { kind, ..., key }
  const [activeWall, setActiveWall] = useState(null)
  const [selected, setSelected] = useState(null)
  const { catalog, error: catalogError } = useStudioCatalog()
  const budget = useBudget(design)
  const headingRef = useRef(null)

  const size = roomSize(design)
  const warnings = floorWarnings(design)
  const warned = new Set(warnings.flatMap((w) => w.ids))
  const selectedItem = selected ? findPlaced(design, selected)?.item : null
  const styleName = styleLabel(design.style, STYLES.find((s) => s.id === design.style)?.name)
  const suggestedName = `${form.roomType || 'Room'} — ${styleName.replace(/ \(.*\)$/, '')}`

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
  const camera = (request) => setCommand((c) => ({ ...request, key: (c?.key || 0) + 1 }))
  // Select an object and bring it into view (cost rows, double-click, F), staying in the main view.
  const focusItem = (uid) => {
    const found = findPlaced(design, uid)
    if (!found) return
    setActiveWall(null)
    setSelected(uid)
    camera({ kind: 'focus', ...itemWorldCenter(design, found.item) })
  }
  const cameraRequest = (request) => {
    if (request.kind === 'focus') {
      if (selected) focusItem(selected)
      return
    }
    camera(request)
  }
  // A suggestion is only added when the user asks; it arrives with its product already chosen.
  const addSuggestion = ({ type, product }) => {
    const uid = newUid()
    if (wallItemSpec(type)) dispatch({ type: 'addWallItem', uid, wall: activeWall || 'back', catalogId: type, productId: product.product_id })
    else dispatch({ type: 'addFloorItem', uid, catalogId: type, productId: product.product_id })
    setSelected(uid)
  }
  // Loading or resetting is an ordinary, undoable edit.
  const loadDesignIntoEditor = (next, entry) => {
    dispatch({ type: 'replaceDesign', design: next })
    setSelected(null)
    setActiveWall(null)
    if (entry) setCurrent({ id: entry.id, name: entry.name })
  }
  const resetDesign = () => {
    saveLastCleared(design) // may throw if storage is unavailable; the menu reports it
    const fresh = createDesign({ form })
    dispatch({ type: 'replaceDesign', design: { ...fresh, room: design.room, budget: design.budget, style: design.style, photo: design.photo } })
    setSelected(null)
    setActiveWall(null)
  }
  const recover = () => {
    dispatch({ type: 'replaceDesign', design: draft.design })
    clearHistory()
    setCurrent({ id: draft.designId || null, name: draft.name || null })
    setDraft(null)
  }
  const startFresh = () => {
    try { saveLastCleared(draft.design) } catch { /* the draft is simply replaced */ }
    setDraft(null)
  }
  const onDialog = useCallback((open) => setDialogOpen(open), [])

  const addWallItem = (catalogId) => {
    const uid = newUid()
    dispatch({ type: 'addWallItem', uid, wall: activeWall, catalogId })
    setSelected(uid)
  }

  useDesignerKeys({
    design, selected, activeWall, dispatch, undo, redo, setSelected, setActiveWall, setMode, blocked: dialogOpen,
    onFocus: () => (selected ? focusItem(selected) : camera({ kind: 'fit' })),
  })

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="designer-heading" className="fixed inset-0 z-[60] flex flex-col bg-cream text-ink">
      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 id="designer-heading" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold leading-tight focus:outline-none focus-visible:outline-none">
            3D Room Designer
          </h2>
          <p className="truncate text-xs text-muted">
            {styleName} · Budget {formatINR(design.budget)} · Build your dream room. Place every item yourself.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-white">
            <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" aria-keyshortcuts="Control+Z Meta+Z" className="rounded-l-full px-2.5 py-1.5 hover:bg-sand disabled:opacity-35">
              <Undo2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" className="rounded-r-full border-l border-line px-2.5 py-1.5 hover:bg-sand disabled:opacity-35">
              <Redo2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <DesignsMenu
            design={design}
            current={current}
            setCurrent={setCurrent}
            suggestedName={suggestedName}
            saveStatus={saveStatus}
            onLoad={loadDesignIntoEditor}
            onReset={resetDesign}
            onDialog={onDialog}
          />
          <div className="hidden md:block" aria-hidden={!budget.data}>
            <BudgetMeter data={budget.data} compact />
          </div>
          <Button variant="secondary" onClick={onClose}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {closeLabel}
          </Button>
        </div>
      </header>
      {draft && <RecoveryBanner draft={draft} onRecover={recover} onFresh={startFresh} onDismiss={() => setDraft(null)} />}

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
                snap={snap}
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
                view={view}
                mode={mode}
                snap={snap}
                command={command}
                wheelSetting={gesture}
                onFocusItem={(item) => focusItem(item.uid)}
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
              <ViewportToolbar
                mode={mode}
                setMode={setMode}
                snap={snap}
                setSnap={setSnap}
                view={view}
                setView={setView}
                onCamera={cameraRequest}
                canFocus={Boolean(selected)}
                gesture={gesture}
                setGesture={setGesture}
              />
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
              <RoomSettings design={design} dispatch={dispatch} photoUrl={photo && design.photo?.name === photo.name ? photoUrl : null} />
            </>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  )
}
