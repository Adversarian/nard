/**
 * Engine frame → screen frame.
 *
 * The engine is perspective-relative: after every turn it mirrors the board so
 * the player on roll always moves 24→1 (AGENTS.md §5). That is exactly right for
 * move generation and exactly wrong for a screen — it would flip the board under
 * the player twice per round.
 *
 * So the UI keeps ONE absolute frame, the light player's, and converts at this
 * boundary. Nothing downstream of here knows the engine mirrors anything.
 */

import { mirror, type GameState, type Position } from '@nard/engine'
import type { Side } from '../board/Checker'
import type { CheckerEntity, Loc } from '../board/entities'

/** The board as the light player always sees it, whoever is on roll. */
export function toAbsolute(position: Position, onRoll: GameState['onRoll']): Position {
  return onRoll === 'light' ? position : mirror(position)
}

interface Slot {
  loc: Loc
  side: Side
}

function slotsFor(abs: Position): Slot[] {
  const out: Slot[] = []
  for (let p = 1; p <= 24; p++) {
    const v = abs.pts[p] ?? 0
    for (let k = 0; k < Math.abs(v); k++) {
      out.push({ loc: { kind: 'point', point: p }, side: v > 0 ? 'light' : 'dark' })
    }
  }
  for (let k = 0; k < (abs.pts[25] ?? 0); k++) out.push({ loc: { kind: 'bar' }, side: 'light' })
  for (let k = 0; k < Math.abs(abs.pts[0] ?? 0); k++) out.push({ loc: { kind: 'bar' }, side: 'dark' })
  for (let k = 0; k < abs.off; k++) out.push({ loc: { kind: 'off' }, side: 'light' })
  for (let k = 0; k < abs.oppOff; k++) out.push({ loc: { kind: 'off' }, side: 'dark' })
  return out
}

const slotKey = (s: Slot) =>
  `${s.side}:${s.loc.kind}${s.loc.kind === 'point' ? s.loc.point : ''}`

/**
 * Carry checker identity across a position change.
 *
 * Rebuilding entities from scratch each time would reassign every id, and motion
 * would animate all thirty checkers instead of the one that moved. So checkers
 * that are still where they were keep their id, and only the genuinely displaced
 * ones get reassigned to the leftover slots.
 */
export function reconcile(prev: readonly CheckerEntity[], abs: Position): CheckerEntity[] {
  const slots = slotsFor(abs)
  const pool = new Map<string, Slot[]>()
  for (const s of slots) {
    const k = slotKey(s)
    const list = pool.get(k) ?? []
    list.push(s)
    pool.set(k, list)
  }

  const kept: CheckerEntity[] = []
  const homeless: CheckerEntity[] = []
  for (const e of prev) {
    const k = slotKey({ loc: e.loc, side: e.side })
    const list = pool.get(k)
    if (list && list.length > 0) {
      list.pop()
      kept.push(e)
    } else {
      homeless.push(e)
    }
  }

  const spare: Slot[] = []
  for (const list of pool.values()) spare.push(...list)

  const moved = homeless.map((e, i) => {
    const slot = spare[i]
    return slot ? { ...e, loc: slot.loc, side: slot.side, onRoll: slot.side === 'light' } : e
  })

  // Extra slots with no entity to fill them (shouldn't happen once seeded, but
  // keeps the board honest if it ever does).
  const extra = spare.slice(homeless.length).map((s, i) => ({
    id: `x-${abs.off}-${abs.oppOff}-${i}`,
    side: s.side,
    onRoll: s.side === 'light',
    loc: s.loc,
  }))

  return [...kept, ...moved, ...extra]
}
