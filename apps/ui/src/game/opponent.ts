/**
 * The opponent's turn.
 *
 * Two rules shape this, both about being followable rather than being fast:
 *
 * 1. **It pauses before moving.** An opponent that answers instantly reads as a
 *    lookup table, not a player. The pause is a floor, not an addition — a slow
 *    2-ply evaluation does not stack on top of it.
 * 2. **Multi-checker moves play one checker at a time.** Watching `13/7 8/7`
 *    happen simultaneously tells you the position changed but not what he did.
 *    Sequential, with a beat between, is legible.
 */

import { legalMoves, type GameState, type Move } from '@nard/engine'
import { selectRankedMove, type DifficultyRung, type Personality } from '@nard/ai'
import { evaluator } from '../platform/evaluator'

export interface OpponentConfig {
  readonly rung: DifficultyRung
  readonly personality: Personality
  /** Which side the opponent plays. The human is always 'light'. */
  readonly side: 'dark'
}

export const DEFAULT_OPPONENT: OpponentConfig = {
  rung: 4,
  personality: 'purist',
  side: 'dark',
}

/** Minimum time between the roll landing and the first checker moving. */
export const THINK_FLOOR_MS = 520
/** Gap between checkers within one turn. */
export const HOP_GAP_MS = 220

const PLIES: Record<DifficultyRung, 0 | 1 | 2> = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2 }

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Choose the opponent's move. Falls back to the engine's own first legal move if
 * the evaluator is unreachable, so a dead sidecar slows the opponent down rather
 * than stopping the game — see the silent-fallback note in docs/ai-spec.md.
 */
export async function chooseOpponentMove(
  state: GameState,
  config: OpponentConfig,
): Promise<{ move: Move | null; degraded: boolean }> {
  const legal = legalMoves(state)
  if (legal.length === 0) return { move: null, degraded: false }
  if (legal.length === 1) return { move: legal[0]!, degraded: false }

  try {
    const ranked = await evaluator.rankMoves(state.position, state.dice!, PLIES[config.rung])
    const chosen = selectRankedMove(state.position, ranked, {
      rung: config.rung,
      personality: config.personality,
    })
    // Match the evaluator's move back to one of ours by notation, so the engine
    // still validates everything it plays.
    const norm = (s: string) => s.split(/\s+/).filter(Boolean).sort().join(' ')
    const target = norm(chosen.move.notation)
    const found = legal.find((m) => norm(m.notation) === target)
    return { move: found ?? legal[0]!, degraded: found === undefined }
  } catch {
    return { move: legal[0]!, degraded: true }
  }
}

export async function shouldOpponentDouble(
  state: GameState,
  config: OpponentConfig,
): Promise<boolean> {
  if (config.rung <= 1) return false
  try {
    const d = await evaluator.cubeDecision(state.position, state.cube)
    return d.action === 'double'
  } catch {
    return false
  }
}

export async function opponentTakesDouble(state: GameState): Promise<boolean> {
  try {
    const d = await evaluator.cubeDecision(state.position, state.cube)
    return d.response === 'take'
  } catch {
    return true // taking is the forgiving default; passing concedes points
  }
}
