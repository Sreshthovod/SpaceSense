import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { FLOOR_MATERIALS, WALL_THICKNESS, isBehindWall, onWall, wallSpecs } from '../model/design'
import WallItemMesh from './WallItemMesh'

const HIDDEN_LAYER = 31

/**
 * A wall and everything attached to it, in the wall's local space (origin on the inner face at floor
 * level, centred along the wall; +z points into the room).
 */
function Wall({ spec, color, items, active, selected, onSelectWall, onSelectItem }) {
  const ref = useRef(null)
  const cutAway = useRef(false)
  const [hovered, setHovered] = useState(false)
  // Cut-away view: a wall (and its items) standing between the camera and the room moves to a layer
  // the camera doesn't render and the pointer raycaster doesn't test, so it can't be seen OR clicked.
  // (Raycasting ignores `visible`, so hiding alone would let an invisible wall swallow clicks.)
  useFrame(({ camera }) => {
    const hide = isBehindWall(spec, camera.position.toArray())
    if (!ref.current || (!hide && !cutAway.current)) return
    // While hidden, re-apply every frame so items added to this wall are hidden too (a few objects).
    ref.current.traverse((o) => o.layers.set(hide ? HIDDEN_LAYER : 0))
    if (hide !== cutAway.current) {
      cutAway.current = hide
      if (hide && hovered) {
        setHovered(false)
        document.body.style.cursor = ''
      }
    }
  })
  const [x, , z] = spec.center
  const highlight = active ? 0.18 : hovered ? 0.08 : 0
  return (
    <group ref={ref} position={[x, 0, z]} rotation={[0, spec.rotationY, 0]} name={`wall-${spec.id}`}>
      <mesh
        position={[0, spec.height / 2, -WALL_THICKNESS / 2]}
        receiveShadow
        onClick={(e) => {
          if (e.delta > 4) return // an orbit drag, not a click
          e.stopPropagation()
          onSelectWall(spec.id)
        }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = '' }}
      >
        <boxGeometry args={[spec.span + WALL_THICKNESS * 2, spec.height, WALL_THICKNESS]} />
        <meshStandardMaterial color={color} roughness={0.9} emissive="#78836a" emissiveIntensity={highlight} />
      </mesh>
      {items.filter((item) => !item.hidden).map((item) => (
        <WallItemMesh key={item.uid} item={item} span={spec.span} selected={item.uid === selected} onSelect={onSelectItem} />
      ))}
    </group>
  )
}

export default function Room({ size, design, activeWall, selected, onSelectWall, onSelectItem, onDeselect }) {
  const specs = wallSpecs(size)
  const material = FLOOR_MATERIALS[design.floor.material]
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        name="floor"
        onClick={(e) => {
          if (e.delta > 4) return
          e.stopPropagation()
          onDeselect()
        }}
      >
        <planeGeometry args={[size.width, size.length]} />
        <meshStandardMaterial color={design.floor.color} roughness={material.roughness} />
      </mesh>
      {specs.map((spec) => (
        <Wall
          key={spec.id}
          spec={spec}
          color={design.walls[spec.id].color}
          items={onWall(design, spec.id)}
          active={activeWall === spec.id}
          selected={selected}
          onSelectWall={onSelectWall}
          onSelectItem={onSelectItem}
        />
      ))}
    </group>
  )
}
