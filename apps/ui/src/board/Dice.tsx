import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
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

/**
 * A die that tumbles when the roll changes, then settles.
 *
 * The faces cycle rather than the die spinning: a rotating cube of SVG would be
 * fussy and read worse at this size, whereas flicking through faces is exactly
 * what a tumbling die looks like. Three changes over ~380ms per
 * docs/design-language.md, then it locks to the rolled value.
 *
 * `dimmed` marks a die already consumed this turn, so a player mid-move can see
 * at a glance what is left to play.
 */
export function RolledDie({
  x,
  y,
  value,
  side = 'light',
  size = 0.82,
  dimmed = false,
}: {
  x: number
  y: number
  value: number
  side?: Side
  size?: number
  dimmed?: boolean
}) {
  const [face, setFace] = useState(value)
  const settled = useRef(true)

  useEffect(() => {
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setFace(value)
      return
    }

    settled.current = false
    let n = 0
    const timer = setInterval(() => {
      n += 1
      if (n >= 3) {
        clearInterval(timer)
        settled.current = true
        setFace(value)
      } else {
        setFace(1 + Math.floor(Math.random() * 6))
      }
    }, 380 / 3)
    return () => clearInterval(timer)
  }, [value])

  return (
    <motion.g
      initial={false}
      animate={{ scale: settled.current ? 1 : 1.06, opacity: dimmed ? 0.35 : 1 }}
      transition={{ scale: { duration: 0.38 }, opacity: { duration: 0.18 } }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <Die x={x} y={y} value={face} side={side} size={size} />
    </motion.g>
  )
}
