/** Flat drawings of wall items for the front-facing editor, centred on (0, 0) in SVG units (feet). */
export default function WallShape({ catalogId, w, h, color }) {
  const x = -w / 2
  const y = -h / 2
  switch (catalogId) {
    case 'painting':
      return (
        <>
          <rect x={x} y={y} width={w} height={h} fill="#3b2f2a" />
          <rect x={x + 0.12} y={y + 0.12} width={Math.max(0, w - 0.24)} height={Math.max(0, h - 0.24)} fill={color} />
          <path d={`M${x + 0.12} ${-y - 0.12} L${x + w * 0.45} ${0} L${x + w * 0.7} ${-y - 0.35} L${-x - 0.12} ${-y - 0.12} Z`} fill="#e0b25a" opacity="0.7" />
        </>
      )
    case 'mirror':
      return (
        <>
          <ellipse rx={w / 2} ry={h / 2} fill={color} />
          <ellipse rx={w / 2 - 0.1} ry={h / 2 - 0.1} fill="#dfe8ec" />
          <path d={`M${-w * 0.2} ${-h * 0.15} L${-w * 0.05} ${-h * 0.3}`} stroke="#ffffff" strokeWidth="0.06" strokeLinecap="round" />
        </>
      )
    case 'clock':
      return (
        <>
          <ellipse rx={w / 2} ry={h / 2} fill={color} />
          <ellipse rx={w / 2 - 0.06} ry={h / 2 - 0.06} fill="#f7f5f0" />
          <path d={`M0 0 V${-h * 0.3} M0 0 H${w * 0.22}`} stroke={color} strokeWidth="0.05" strokeLinecap="round" />
        </>
      )
    case 'shelf':
      return <rect x={x} y={y} width={w} height={h} rx="0.03" fill={color} />
    case 'sconce':
      return (
        <>
          <rect x={-0.08} y={y + 0.3} width="0.16" height={h - 0.3} fill="#5c5f55" />
          <path d={`M${x} ${y + 0.45} L${-x} ${y + 0.45} L${-x * 0.6} ${y} L${x * 0.6} ${y} Z`} fill={color} />
        </>
      )
    case 'panel': {
      const slats = Math.max(2, Math.round(w / 0.35))
      const slat = w / slats
      return (
        <>
          <rect x={x} y={y} width={w} height={h} fill="#5e4636" />
          {Array.from({ length: slats }, (_, i) => (
            <rect key={i} x={x + i * slat + slat * 0.12} y={y} width={slat * 0.76} height={h} fill={color} />
          ))}
        </>
      )
    }
    case 'curtains': {
      const folds = Math.max(4, Math.round(w / 0.4))
      const fold = w / folds
      return (
        <>
          {Array.from({ length: folds }, (_, i) => (
            <rect key={i} x={x + i * fold} y={y} width={fold} height={h} fill={color} opacity={i % 2 ? 0.85 : 1} />
          ))}
          <rect x={x - 0.2} y={y - 0.08} width={w + 0.4} height="0.08" fill="#5c5f55" />
        </>
      )
    }
    case 'wall-cabinet':
      return (
        <>
          <rect x={x} y={y} width={w} height={h} fill={color} stroke="#9a9a94" strokeWidth="0.04" />
          {w > 1.5 && <path d={`M0 ${y + 0.06} V${-y - 0.06}`} stroke="#9a9a94" strokeWidth="0.03" />}
          <path d={`M${w > 1.5 ? -0.12 : -x - 0.15} ${-y - 0.35} v0.25${w > 1.5 ? ' M0.12 ' + (-y - 0.35) + ' v0.25' : ''}`} stroke="#5c5f55" strokeWidth="0.05" strokeLinecap="round" />
        </>
      )
    case 'range-hood':
      return (
        <>
          <rect x={-w * 0.18} y={y} width={w * 0.36} height={h * 0.6} fill={color} />
          <path d={`M${-w * 0.18} ${y + h * 0.6} L${-w * 0.18} ${y + h * 0.6} L${x} ${-y - 0.15} L${-x} ${-y - 0.15} L${w * 0.18} ${y + h * 0.6} Z`} fill={color} stroke="#8a8d90" strokeWidth="0.03" />
          <rect x={x} y={-y - 0.15} width={w} height="0.15" fill="#8a8d90" />
        </>
      )
    case 'spice-rack':
      return (
        <>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth="0.06" />
          <rect x={x} y={y + h * 0.55} width={w} height="0.06" fill={color} />
          {[-0.4, -0.15, 0.1, 0.35].map((t) => <rect key={t} x={t * w - 0.07} y={y + h * 0.55 - 0.3} width="0.14" height="0.3" fill="#a65f3c" />)}
        </>
      )
    case 'door':
      return (
        <>
          <rect x={x} y={y} width={w} height={h} fill={color} stroke="#5e4636" strokeWidth="0.08" />
          <rect x={x + w * 0.15} y={y + h * 0.08} width={w * 0.7} height={h * 0.36} fill="none" stroke="#6e5238" strokeWidth="0.05" />
          <rect x={x + w * 0.15} y={y + h * 0.52} width={w * 0.7} height={h * 0.4} fill="none" stroke="#6e5238" strokeWidth="0.05" />
          <circle cx={-x - 0.35} cy={0.2} r="0.09" fill="#c4a35a" />
        </>
      )
    case 'window':
      return (
        <>
          <rect x={x} y={y} width={w} height={h} fill="#f2f0eb" stroke="#9a9a94" strokeWidth="0.06" />
          <rect x={x + 0.15} y={y + 0.15} width={Math.max(0, w - 0.3)} height={Math.max(0, h - 0.3)} fill={color} />
          <path d={`M0 ${y + 0.15} V${-y - 0.15} M${x + 0.15} 0 H${-x - 0.15}`} stroke="#f2f0eb" strokeWidth="0.1" />
        </>
      )
    default:
      return <rect x={x} y={y} width={w} height={h} fill={color || '#c9b9a6'} />
  }
}
