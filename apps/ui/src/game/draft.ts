/**
 * Turn drafting.
 *
 * The engine models a move as a whole turn, which is correct — in backgammon a
 * "move" IS the turn, and legality (maximal dice usage, the larger-die rule)
 * only makes sense at that granularity.
 *
 * But a player does not think in whole turns. He plays one die, looks at the
 * board, and often takes it back. Convention allows exactly that: nothing is
 * committed until the dice are picked up. So partial-turn state lives here, in
 * the UI layer, and the engine only ever sees complete legal moves.
 *
 * This is not gold-plating. Being unable to try a checker and reconsider is the
 * single most irritating thing a backgammon program can do to a strong player.
 */

import { applyMove, type Hop, type Move, type Position } from '@nard/engine'

export interface Draft {
  /** Hops the player has committed so far this turn, in the order played. */
  readonly hops: readonly Hop[]
  /** The board as it currently looks, mid-turn. */
  readonly position: Position
}

const key = (h: Pick<Hop, 'from' | 'to'>) => `${h.from}>${h.to}`

/**
 * Remove `played` from `all` as a multiset, or return null when `played` is not
 * contained in it.
 *
 * Matching is by (from, to) and ignores ORDER, because the engine deduplicates
 * moves by resulting position and so records only one canonical hop order.
 * A player who plays `8/7` before `13/7` is making the same move as one who
 * plays them the other way round, and must not be told otherwise.
 */
function subtract(all: readonly Hop[], played: readonly Hop[]): Hop[] | null {
  const pool = [...all]
  for (const h of played) {
    const i = pool.findIndex((c) => key(c) === key(h))
    if (i === -1) return null
    pool.splice(i, 1)
  }
  return pool
}

/** The complete legal moves still consistent with what has been played. */
export function candidates(
  legal: readonly Move[],
  draft: Draft,
): { move: Move; rest: Hop[] }[] {
  const out: { move: Move; rest: Hop[] }[] = []
  for (const move of legal) {
    const rest = subtract(move.hops, draft.hops)
    if (rest !== null) out.push({ move, rest })
  }
  return out
}

/**
 * Whether landing on `to` hits, judged against the board RIGHT NOW.
 *
 * A Move's stored hit flags describe its own canonical hop order. Play the same
 * hops in a different order and the flags are wrong: when two checkers land on
 * the same blot, whichever goes first does the hitting. The engine validates the
 * flag, so it must be recomputed rather than copied.
 */
function hitsNow(position: Position, to: number): boolean {
  return to > 0 && (position.pts[to] ?? 0) === -1
}

/** Re-stamp a hop's hit flag for the board as it stands now. */
function forNow(position: Position, hop: Hop): Hop {
  return { from: hop.from, to: hop.to, hit: hitsNow(position, hop.to) }
}

/** True when a hop can physically be played on the board as it stands now. */
function playableNow(position: Position, hop: Hop): boolean {
  const pts = position.pts
  const onBar = (pts[25] ?? 0) > 0
  if (onBar && hop.from !== 25) return false
  if ((pts[hop.from] ?? 0) <= 0) return false
  if (hop.to <= 0) return true // bearing off; legality already vetted upstream
  return (pts[hop.to] ?? 0) >= -1
}

/**
 * Every hop the player may make next, given what is already drafted.
 *
 * A hop is offered only if it appears in some still-reachable complete move AND
 * is playable on the current board — the second check matters because hop order
 * can matter (a point may be blocked until a hit clears it).
 */
export function availableHops(legal: readonly Move[], draft: Draft): Hop[] {
  const seen = new Map<string, Hop>()
  for (const { rest } of candidates(legal, draft)) {
    for (const hop of rest) {
      if (!playableNow(draft.position, hop)) continue
      if (!seen.has(key(hop))) seen.set(key(hop), forNow(draft.position, hop))
    }
  }
  return [...seen.values()]
}

/** Destinations reachable from a given point, for highlighting. */
export function destinationsFrom(
  legal: readonly Move[],
  draft: Draft,
  from: number,
): Hop[] {
  return availableHops(legal, draft).filter((h) => h.from === from)
}

/** Points the player may pick a checker up from. */
export function movableFrom(legal: readonly Move[], draft: Draft): number[] {
  return [...new Set(availableHops(legal, draft).map((h) => h.from))]
}

/** Play one hop into the draft. Returns null if the hop is not on offer. */
export function pushHop(
  legal: readonly Move[],
  draft: Draft,
  hop: Hop,
): Draft | null {
  const offered = availableHops(legal, draft).find((h) => key(h) === key(hop))
  if (!offered) return null
  return {
    hops: [...draft.hops, offered],
    position: applyMove(draft.position, { hops: [offered], notation: '' }),
  }
}

/**
 * The completed move, if the draft now amounts to one.
 *
 * A turn is finished when some candidate has nothing left to play. Until then
 * the player still owes the dice a move and the turn cannot be committed —
 * which is exactly the maximal-usage rule, enforced for free by only ever
 * offering hops drawn from complete legal moves.
 */
export function completed(legal: readonly Move[], draft: Draft): Move | null {
  return candidates(legal, draft).find((c) => c.rest.length === 0)?.move ?? null
}

/** True when the player has drafted something but cannot finish the turn. */
export function stuck(legal: readonly Move[], draft: Draft): boolean {
  return draft.hops.length > 0 && availableHops(legal, draft).length === 0 &&
    completed(legal, draft) === null
}

export function emptyDraft(position: Position): Draft {
  return { hops: [], position }
}

/** Undo the last hop by replaying from the start — positions are immutable. */
export function undoLast(start: Position, draft: Draft): Draft {
  const hops = draft.hops.slice(0, -1)
  let position = start
  for (const hop of hops) {
    position = applyMove(position, { hops: [hop], notation: '' })
  }
  return { hops, position }
}
