/**
 * @nard/ai — position evaluation, difficulty and personalities.
 *
 * Nothing outside this package may know which Evaluator backend is running.
 * See docs/ai-spec.md.
 */

import type { CubeState, Dice, Move, Position } from '@nard/engine'

/** [win, win-gammon, win-backgammon, lose-gammon, lose-backgammon] */
export type Probs = readonly [number, number, number, number, number]

export interface RankedMove {
  readonly move: Move
  /** Cubeful equity of the resulting position. */
  readonly equity: number
  /** Equity lost against the best move. Always <= 0. */
  readonly eqdiff: number
  readonly probs: Probs
}

export interface CubeAnalysis {
  readonly action: 'no-double' | 'double' | 'too-good'
  readonly response: 'take' | 'pass'
  readonly equityNoDouble: number
  readonly equityDoubleTake: number
  readonly equityDoublePass: number
}

export interface EvalOpts {
  /** Search depth. 0 and 1 are fast; 2 is for the top rungs and analysis. */
  readonly plies?: 0 | 1 | 2
}

export interface Evaluator {
  rankMoves(pos: Position, dice: Dice, opts?: EvalOpts): Promise<RankedMove[]>
  cubeDecision(pos: Position, cube: CubeState): Promise<CubeAnalysis>
  /** Release the backend (e.g. terminate the gnubg child process). */
  dispose(): Promise<void>
}

export interface EvaluatorOptions {
  /** Disable graceful degradation for benchmarks that require the primary backend. */
  readonly allowFallback?: boolean
  readonly onBackendError?: (error: Error) => void
}

export async function createEvaluator(
  options: EvaluatorOptions = {},
): Promise<Evaluator> {
  const { GnubgEvaluator } = await import('./gnubg.js')
  const onBackendError =
    options.onBackendError === undefined
      ? {}
      : { onBackendError: options.onBackendError }
  return new GnubgEvaluator({
    ...onBackendError,
    ...(options.allowFallback === false ? { fallback: null } : {}),
  })
}

export {
  chooseCube,
  chooseMove,
  DIFFICULTIES,
  PERSONALITY_SAFETY_CLAMP,
  selectRankedMove,
  type CubeChoice,
  type Difficulty,
  type DifficultyRung,
  type MoveSelection,
  type Personality,
} from './policy.js'
