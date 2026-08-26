import {
  applyMove,
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
import type {
  CubeAnalysis,
  EvalOpts,
  Evaluator,
  Probs,
  RankedMove,
} from './index.js'
import { NetEvaluator } from './net.js'
import type {
  CubeDecisionResponse,
  RankMovesResponse,
} from './protocol.js'

export interface GnubgEvaluatorOptions extends BridgeClientOptions {
  readonly fallback?: Evaluator | null
  readonly onBackendError?: (error: Error) => void
}

function finite(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`GNU Backgammon returned a non-finite ${field}`)
  }
  return value
}

function probs(values: readonly number[]): Probs {
  if (values.length !== 5) {
    throw new Error('GNU Backgammon returned an invalid probability vector')
  }
  const parsed = values.map((value, index) =>
    finite(value, `probability ${index}`),
  )
  return [parsed[0]!, parsed[1]!, parsed[2]!, parsed[3]!, parsed[4]!]
}

function mapRankedMoves(
  pos: Position,
  dice: Dice,
  response: RankMovesResponse,
): RankedMove[] {
  const legal = generateLegalMoves(pos, dice)
  const byPosition = new Map(
    legal.map((move) => [encodePositionId(applyMove(pos, move)), move]),
  )
  const ranked: RankedMove[] = []

  for (const candidate of response.moves) {
    const move = byPosition.get(candidate.positionId)
    if (move === undefined) {
      throw new Error(
        `GNU Backgammon returned an unknown move ${candidate.move} (${candidate.positionId})`,
      )
    }
    byPosition.delete(candidate.positionId)
    ranked.push({
      move,
      equity: finite(candidate.equity, 'move equity'),
      eqdiff: Math.min(0, finite(candidate.eqdiff, 'move equity difference')),
      probs: probs(candidate.probs),
    })
  }

  if (byPosition.size > 0) {
    throw new Error(
      `GNU Backgammon omitted ${byPosition.size} legal move${byPosition.size === 1 ? '' : 's'}`,
    )
  }

  return ranked.sort((left, right) => right.equity - left.equity)
}

function validateCube(response: CubeDecisionResponse): CubeAnalysis {
  return {
    action: response.action,
    response: response.response,
    equityNoDouble: finite(response.equityNoDouble, 'no-double equity'),
    equityDoubleTake: finite(
      response.equityDoubleTake,
      'double/take equity',
    ),
    equityDoublePass: finite(
      response.equityDoublePass,
      'double/pass equity',
    ),
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
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
      const response = await this.#bridge.rankMoves({
        positionId: encodePositionId(pos),
        dice,
        plies: opts.plies ?? 2,
      })
      return mapRankedMoves(pos, dice, response)
    } catch (error) {
      return this.#fallBack(
        error,
        (fallback) => fallback.rankMoves(pos, dice, opts),
      )
    }
  }

  async cubeDecision(pos: Position, cube: CubeState): Promise<CubeAnalysis> {
    try {
      const response = await this.#bridge.cubeDecision({
        positionId: encodePositionId(pos),
        cubeValue: cube.value,
        cubeOwned: cube.owner !== null,
      })
      return validateCube(response)
    } catch (error) {
      return this.#fallBack(
        error,
        (fallback) => fallback.cubeDecision(pos, cube),
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
