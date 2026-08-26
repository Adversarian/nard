import {
  applyMove,
  encodeMatchId,
  encodePositionId,
  generateLegalMoves,
  type CubeState,
  type Dice,
  type Position,
} from '@nard/engine'

import {
  bridgeErrorMessage,
  GnubgBridgeClient,
  type BridgeClientOptions,
} from './bridge-client.js'
import {
  cubeAnalysisFromBridge,
  rankedMovesFromBridge,
} from './bridge-result.js'
import type {
  CubeAnalysis,
  EvalOpts,
  EvaluationContext,
  Evaluator,
  RankedMove,
} from './index.js'
import { NetEvaluator } from './net.js'

export interface GnubgEvaluatorOptions extends BridgeClientOptions {
  readonly fallback?: Evaluator | null
  readonly onBackendError?: (error: Error) => void
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function evaluationMatchId(
  dice: Dice,
  context: EvaluationContext | undefined,
): string | undefined {
  if (context === undefined) return undefined
  return encodeMatchId({
    dice,
    onRoll: context.onRoll,
    decisionPlayer: context.onRoll,
    resignation: 0,
    cubeOffered: false,
    cube: context.cube,
    crawford: context.match.crawford,
    matchLength: context.match.length,
    score: context.match.score,
    jacoby: context.match.jacoby,
    gameState: 'playing',
  })
}

function playerScore(
  context: EvaluationContext,
): readonly [number, number] {
  const opponent = context.onRoll === 'light' ? 'dark' : 'light'
  return [
    context.match.score[opponent],
    context.match.score[context.onRoll],
  ]
}

function cubeOwner(
  cube: CubeState,
  context: EvaluationContext | undefined,
): -1 | 0 | 1 {
  if (cube.owner === null) return -1
  if (context === undefined || cube.owner === context.onRoll) return 1
  return 0
}

export class GnubgEvaluator implements Evaluator {
  readonly #bridge: GnubgBridgeClient
  readonly #fallback: Evaluator | null
  readonly #onBackendError: ((error: Error) => void) | undefined

  constructor(options: GnubgEvaluatorOptions = {}) {
    this.#bridge = new GnubgBridgeClient(options)
    this.#fallback =
      options.fallback === undefined ? new NetEvaluator() : options.fallback
    this.#onBackendError = options.onBackendError
  }

  async rankMoves(
    pos: Position,
    dice: Dice,
    opts: EvalOpts = {},
  ): Promise<RankedMove[]> {
    const legal = generateLegalMoves(pos, dice)
    if (legal.length === 0) return []

    try {
      const matchId = evaluationMatchId(dice, opts.context)
      const response = await this.#bridge.rankMoves({
        positionId: encodePositionId(pos),
        dice,
        plies: opts.plies ?? 2,
        ...(matchId === undefined ? {} : { matchId }),
      })
      return rankedMovesFromBridge(pos, dice, response)
    } catch (error) {
      return this.#fallBack(
        error,
        (fallback) => fallback.rankMoves(pos, dice, opts),
      )
    }
  }

  async cubeDecision(
    pos: Position,
    cube: CubeState,
    opts: EvalOpts = {},
  ): Promise<CubeAnalysis> {
    const context = opts.context
    try {
      const response = await this.#bridge.cubeDecision({
        positionId: encodePositionId(pos),
        cubeValue: cube.value,
        cubeOwner: cubeOwner(cube, context),
        matchLength: context?.match.length ?? 0,
        score: context === undefined ? [0, 0] : playerScore(context),
        crawford: context?.match.crawford ?? false,
        jacoby: context?.match.jacoby ?? false,
        plies: opts.plies ?? 2,
      })
      return cubeAnalysisFromBridge(response)
    } catch (error) {
      return this.#fallBack(
        error,
        (fallback) => fallback.cubeDecision(pos, cube, opts),
      )
    }
  }

  async dispose(): Promise<void> {
    await this.#bridge.dispose()
    await this.#fallback?.dispose()
  }

  async #fallBack<T>(
    cause: unknown,
    operation: (fallback: Evaluator) => Promise<T>,
  ): Promise<T> {
    const error = asError(cause)
    this.#onBackendError?.(new Error(bridgeErrorMessage(error), { cause: error }))
    if (this.#fallback === null) throw error
    return operation(this.#fallback)
  }
}
