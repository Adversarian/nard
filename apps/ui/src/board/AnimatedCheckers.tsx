import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Checker } from './Checker'
import { layout, type CheckerEntity } from './entities'
import type { HomeSide } from './geometry'

/**
 * Motion values live in ONE place so tools/motion.ts can assert against the same
 * numbers docs/design-language.md states. Do not tune these by eye — the spring
 * is specified by its damping ratio, and `pnpm motion` measures whether the
 * implementation actually hits it.
 */
export const MOTION = {
  /** Pick up: 110ms, scale to 1.05. */
  lift: { duration: 0.11, ease: [0.2, 0.8, 0.3, 1] as const, scale: 1.05 },
  /** Carry: ζ ≈ 0.72 → ~4% overshoot, ~260ms settle. */
  travel: { type: 'spring', stiffness: 420, damping: 28, mass: 0.9 } as const,
  /** Set down: 90ms. */
  drop: { duration: 0.09, ease: [0.2, 0.8, 0.3, 1] as const },
  reducedMs: 120,
} as const

/**
 * One checker.
 *
 * `initial={false}` is load-bearing: it tells motion to treat the first
 * `animate` values as the starting state, so 30 checkers appear in place instead
 * of animating in from the origin. Placing them imperatively instead (a
 * zero-duration animate, or writing the SVG transform attribute) does not work —
 * motion does not reliably read a transform back out of the DOM, so the checker
 * jumps to 0,0 on its first real move.
 *
 * The sequence matches how a hand moves a checker: lift it, carry it, set it
 * down. Travelling and scaling at the same time reads as a slide, not a pick-up,
 * which is why travel is delayed by the lift duration.
 */
const AnimatedChecker = memo(function AnimatedChecker({
  entity,
  x,
  y,
  reduced,
}: {
  entity: CheckerEntity
  x: number
  y: number
  reduced: boolean
}) {
  const [moving, setMoving] = useState(false)
  const prev = useRef({ x, y })

  useEffect(() => {
    if (prev.current.x === x && prev.current.y === y) return
    prev.current = { x, y }
    setMoving(true)
  }, [x, y])

  // The checker is set down when the carry actually finishes — not after a
  // guessed delay. A timeout here got cleared by re-renders and left checkers
  // stuck at 1.05 scale, permanently lifted; the motion trace caught it.

  const travel = reduced
    ? { duration: MOTION.reducedMs / 1000 }
    : { ...MOTION.travel, delay: moving ? MOTION.lift.duration : 0 }

  return (
    <motion.g
      data-checker={entity.id}
      data-side={entity.side}
      {...(moving ? { 'data-moving': '1' } : {})}
      initial={false}
      animate={{ x, y, scale: moving && !reduced ? MOTION.lift.scale : 1 }}
      transition={{
        x: travel,
        y: travel,
        scale: moving ? MOTION.lift : MOTION.drop,
      }}
      onAnimationComplete={() => setMoving(false)}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <Checker side={entity.side} />
    </motion.g>
  )
})

export function AnimatedCheckers({
  entities,
  home = 'right',
}: {
  entities: readonly CheckerEntity[]
  home?: HomeSide
}) {
  const reduced =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches

  // Paint low checkers first so a checker higher on a point overlaps the one
  // beneath it, rather than being hidden by it.
  const placements = [...layout(entities, home)].sort((a, b) => a.z - b.z)

  return (
    <g>
      {placements.map((p) => (
        <AnimatedChecker
          key={p.entity.id}
          entity={p.entity}
          x={p.x}
          y={p.y}
          reduced={reduced}
        />
      ))}
    </g>
  )
}
