import type { Dice } from '@nard/engine'

import type {
  Blunder,
  CheckerDecisionAnalysis,
} from './analysis.js'

export type Sm2Quality = 0 | 1 | 2 | 3 | 4 | 5

export interface Sm2Schedule {
  readonly repetitions: number
  readonly intervalDays: number
  readonly easeFactor: number
  readonly dueAt: string
  readonly lastReviewedAt?: string
}

export interface DrillV1 {
  readonly id: string
  readonly source: {
    readonly commitment: string
    readonly decisionIndex: number
    readonly gameIndex: number
  }
  readonly positionId: string
  readonly matchId: string
  readonly dice: Dice
  readonly playedPositionId: string
  readonly bestPositionId: string
  readonly equityError: number
  readonly phase: Blunder['phase']
  readonly theme: Blunder['theme']
  readonly direction: Blunder['direction']
  readonly schedule: Sm2Schedule
}

export interface DrillsFileV1 {
  readonly v: 1
  readonly drills: readonly DrillV1[]
}

function timestamp(value: string, name: string): number {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new RangeError(`${name} must be an ISO date`)
  return parsed
}

function addDays(value: string, days: number): string {
  return new Date(timestamp(value, 'reviewedAt') + days * 86_400_000).toISOString()
}

export function initialSm2Schedule(createdAt: string): Sm2Schedule {
  const dueAt = new Date(timestamp(createdAt, 'createdAt')).toISOString()
  return {
    repetitions: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    dueAt,
  }
}

/** The standard SM-2 update, with the conventional 1.3 ease-factor floor. */
export function reviewSm2(
  schedule: Sm2Schedule,
  quality: Sm2Quality,
  reviewedAt: string,
): Sm2Schedule {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError('SM-2 quality must be an integer from 0 to 5')
  }
  const reviewed = new Date(timestamp(reviewedAt, 'reviewedAt')).toISOString()
  const gap = 5 - quality
  const easeFactor = Math.max(
    1.3,
    schedule.easeFactor + 0.1 - gap * (0.08 + gap * 0.02),
  )

  let repetitions: number
  let intervalDays: number
  if (quality < 3) {
    repetitions = 0
    intervalDays = 1
  } else {
    repetitions = schedule.repetitions + 1
    intervalDays =
      repetitions === 1
          ? 1
        : repetitions === 2
          ? 6
          : Math.max(
              1,
              Math.round(schedule.intervalDays * schedule.easeFactor),
            )
  }

  return {
    repetitions,
    intervalDays,
    easeFactor,
    dueAt: addDays(reviewed, intervalDays),
    lastReviewedAt: reviewed,
  }
}

export function drillFromBlunder(
  commitment: string,
  blunder: Blunder,
  decision: CheckerDecisionAnalysis,
  createdAt: string,
): DrillV1 {
  if (blunder.decisionIndex !== decision.decisionIndex) {
    throw new Error('blunder and checker decision do not refer to the same move')
  }
  return {
    id: `${commitment}:${decision.decisionIndex}`,
    source: {
      commitment,
      decisionIndex: decision.decisionIndex,
      gameIndex: decision.gameIndex,
    },
    positionId: decision.positionId,
    matchId: decision.matchId,
    dice: decision.dice,
    playedPositionId: decision.played.positionId,
    bestPositionId: decision.best.positionId,
    equityError: decision.error,
    phase: blunder.phase,
    theme: blunder.theme,
    direction: blunder.direction,
    schedule: initialSm2Schedule(createdAt),
  }
}
