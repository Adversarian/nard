import {
  applyMove,
  encodePositionId,
  generateLegalMoves,
  type Dice,
  type Position,
} from '@nard/engine'

import type { CubeAnalysis, Probs, RankedMove } from './index.js'
import type {
  CubeDecisionResponse,
  RankMovesResponse,
} from './protocol.js'

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

/**
 * Convert gnubg's transport result into engine-native moves.
 *
 * Kept free of Node APIs so both the Node bridge client and the packaged
 * webview can share the exact same validation at their transport boundary.
 */
export function rankedMovesFromBridge(
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

export function cubeAnalysisFromBridge(
  response: CubeDecisionResponse,
): CubeAnalysis {
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
