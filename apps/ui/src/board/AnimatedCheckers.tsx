import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Checker, Slab } from './Checker'
import { layout, type CheckerEntity } from './entities'
import { CHECKER_R } from './geometry'
import type { SoundEvent } from '../sound/manifest'
import { sound } from '../sound/player'

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

/** What a checker arriving here should sound like. */
function arrivalSound(entity: CheckerEntity): SoundEvent {
  if (entity.loc.kind === 'off') return 'off'
  // A checker arriving on the bar got there by being hit.
  if (entity.loc.kind === 'bar') return 'hit'
  return 'place'
}

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
  /**
   * How far this checker travelled. Re-laying out a stack nudges checkers a
   * fraction of a diameter, and those settle in ~30ms — audibly a second click
   * right after the real one. A shuffle is not a placement.
   */
  const travelled = useRef(0)

  useEffect(() => {
    if (prev.current.x === x && prev.current.y === y) return
    travelled.current = Math.hypot(x - prev.current.x, y - prev.current.y)
    prev.current = { x, y }
    setMoving(true)
  }, [x, y])

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
      onAnimationComplete={() => {
        // Fires twice per move: once when the carry finishes, once when the
        // set-down scale finishes. The sound belongs to the FIRST — that is
        // contact, not pick-up. `moving` is still true only then, which
        // distinguishes them.
        if (!moving) return
        if (travelled.current >= CHECKER_R) sound.play(arrivalSound(entity))
        setMoving(false)
      }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      {entity.loc.kind === 'off' ? (
        <Slab side={entity.side} />
      ) : (
        <Checker side={entity.side} />
      )}
    </motion.g>
  )
})

export function AnimatedCheckers({ entities }: { entities: readonly CheckerEntity[] }) {
  const reduced =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches

  // Paint low checkers first so a checker higher on a point overlaps the one
  // beneath it, rather than being hidden by it.
  const placements = [...layout(entities)].sort((a, b) => a.z - b.z)

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
