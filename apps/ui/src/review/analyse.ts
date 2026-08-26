/**
 * Running the analysis from the UI.
 *
 * Analysis is expensive — every decision is evaluated, and luck evaluates all
 * 21 distinct rolls at each one — so it runs on demand with progress rather
 * than silently blocking. Depth defaults to 1 ply, which is fast and good
 * enough to rank the moves he actually played; the depth is reported alongside
 * the numbers so nothing is claimed that was not computed.
 */

import { analyseMatch, type MatchAnalysis, type SavedMatchV1 } from '@nard/analysis'
import type { Evaluator } from '@nard/ai'
import { evaluator } from '../platform/evaluator'

export interface RunOptions {
  plies?: 0 | 1 | 2
  onProgress?: (done: number, total: number) => void
}

/** Adapt the UI's transport-agnostic evaluator to the analysis package's shape. */
const adapter: Evaluator = {
  rankMoves: (pos, dice, opts) => evaluator.rankMoves(pos, dice, opts?.plies ?? 1),
  cubeDecision: (pos, cube) => evaluator.cubeDecision(pos, cube),
  dispose: async () => {},
}

export async function runAnalysis(
  saved: SavedMatchV1,
  opts: RunOptions = {},
): Promise<MatchAnalysis> {
  const { plies = 1, onProgress } = opts
  return analyseMatch(saved, adapter, {
    plies,
    ...(onProgress
      ? { onProgress: (p) => onProgress(p.completed, p.total) }
      : {}),
  })
}
