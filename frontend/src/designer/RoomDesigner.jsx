import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft, Box, ChevronLeft, ChevronRight, History, Home, LibraryBig, MousePointerClick, PaintRoller, Redo2, Sofa, SquareDashed,
  TriangleAlert, Undo2, X,
} from 'lucide-react'
import { STYLES } from '../data/sampleData'
import { formatINR } from '../utils/format'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import { WALLS, WALL_LABELS, createDesign, findPlaced, onWall, roomSize, styleLabel } from './model/design'
import { newUid } from './model/ids'
import { floorWarnings, itemWorldCenter } from './model/floorPlacement'
import { floorItemSpec, wallItemSpec } from './model/catalog'
import useBudget from './hooks/useBudget'
import useStudioCatalog from './hooks/useStudioCatalog'
import BudgetPanel, { BudgetMeter } from './panels/BudgetPanel'
import CatalogPanel from './panels/CatalogPanel'
import Inspector from './panels/Inspector'
import ObjectList from './panels/ObjectList'
import useRecent from './hooks/useRecent'
import { readDraft, saveLastCleared } from './model/storage'
import useDesignStore from './hooks/useDesignStore'
import useDesignerKeys from './hooks/useDesignerKeys'
import DesignsMenu from './layout/DesignsMenu'
import ViewportToolbar from './layout/ViewportToolbar'
import Sidebar from './layout/Sidebar'
import OnboardingHint from './layout/OnboardingHint'
import SceneBoundary from './scene/SceneBoundary'
import useTips from './hooks/useTips'
import { FloorFinishPanel, WallFinishPanel } from './panels/FinishPanels'
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
  // ?perf shows live performance numbers over the view.
  const [perfOn] = useState(() => new URLSearchParams(window.location.search).has('perf'))
  const [perf, setPerf] = useState(null)
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
  const [placing, setPlacing] = useState(null) // { catalogId } while a placement preview follows the pointer
  const [tab, setTab] = useState('furniture') // the library sidebar's tab
  const [leftOpen, setLeftOpen] = useState(true) // desktop: sidebar expanded or collapsed to a rail
  const [drawerOpen, setDrawerOpen] = useState(false) // tablet/phone: the sidebar as a slide-over drawer
  const [budgetOpen, setBudgetOpen] = useState(false)
  const tips = useTips()
  const [sceneKey, setSceneKey] = useState(0) // bumped to rebuild the 3D view after a failure
  const [contextLost, setContextLost] = useState(false)
  const [recent, rememberRecent] = useRecent()
  const addFloorItem = (catalogId, at) => {
    const uid = newUid()
    dispatch({ type: 'addFloorItem', uid, catalogId, ...(at || {}) })
    rememberRecent(catalogId)
    setActiveWall(null)
    setSelected(uid)
  }
  // From the catalog: a mouse click starts a placement preview in the 3D/plan view; the keyboard (or
  // a browser without WebGL) adds the piece straight to a free spot.
  const pickFromCatalog = (catalogId, viaKeyboard) => {
    if (viaKeyboard || !webgl) addFloorItem(catalogId)
    else {
      setSelected(null)
      setPlacing({ catalogId })
    }
  }
  const placingRef = useRef(null)
  useEffect(() => { placingRef.current = placing }, [placing])
  const placeAt = useCallback((at) => {
    const p = placingRef.current
    if (!p) return
    placingRef.current = null
    const uid = newUid()
    dispatch({ type: 'addFloorItem', uid, catalogId: p.catalogId, ...at })
    rememberRecent(p.catalogId)
    setSelected(uid)
    setPlacing(null)
  }, [dispatch, rememberRecent])
  const cancelPlacing = useCallback(() => setPlacing(null), [])
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

  const hiddenUids = new Set(design.items.filter((i) => i.hidden).map((i) => i.uid))
  const rightPanel = budgetOpen || activeWall || (selectedItem && !selectedItem.wall)
  const closeDrawerOnPick = (fn) => (...args) => {
    setDrawerOpen(false)
    fn(...args)
  }

  const libraryTabs = [
    {
      id: 'furniture',
      label: 'Furniture',
      icon: Sofa,
      content: (
        <CatalogPanel
          catalog={catalog}
          recent={recent}
          onPick={closeDrawerOnPick(pickFromCatalog)}
          placingName={placing ? floorItemSpec(placing.catalogId)?.name.toLowerCase() : null}
          onCancelPlacing={cancelPlacing}
        />
      ),
    },
    {
      id: 'walls',
      label: 'Walls',
      icon: PaintRoller,
      content: (
        <div className="space-y-5">
          <section aria-labelledby="walls-heading">
            <h3 id="walls-heading" className="font-display text-xl font-semibold">Decorate a wall</h3>
            <p className="mt-1 text-xs text-muted">Open a wall to add art, mirrors, shelves, doors and windows, or to give it its own finish.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {WALLS.map((w) => {
                const count = onWall(design, w).length
                return (
                  <button key={w} type="button" onClick={closeDrawerOnPick(() => openWall(w))} className="rounded-xl border border-line bg-white px-3 py-2 text-left text-sm font-medium hover:border-sage hover:bg-sand/50">
                    {WALL_LABELS[w]}
                    <span className="block text-[11px] font-normal text-muted">{count ? `${count} item${count > 1 ? 's' : ''}` : 'Empty'}</span>
                  </button>
                )
              })}
            </div>
          </section>
          <section aria-labelledby="walls-finish-heading" className="space-y-3 border-t border-line pt-4">
            <h3 id="walls-finish-heading" className="font-display text-xl font-semibold">All walls</h3>
            <WallFinishPanel walls={design.walls} wall="all" dispatch={dispatch} />
          </section>
        </div>
      ),
    },
    {
      id: 'floor',
      label: 'Floor',
      icon: SquareDashed,
      content: (
        <section aria-labelledby="floor-finish-heading" className="space-y-3">
          <h3 id="floor-finish-heading" className="font-display text-xl font-semibold">Floor</h3>
          <FloorFinishPanel floor={design.floor} dispatch={dispatch} />
        </section>
      ),
    },
    {
      id: 'room',
      label: 'Room',
      icon: Home,
      content: (
        <div className="space-y-5">
          <ObjectList design={design} selected={selected} onSelect={closeDrawerOnPick((item) => (item.wall ? selectItem(item) : focusItem(item.uid)))} dispatch={dispatch} />
          <RoomSettings design={design} dispatch={dispatch} photoUrl={photo && design.photo?.name === photo.name ? photoUrl : null} />
        </div>
      ),
    },
  ]

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="designer-heading" className="fixed inset-0 z-[60] flex flex-col bg-cream text-ink">
      <header className="relative flex items-center justify-between gap-1.5 border-b border-line bg-cream px-2 py-1.5 sm:flex-wrap sm:gap-2 sm:px-4 sm:py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open the design library"
            aria-expanded={drawerOpen}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-sand lg:hidden"
          >
            <LibraryBig aria-hidden="true" className="h-4 w-4" /> <span className="hidden sm:inline">Library</span>
          </button>
          <div className="min-w-0">
            <h2 id="designer-heading" ref={headingRef} tabIndex={-1} className="sr-only font-display text-xl font-semibold leading-tight focus:outline-none focus-visible:outline-none sm:not-sr-only sm:text-2xl">
              3D Room Designer
            </h2>
            <p className="hidden truncate text-xs text-muted md:block">
              {styleName} · Build your dream room. Place every item yourself.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2">
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
          <button
            type="button"
            onClick={() => setBudgetOpen((o) => !o)}
            aria-expanded={budgetOpen}
            aria-label={`Budget: ${budget.data ? `${formatINR(budget.data.total_inr)} of ${formatINR(budget.data.budget_inr)}` : formatINR(design.budget)}`}
            className={`max-w-[6.5rem] rounded-full border px-2.5 py-1.5 text-left hover:bg-sand sm:max-w-none sm:px-3 ${budgetOpen ? 'border-ink bg-white' : 'border-line bg-white'}`}
          >
            {budget.data ? <BudgetMeter data={budget.data} compact /> : <span className="whitespace-nowrap text-[11px] font-semibold sm:text-xs">{formatINR(design.budget)}</span>}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white p-2 text-sm font-semibold hover:bg-sand sm:px-4 sm:py-2.5"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> <span className="hidden sm:inline">{closeLabel}</span>
          </button>
        </div>
      </header>
      {draft && <RecoveryBanner draft={draft} onRecover={recover} onFresh={startFresh} onDismiss={() => setDraft(null)} />}

      <div className="relative flex min-h-0 flex-1">
        {/* Library: a collapsible column on desktop, a slide-over drawer on smaller screens. */}
        {drawerOpen && <div aria-hidden="true" className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setDrawerOpen(false)} />}
        <aside
          aria-label="Design library"
          className={`${drawerOpen ? 'fixed inset-y-0 left-0 z-40 flex w-[min(22rem,88vw)] shadow-xl' : 'hidden'} flex-col border-r border-line bg-cream lg:static lg:z-auto lg:flex lg:shadow-none ${leftOpen ? 'lg:w-80' : 'lg:w-0 lg:overflow-hidden lg:border-r-0'}`}
        >
          <div className="flex items-center justify-end px-2 pt-2 lg:hidden">
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close the design library" className="rounded-full p-1.5 hover:bg-sand">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <Sidebar tabs={libraryTabs} tab={tab} setTab={setTab} />
        </aside>

        <section aria-label="Room view" className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <button
            type="button"
            onClick={() => setLeftOpen((o) => !o)}
            aria-label={leftOpen ? 'Collapse the design library' : 'Expand the design library'}
            aria-expanded={leftOpen}
            className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-r-lg border border-l-0 border-line bg-white py-3 pl-0.5 pr-1 shadow-sm hover:bg-sand lg:block"
          >
            {leftOpen ? <ChevronLeft aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
          </button>
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
              <SceneBoundary lost={contextLost} onReload={() => { setContextLost(false); setSceneKey((k) => k + 1) }}>
              <DesignerScene
                key={sceneKey}
                onContextLost={() => setContextLost(true)}
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
                placing={placing}
                onPlace={placeAt}
                onCancelPlacing={cancelPlacing}
                onPerf={perfOn ? setPerf : undefined}
                label={`3D view of a ${size.width} by ${size.length} foot room, ${size.height} feet high`}
              />
              </SceneBoundary>
              {tips.show && !contextLost && <OnboardingHint onClose={tips.dismiss} />}
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
                onShowTips={tips.reopen}
              />
              {perfOn && perf && (
                <p className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-ink/80 px-2 py-1 font-mono text-[10px] text-cream" data-testid="perf">
                  {perf.fps} fps · {perf.calls} draws · {(perf.triangles / 1000).toFixed(1)}k tris · {perf.geometries} geo · {perf.textures} tex
                </p>
              )}
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
        </section>

        {/* Inspector: an always-present column on desktop (so selecting never resizes the 3D view),
            a bottom sheet on smaller screens that only appears when there's something to show. */}
        <aside
          aria-label={activeWall ? 'Wall tools' : budgetOpen && !selectedItem ? 'Budget' : 'Inspector'}
          className={`${rightPanel ? 'fixed' : 'hidden'} inset-x-0 bottom-0 z-30 max-h-[55vh] overflow-y-auto rounded-t-2xl border-t border-line bg-cream p-4 shadow-[0_-8px_24px_rgba(36,38,32,0.12)] lg:static lg:z-auto lg:block lg:max-h-none lg:w-80 lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none`}
        >
            {!rightPanel && (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center text-sm text-muted">
                <MousePointerClick aria-hidden="true" className="h-6 w-6 text-sage-dark" />
                <p className="mt-2">Select a piece to edit it, or open a wall from the Walls tab.</p>
              </div>
            )}
            {budgetOpen && (
              <div className="mb-4">
                <BudgetPanel
                  design={design}
                  dispatch={dispatch}
                  budget={budget}
                  selected={selected}
                  onSelectLine={focusItem}
                  onAddSuggestion={addSuggestion}
                  hidden={hiddenUids}
                />
              </div>
            )}
            {activeWall ? (
              <WallPanel design={design} wallId={activeWall} selected={selected} dispatch={dispatch} onAdd={addWallItem} catalog={catalog} catalogError={catalogError} />
            ) : selectedItem && !selectedItem.wall ? (
              <Inspector item={selectedItem} design={design} mode={mode} dispatch={dispatch} onDuplicate={duplicateSelected} onDelete={deleteSelected} onDeselect={() => setSelected(null)} catalog={catalog} catalogError={catalogError} />
            ) : null}
        </aside>
      </div>
    </div>,
    document.body,
  )
}
