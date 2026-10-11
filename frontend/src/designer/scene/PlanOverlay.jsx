import { useEffect, useMemo } from 'react'
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, LineBasicMaterial, SRGBColorSpace } from 'three'
import { WALL_THICKNESS } from '../model/design'
import { footprintOutline } from '../model/floorPlacement'
import { formatFeet } from '../model/wallPlacement'
import useTheme from '../../hooks/useTheme'
import { SHORT, wallDirections } from '../model/compass'

const TOP = 60 // above any furniture; drawn without depth testing so it's always visible

function gridGeometry(width, length) {
  const minor = []
  const major = []
  const hw = width / 2
  const hl = length / 2
  for (let x = Math.ceil(-hw); x <= hw; x++) (x % 5 === 0 ? major : minor).push(x, TOP, -hl, x, TOP, hl)
  for (let z = Math.ceil(-hl); z <= hl; z++) (z % 5 === 0 ? major : minor).push(-hw, TOP, z, hw, TOP, z)
  const make = (pts) => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pts, 3))
    return g
  }
  return { minor: make(minor), major: make(major) }
}

/** A text label drawn into a small texture, laid flat and facing up for the plan camera. */
function Label({ text, position, rotation = 0, color }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = color
      // Shrink long labels (a length plus a compass side) to fit the texture.
      let px = 36
      ctx.font = `600 ${px}px Inter, system-ui, sans-serif`
      while (px > 20 && ctx.measureText?.(text).width > 244) {
        px -= 2
        ctx.font = `600 ${px}px Inter, system-ui, sans-serif`
      }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 128, 34)
    }
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [text, color])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]} renderOrder={12}>
      <planeGeometry args={[2.4, 0.6]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} />
    </mesh>
  )
}

function Outline({ points, color }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(points.flatMap(([x, z]) => [x, TOP + 0.5, z]), 3))
    return g
  }, [points])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineLoop geometry={geometry} renderOrder={11}>
      <lineBasicMaterial color={color} depthTest={false} />
    </lineLoop>
  )
}

/**
 * Floor-plan drawing over the top-down view: a 1 ft grid with 5 ft lines, the room outline, the
 * length of each wall, and an outline of every piece of furniture so it's easy to pick.
 */
// Wall-length labels and the outer wall line sit outside the room, on the page background.
const EDGE = { light: { label: '#5c5f55', outer: '#5c5f55' }, dark: { label: '#c9c6bb', outer: '#8a8d80' } }

export default function PlanOverlay({ design, size, selected, warned }) {
  const edge = EDGE[useTheme().theme]
  // With the room's direction set, each wall label also says which compass side it is on.
  const sides = wallDirections(design.facing)
  const label = (feet, wall) => (sides ? `${formatFeet(feet)} · ${SHORT[sides[wall]]}` : formatFeet(feet))
  const grid = useMemo(() => gridGeometry(size.width, size.length), [size.width, size.length])
  const materials = useMemo(() => ({
    minor: new LineBasicMaterial({ color: '#242620', transparent: true, opacity: 0.08, depthTest: false }),
    major: new LineBasicMaterial({ color: '#242620', transparent: true, opacity: 0.22, depthTest: false }),
  }), [])
  useEffect(() => () => { grid.minor.dispose(); grid.major.dispose() }, [grid])
  useEffect(() => () => { materials.minor.dispose(); materials.major.dispose() }, [materials])

  const hw = size.width / 2
  const hl = size.length / 2
  const t = WALL_THICKNESS
  const room = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]]
  const outer = [[-hw - t, -hl - t], [hw + t, -hl - t], [hw + t, hl + t], [-hw - t, hl + t]]
  return (
    <group name="plan-overlay">
      <lineSegments geometry={grid.minor} material={materials.minor} renderOrder={10} />
      <lineSegments geometry={grid.major} material={materials.major} renderOrder={10} />
      <Outline points={room} color="#242620" />
      <Outline points={outer} color={edge.outer} />
      <Label text={label(size.width, 'back')} position={[0, TOP + 1, -hl - t - 0.7]} color={edge.label} />
      <Label text={label(size.width, 'front')} position={[0, TOP + 1, hl + t + 0.7]} color={edge.label} />
      <Label text={label(size.length, 'left')} position={[-hw - t - 0.7, TOP + 1, 0]} rotation={Math.PI / 2} color={edge.label} />
      <Label text={label(size.length, 'right')} position={[hw + t + 0.7, TOP + 1, 0]} rotation={-Math.PI / 2} color={edge.label} />
      {design.items.filter((i) => !i.wall && !i.hidden).map((item) => (
        <Outline
          key={item.uid}
          points={footprintOutline(item)}
          color={warned.has(item.uid) ? '#c0392b' : item.uid === selected ? '#5b6650' : '#242620'}
        />
      ))}
    </group>
  )
}
