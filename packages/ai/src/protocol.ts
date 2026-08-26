import type { Dice } from '@nard/engine'

export interface RankMovesRequest {
  readonly positionId: string
  readonly dice: Dice
  readonly plies: 0 | 1 | 2
  readonly matchId?: string
}

export interface BridgeRankedMove {
  readonly move: string
  readonly positionId: string
  readonly equity: number
  readonly eqdiff: number
  readonly probs: readonly number[]
}

export interface RankMovesResponse {
  readonly moves: readonly BridgeRankedMove[]
}

export interface CubeDecisionRequest {
  readonly positionId: string
  readonly cubeValue: number
  /** -1 centred, otherwise the GNU board side that owns it. */
  readonly cubeOwner: -1 | 0 | 1
  readonly matchLength: number
  /** GNU side 0 (opponent), side 1 (player represented by the position). */
  readonly score: readonly [number, number]
  readonly crawford: boolean
  readonly jacoby: boolean
  readonly plies: 0 | 1 | 2
}

export interface CubeDecisionResponse {
  readonly action: 'no-double' | 'double' | 'too-good'
  readonly response: 'take' | 'pass'
  readonly equityNoDouble: number
  readonly equityDoubleTake: number
  readonly equityDoublePass: number
}

export type BridgeRequest =
  | {
      readonly id: number
      readonly method: 'rank_moves'
      readonly params: RankMovesRequest
    }
  | {
      readonly id: number
      readonly method: 'cube_decision'
      readonly params: CubeDecisionRequest
    }

export type BridgeResponse =
  | {
      readonly id: number
      readonly ok: true
      readonly result: unknown
    }
  | {
      readonly id: number | null
      readonly ok: false
      readonly error: string
    }
