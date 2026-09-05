import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Checker, Slab, type Side } from './Checker'
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
  /**
   * Being hit. A checker knocked to the bar turns as it goes and settles
   * straight — docs/design-language.md has specified this since the motion
   * section was written and nothing had implemented it. It is the one moment
   * in a game that should not look like an ordinary placement.
   */
  hitSpin: 8,
  reducedMs: 120,
} as const

/**
 * What a checker arriving here should sound like.
 *
 * `fromBar` is the entry sound — a checker coming off the bar and back onto
 * the board. It is the one moment in a turn that is not just another placement,
 * so it gets its own sample; that sample was in the bundle from the start and
 * nothing had ever played it, because this function looked only at where a
 * checker was going and never at where it came from.
 */
function arrivalSound(entity: CheckerEntity, fromBar: boolean): SoundEvent {
  if (entity.loc.kind === 'off') return 'off'
  // A checker arriving ON the bar got there by being hit.
  if (entity.loc.kind === 'bar') return 'hit'
  return fromBar ? 'bar' : 'place'
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
  ghost,
}: {
  entity: CheckerEntity
  x: number
  y: number
  reduced: boolean
  /** This checker is in the player's hand; what is drawn here is where it came from. */
  ghost: boolean
}) {
  const [moving, setMoving] = useState(false)
  const prev = useRef({ x, y })
  /**
   * How far this checker travelled. Re-laying out a stack nudges checkers a
   * fraction of a diameter, and those settle in ~30ms — audibly a second click
   * right after the real one. A shuffle is not a placement.
   */
  const travelled = useRef(0)
  /**
   * Where this checker was before the move that is now running.
   *
   * Read in the effect, which fires AFTER `loc` has already been updated to the
   * destination — so the ref holds the origin at exactly the moment the arrival
   * sound needs to know it.
   */
  const wasAt = useRef(entity.loc.kind)
  const cameFromBar = useRef(false)
  const knockedToBar = useRef(false)

  useEffect(() => {
    if (prev.current.x === x && prev.current.y === y) return
    travelled.current = Math.hypot(x - prev.current.x, y - prev.current.y)
    cameFromBar.current = wasAt.current === 'bar' && entity.loc.kind === 'point'
    knockedToBar.current = wasAt.current === 'point' && entity.loc.kind === 'bar'
    wasAt.current = entity.loc.kind
    prev.current = { x, y }
    setMoving(true)
  }, [x, y, entity.loc.kind])

  const travel = reduced
    ? { duration: MOTION.reducedMs / 1000 }
    : { ...MOTION.travel, delay: moving ? MOTION.lift.duration : 0 }

  return (
    <motion.g
      data-checker={entity.id}
      data-side={entity.side}
      {...(moving ? { 'data-moving': '1' } : {})}
      initial={false}
      animate={{
        x,
        y,
        scale: moving && !reduced ? MOTION.lift.scale : 1,
        rotate: moving && knockedToBar.current && !reduced ? MOTION.hitSpin : 0,
        opacity: ghost ? 0.28 : 1,
      }}
      transition={{
        x: travel,
        y: travel,
        scale: moving ? MOTION.lift : MOTION.drop,
        rotate: travel,
        opacity: { duration: 0.09 },
      }}
      onAnimationComplete={() => {
        // Fires twice per move: once when the carry finishes, once when the
        // set-down scale finishes. The sound belongs to the FIRST — that is
        // contact, not pick-up. `moving` is still true only then, which
        // distinguishes them.
        if (!moving) return
        if (travelled.current >= CHECKER_R) {
          sound.play(arrivalSound(entity, cameFromBar.current))
        }
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

export function AnimatedCheckers({
  entities,
  ghost = null,
}: {
  entities: readonly CheckerEntity[]
  /**
   * The checker currently being carried, if any. It stays drawn in its old
   * place at low opacity rather than vanishing, so the player can see where
   * they picked up from while deciding where to put it down.
   */
  ghost?: string | null
}) {
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
          ghost={p.entity.id === ghost}
        />
      ))}
    </g>
  )
}

/**
 * The checker in the player's hand, following the pointer.
 *
 * Drawn outside the entity layer and above everything, with a bigger and
 * further-offset shadow than a resting checker: a piece held above the board
 * casts a larger, softer shadow, and that shadow is most of what says it is
 * lifted rather than sliding.
 */
export function Carried({ side, x, y }: { side: Side; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ pointerEvents: 'none' }}>
      <ellipse
        cx={CHECKER_R * 0.3}
        cy={CHECKER_R * 0.5}
        rx={CHECKER_R * 1.35}
        ry={CHECKER_R * 1.25}
        fill="url(#cast)"
        opacity="0.75"
      />
      <g transform="scale(1.12)">
        <Checker side={side} />
      </g>
    </g>
  )
}
