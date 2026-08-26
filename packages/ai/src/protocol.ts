/**
 * The evaluator bridge protocol.
 *
 * THIS FILE IS THE DEFINITION. It has readers in four languages, and only one
 * of them is checked by the TypeScript compiler:
 *
 *   packages/ai/src/gnubg.ts              TS   builds requests
 *   apps/ui/src/platform/evaluator.ts     TS   builds requests (Tauri path)
 *   packages/ai/bridge.py                 PY   reads params inside gnubg
 *   apps/desktop/src-tauri/src/lib.rs     RS   serde structs, packaged app
 *   apps/desktop/scripts/smoke-gnubg.ps1  PS1  end-to-end check on Windows
 *
 * **Changing a field here does not break any of the others at build time.** It
 * breaks them at runtime, and only some of them only in the packaged app. This
 * has already happened once: adding match context to the cube request left the
 * Rust struct and the PowerShell smoke test behind, and the failure showed up
 * as a Windows CI error four steps removed from the cause.
 *
 * Change a field, then grep this list. All of it.
 */

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
