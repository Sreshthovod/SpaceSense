import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { FLOOR_MATERIALS, WALL_THICKNESS, isBehindWall, onWall, wallSpecs } from '../model/design'
import WallItemMesh from './WallItemMesh'
import { WALLPAPERS, floorRoughness, textureRepeat, wallRoughness } from '../model/finishes'
import { makeFloorTexture, makeWallpaper } from './textures'

const HIDDEN_LAYER = 31

/**
 * A wall and everything attached to it, in the wall's local space (origin on the inner face at floor
 * level, centred along the wall; +z points into the room).
 */
/** Frees a texture's GPU memory when it's replaced or the scene closes. */
function useDisposeTexture(texture) {
  useEffect(() => () => texture?.dispose(), [texture])
}

function Wall({ spec, finish, items, active, selected, onSelectWall, onSelectItem }) {
  const { color, kind, pattern, sheen } = finish
  const paper = kind === 'wallpaper' && WALLPAPERS[pattern]
  const texture = useMemo(() => {
    if (!paper) return null
    const t = makeWallpaper(pattern, color)
    // The box's inner face spans the wall plus both corners; repeat so one pattern tile is tileFt.
    t.repeat.set(textureRepeat(spec.span + WALL_THICKNESS * 2, paper.tileFt), textureRepeat(spec.height, paper.tileFt))
    return t
  }, [paper, pattern, color, spec.span, spec.height])
  useDisposeTexture(texture)
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
        <meshStandardMaterial
          key={texture ? texture.uuid : 'paint'}
          color={texture ? '#ffffff' : color}
          map={texture}
          roughness={wallRoughness(sheen)}
          emissive="#78836a"
          emissiveIntensity={highlight}
        />
      </mesh>
      {items.filter((item) => !item.hidden).map((item) => (
        <WallItemMesh key={item.uid} item={item} span={spec.span} selected={item.uid === selected} onSelect={onSelectItem} />
      ))}
    </group>
  )
}

export default function Room({ size, design, activeWall, selected, onSelectWall, onSelectItem, onDeselect }) {
  const specs = wallSpecs(size)
  const { floor } = design
  const material = FLOOR_MATERIALS[floor.material] || FLOOR_MATERIALS.wood
  const floorTexture = useMemo(() => {
    const t = makeFloorTexture(material.pattern, floor.color)
    // Real-world sized repeats, the chosen rotation, and a fixed offset so seams don't line up with walls.
    t.repeat.set(textureRepeat(size.width, material.tileFt, floor.scale), textureRepeat(size.length, material.tileFt, floor.scale))
    t.center.set(0.5, 0.5)
    t.rotation = ((floor.rotation || 0) * Math.PI) / 180
    t.offset.set(0.137, 0.291)
    return t
  }, [material.pattern, material.tileFt, floor.color, floor.scale, floor.rotation, size.width, size.length])
  useDisposeTexture(floorTexture)
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
        <meshStandardMaterial key={floorTexture.uuid} map={floorTexture} roughness={floorRoughness(material.roughness, floor.sheen)} />
      </mesh>
      {specs.map((spec) => (
        <Wall
          key={spec.id}
          spec={spec}
          finish={design.walls[spec.id]}
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
