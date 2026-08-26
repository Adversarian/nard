import { type Side } from './Checker'

const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
}

/** A die, in board units. Bone with dark pips, or ebony with bone pips. */
export function Die({
  x,
  y,
  value,
  side = 'light',
  size = 0.62,
}: {
  x: number
  y: number
  value: number
  side?: Side
  size?: number
}) {
  const light = side === 'light'
  const half = size / 2
  const step = size * 0.27
  const pipR = size * 0.088
  return (
    <g filter="url(#checker-shadow)">
      <rect
        x={x - half}
        y={y - half}
        width={size}
        height={size}
        rx={size * 0.19}
        fill={light ? 'var(--checker-light)' : 'var(--checker-dark)'}
      />
      <rect
        x={x - half}
        y={y - half}
        width={size}
        height={size}
        rx={size * 0.19}
        fill="none"
        stroke={light ? 'var(--checker-light-edge)' : 'var(--checker-dark-rim)'}
        strokeWidth="0.014"
        strokeOpacity="0.7"
      />
      {(PIPS[value] ?? []).map(([dx, dy], i) => (
        <circle
          key={i}
          cx={x + dx * step}
          cy={y + dy * step}
          r={pipR}
          fill={light ? 'var(--checker-dark)' : 'var(--checker-light)'}
        />
      ))}
    </g>
  )
}
