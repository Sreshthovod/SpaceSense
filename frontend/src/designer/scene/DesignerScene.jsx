import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import CameraRig from './CameraRig'
import FloorItems from './FloorItems'
import PerfProbe from './PerfProbe'
import Shadows from './Shadows'
import PlacementGhost from './PlacementGhost'
import PlanOverlay from './PlanOverlay'
import Room from './Room'
import { ResourcesProvider } from './resources'
import useTheme from '../../hooks/useTheme'

/**
 * The 3D view. Kept light for a 4 GB laptop GPU: renders only when something changes, pixel ratio
 * capped at 1.5, one shadow-casting light with a 1024px shadow map, small procedural textures.
 * Neutral tone mapping (made to keep base colours) with lights calibrated so a front-lit wall shows
 * within about ΔE 5 of the paint swatch the user picked.
 */
const noop = () => {}

// Calibrated with the colour-accuracy browser check (see the designer README section).
const LIGHT = { exposure: 1.35, hemisphere: 1.5, ambient: 0.6, fill: 0.25, sun: 1.4 }

export default function DesignerScene({
  design, size, view = '3d', mode = 'select', snap = true, command, wheelSetting, reduced, label, activeWall, selected, warned,
  onSelectWall, onSelectItem, onDeselect, onFocusItem, dispatch, placing, onPlace, onCancelPlacing, onPerf, onContextLost,
}) {
  // In Navigate mode (and while placing a new piece) clicks never select anything.
  const navigate = mode === 'navigate' || Boolean(placing)
  const dark = useTheme().theme === 'dark'
  const controls = useRef(null)
  const [dragTick, setDragTick] = useState(0) // bumps while a piece is dragged, so its shadow follows
  // Called from pointer handlers, so the camera stops before the drag's first move event.
  const setOrbitEnabled = (on) => {
    if (controls.current) controls.current.enabled = on
  }
  const reach = Math.max(size.width, size.length)
  const shadowExtent = reach * 0.75
  return (
    <Canvas
      frameloop="demand"
      shadows="percentage"
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
        gl.toneMappingExposure = LIGHT.exposure
        // If the GPU resets, say so instead of showing a frozen or blank view.
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onContextLost?.()
        })
      }}
      dpr={[1, 1.5]}
      camera={{ fov: 45, near: 0.1, far: reach * 12 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label={label}
      role="img"
    >
      <color attach="background" args={[dark ? '#161713' : '#f7f5f0']} />
      <hemisphereLight args={['#ffffff', '#e6e1d8', LIGHT.hemisphere]} />
      <ambientLight intensity={LIGHT.ambient} />
      {/* A soft fill from the back-left so walls facing away from the sun don't go flat grey. */}
      <directionalLight position={[-size.width, size.height * 1.5, -size.length]} intensity={LIGHT.fill} />
      {/* Sun from the front-right, so the back and left walls the default view faces are lit. */}
      <directionalLight
        position={[size.width * 1.1, size.height * 2.2, size.length * 1.3]}
        intensity={LIGHT.sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-far={reach * 6}
        shadow-bias={-0.0005}
        shadow-radius={4}
      />
      <ResourcesProvider>
        <Room
          size={size}
          design={design}
          activeWall={activeWall}
          selected={selected}
          onSelectWall={navigate ? noop : onSelectWall}
          onSelectItem={navigate ? noop : onSelectItem}
          onDeselect={navigate ? noop : onDeselect}
        />
        <FloorItems
          design={design}
          size={size}
          mode={placing ? 'navigate' : mode}
          snap={snap}
          selected={selected}
          warned={warned}
          setOrbitEnabled={setOrbitEnabled}
          onSelect={onSelectItem}
          onFocus={onFocusItem || noop}
          dispatch={dispatch}
          onDragFrame={() => setDragTick((t) => t + 1)}
        />
        {placing && <PlacementGhost design={design} size={size} placing={placing} snap={snap} onPlace={onPlace} onCancel={onCancelPlacing} />}
        {view === 'plan' && <PlanOverlay design={design} size={size} selected={selected} warned={warned} />}
      </ResourcesProvider>
      <Shadows design={design} tick={dragTick} />
      {onPerf && <PerfProbe onStats={onPerf} />}
      <CameraRig room={size} view={view} command={command} reduced={reduced} wheelSetting={wheelSetting} controlsRef={controls} />
    </Canvas>
  )
}
