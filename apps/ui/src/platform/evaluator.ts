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

import type { CubeAnalysis, RankedMove } from '@nard/ai'
import type { CubeState, Dice, Position } from '@nard/engine'

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

export const evaluator: UiEvaluator = {
  async rankMoves(pos, dice, plies = 1) {
    const { moves } = await post<{ moves: RankedMove[] }>({ ...encode(pos), dice, plies })
    return moves
  },
  async cubeDecision(pos, cube) {
    const { cube: analysis } = await post<{ cube: CubeAnalysis }>({ ...encode(pos), cube })
    return analysis
  },
}
