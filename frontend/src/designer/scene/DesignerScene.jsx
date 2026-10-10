import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import CameraRig from './CameraRig'
import FloorItems from './FloorItems'
import PlanOverlay from './PlanOverlay'
import Room from './Room'
import { ResourcesProvider } from './resources'

/**
 * The 3D view. Kept light for a 4 GB laptop GPU: renders only when something changes, pixel ratio
 * capped at 1.5, one shadow-casting light with a 1024px shadow map, flat materials and no textures.
 * `flat` turns off tone mapping so painted walls match the swatch the user picked.
 */
const noop = () => {}

export default function DesignerScene({
  design, size, view = '3d', mode = 'select', snap = true, command, wheelSetting, reduced, label, activeWall, selected, warned,
  onSelectWall, onSelectItem, onDeselect, onFocusItem, dispatch,
}) {
  // In Navigate mode clicks never select anything; the camera gets every gesture.
  const navigate = mode === 'navigate'
  const controls = useRef(null)
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
      flat
      dpr={[1, 1.5]}
      camera={{ fov: 45, near: 0.1, far: reach * 12 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label={label}
      role="img"
    >
      <color attach="background" args={['#f7f5f0']} />
      <hemisphereLight args={['#fffaf2', '#cbbda6', 1.5]} />
      <ambientLight intensity={0.6} />
      {/* Sun from the front-right, so the back and left walls the default view faces are lit. */}
      <directionalLight
        position={[size.width * 1.1, size.height * 2.2, size.length * 1.3]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-far={reach * 6}
        shadow-bias={-0.0005}
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
          mode={mode}
          snap={snap}
          selected={selected}
          warned={warned}
          setOrbitEnabled={setOrbitEnabled}
          onSelect={onSelectItem}
          onFocus={onFocusItem || noop}
          dispatch={dispatch}
        />
        {view === 'plan' && <PlanOverlay design={design} size={size} selected={selected} warned={warned} />}
      </ResourcesProvider>
      <CameraRig room={size} view={view} command={command} reduced={reduced} wheelSetting={wheelSetting} controlsRef={controls} />
    </Canvas>
  )
}
