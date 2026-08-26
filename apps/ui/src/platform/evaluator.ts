/**
 * The UI's view of the evaluator.
 *
 * `packages/ai` spawns gnubg as a child process, which a browser page cannot do.
 * This is the seam from ADR 0003: in development the request goes over HTTP to
 * the evaluator running inside Vite's Node process (see dev-evaluator.ts); in
 * the shipped Tauri build it becomes an IPC call to the Rust side.
 *
 * Nothing above this file knows which transport is in use, or that gnubg exists.
 */

import {
  cubeAnalysisFromBridge,
  NetEvaluator,
  rankedMovesFromBridge,
  type CubeAnalysis,
  type CubeDecisionRequest,
  type CubeDecisionResponse,
  type RankedMove,
  type RankMovesRequest,
  type RankMovesResponse,
} from '@nard/ai'
import {
  encodePositionId,
  type CubeState,
  type Dice,
  type Position,
} from '@nard/engine'
import { invokeTauri, isTauri } from './tauri'

export interface UiEvaluator {
  rankMoves(pos: Position, dice: Dice, plies?: 0 | 1 | 2): Promise<RankedMove[]>
  cubeDecision(pos: Position, cube: CubeState): Promise<CubeAnalysis>
}

const encode = (pos: Position) => ({
  pts: Array.from(pos.pts),
  off: pos.off,
  oppOff: pos.oppOff,
})

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch('/api/eval', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`evaluator responded ${res.status}`)
  const json = (await res.json()) as { error?: string } & T
  if (json.error) throw new Error(json.error)
  return json
}

const fallback = new NetEvaluator()

export const evaluator: UiEvaluator = {
  async rankMoves(pos, dice, plies = 1) {
    if (isTauri()) {
      try {
        const params: RankMovesRequest = {
          positionId: encodePositionId(pos),
          dice,
          plies,
        }
        const result = await invokeTauri<RankMovesResponse>('evaluate', {
          request: { method: 'rank_moves', params },
        })
        return rankedMovesFromBridge(pos, dice, result)
      } catch {
        return fallback.rankMoves(pos, dice, { plies })
      }
    }
    const { moves } = await post<{ moves: RankedMove[] }>({ ...encode(pos), dice, plies })
    return moves
  },
  async cubeDecision(pos, cube) {
    if (isTauri()) {
      try {
        const params: CubeDecisionRequest = {
          positionId: encodePositionId(pos),
          cubeValue: cube.value,
          cubeOwned: cube.owner !== null,
        }
        const result = await invokeTauri<CubeDecisionResponse>('evaluate', {
          request: { method: 'cube_decision', params },
        })
        return cubeAnalysisFromBridge(result)
      } catch {
        return fallback.cubeDecision(pos, cube)
      }
    }
    const { cube: analysis } = await post<{ cube: CubeAnalysis }>({ ...encode(pos), cube })
    return analysis
  },
}
