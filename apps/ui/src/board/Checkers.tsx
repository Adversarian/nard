import { Checker, CountChip, type Side } from './Checker'
import {
  barCentre,
  checkerCentre,
  offSlab,
  stackPlan,
  type HomeSide,
} from './geometry'

/**
 * Lays out every checker for a position.
 *
 * `pts` is the engine's on-roll-relative array (AGENTS.md §5): index 1..24
 * signed, 25 = on-roll bar, 0 = opponent bar. Positive counts belong to the
 * player on roll.
 */
export function Checkers({
  pts,
  off,
  oppOff,
  onRollSide = 'light',
  home = 'right',
}: {
  pts: readonly number[]
  off: number
  oppOff: number
  onRollSide?: Side
  home?: HomeSide
}) {
  const oppSide: Side = onRollSide === 'light' ? 'dark' : 'light'
  const nodes: React.ReactNode[] = []

  for (let p = 1; p <= 24; p++) {
    const n = pts[p] ?? 0
    if (n === 0) continue
    const count = Math.abs(n)
    const side = n > 0 ? onRollSide : oppSide
    const { drawn, chip } = stackPlan(count)
    for (let k = 0; k < drawn; k++) {
      const c = checkerCentre(p, k, drawn, home)
      nodes.push(<Checker key={`p${p}-${k}`} x={c.x} y={c.y} side={side} />)
    }
    if (chip) {
      const c = checkerCentre(p, drawn - 1, drawn, home)
      nodes.push(<CountChip key={`chip${p}`} x={c.x} y={c.y} n={chip} />)
    }
  }

  const onBar = pts[25] ?? 0
  for (let k = 0; k < onBar; k++) {
    const c = barCentre(k, true)
    nodes.push(<Checker key={`bar-on-${k}`} x={c.x} y={c.y} side={onRollSide} />)
  }
  const oppBar = Math.abs(pts[0] ?? 0)
  for (let k = 0; k < oppBar; k++) {
    const c = barCentre(k, false)
    nodes.push(<Checker key={`bar-off-${k}`} x={c.x} y={c.y} side={oppSide} />)
  }

  for (let k = 0; k < off; k++) {
    const s = offSlab(k, true)
    nodes.push(<Slab key={`off-on-${k}`} {...s} side={onRollSide} />)
  }
  for (let k = 0; k < oppOff; k++) {
    const s = offSlab(k, false)
    nodes.push(<Slab key={`off-opp-${k}`} {...s} side={oppSide} />)
  }

  return <g>{nodes}</g>
}

/** A borne-off checker, lying flat in the tray. */
function Slab({
  x,
  y,
  w,
  h,
  side,
}: {
  x: number
  y: number
  w: number
  h: number
  side: Side
}) {
  const light = side === 'light'
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2.4}
        fill={light ? 'var(--checker-light)' : 'var(--checker-dark)'}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2.4}
        fill="none"
        stroke={light ? 'var(--checker-light-edge)' : 'var(--checker-dark-rim)'}
        strokeWidth="0.012"
        strokeOpacity="0.8"
      />
    </g>
  )
}
