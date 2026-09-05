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

/**
 * A die, in board units. Bone with drilled pips, or ebony with bone pips.
 *
 * Two details do all the work of making this a turned object rather than a
 * rounded rectangle with dots on it:
 *
 *   The body carries the same upper-left gradient as everything else, so it
 *   has a lit corner and a shadowed one.
 *
 *   The pips are DRILLED, not printed. A drilled pip is a recess, so its
 *   shading is inverted against the die's: dark on the upper-left wall where
 *   the light cannot reach, catching light on the lower-right. That inversion
 *   is the whole reason it reads as a hole. See the light model in Defs.tsx.
 *
 * `tilt` is deterministic, derived from the face and the die's position in the
 * pair, so a rolled pair never looks like two copies of one stamp — and so
 * `pnpm shots` produces the same image twice.
 */
export function Die({
  x,
  y,
  value,
  side = 'light',
  size = 0.62,
  index = 0,
}: {
  x: number
  y: number
  value: number
  side?: Side
  size?: number
  index?: number
}) {
  const light = side === 'light'
  const half = size / 2
  const step = size * 0.26
  const pipR = size * 0.083
  const r = size * 0.17
  const tilt = ((value * 37 + index * 53) % 13) - 6

  return (
    <g transform={`rotate(${tilt} ${x} ${y})`}>
      <rect
        x={x - half * 1.14}
        y={y - half * 1.06}
        width={size * 1.14}
        height={size * 1.14}
        rx={size * 0.4}
        fill="url(#cast)"
      />
      {/* Turned from the same bone and ebony as the checkers, and drawn the
          same way: material first, lighting over it. */}
      <rect
        x={x - half}
        y={y - half}
        width={size}
        height={size}
        rx={r}
        fill={light ? 'url(#tex-bone)' : 'url(#tex-ebony)'}
      />
      <rect
        x={x - half}
        y={y - half}
        width={size}
        height={size}
        rx={r}
        fill={`url(#die-${side})`}
        opacity="0.55"
      />
      {/* the rounded-over arris, lit along the top-left run only */}
      <path
        d={`M ${x - half + r * 0.3} ${y + half - r * 0.3} L ${x - half + r * 0.3} ${y - half + r} Q ${x - half + r * 0.3} ${y - half + r * 0.3} ${x - half + r} ${y - half + r * 0.3} L ${x + half - r * 0.3} ${y - half + r * 0.3}`}
        fill="none"
        stroke={light ? '#fff' : 'var(--checker-dark-hi)'}
        strokeOpacity={light ? 0.75 : 0.5}
        strokeWidth={size * 0.035}
        strokeLinecap="round"
      />
      <rect
        x={x - half}
        y={y - half}
        width={size}
        height={size}
        rx={r}
        fill="none"
        stroke={light ? 'var(--checker-light-lo)' : 'var(--checker-dark-lo)'}
        strokeWidth="0.012"
        strokeOpacity="0.5"
      />
      {(PIPS[value] ?? []).map(([dx, dy], i) => (
        <circle
          key={i}
          cx={x + dx * step}
          cy={y + dy * step}
          r={pipR}
          fill={light ? 'url(#pip-dark)' : 'url(#pip-light)'}
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
 * docs/design-language.md, then it locks to the rolled value. A short spin and
 * a settle-back on scale ride on top, because a die that changes face without
 * moving reads as a slot machine rather than a throw.
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
  index = 0,
}: {
  x: number
  y: number
  value: number
  side?: Side
  size?: number
  dimmed?: boolean
  index?: number
}) {
  const [face, setFace] = useState(value)
  const [rolling, setRolling] = useState(false)

  useEffect(() => {
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setFace(value)
      return
    }

    setRolling(true)
    let n = 0
    const timer = setInterval(() => {
      n += 1
      if (n >= 3) {
        clearInterval(timer)
        setRolling(false)
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
      animate={{
        scale: rolling ? 1.1 : 1,
        rotate: rolling ? (index % 2 === 0 ? -14 : 12) : 0,
        opacity: dimmed ? 0.32 : 1,
      }}
      transition={{
        scale: { type: 'spring', stiffness: 340, damping: 18, mass: 0.7 },
        rotate: { type: 'spring', stiffness: 260, damping: 20, mass: 0.8 },
        opacity: { duration: 0.18 },
      }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <Die x={x} y={y} value={face} side={side} size={size} index={index} />
    </motion.g>
  )
}
