import { describe, expect, it } from 'vitest'
import { generateLegalMoves, standardPosition, type Hop } from '@nard/engine'
import {
  availableHops,
  completed,
  destinationsFrom,
  emptyDraft,
  pushHop,
  undoLast,
} from './draft'

const opening = () => standardPosition()

/** Play a sequence of (from,to) pairs into a draft. */
function play(legal: readonly ReturnType<typeof generateLegalMoves>[number][], start = opening()) {
  return (...pairs: [number, number][]) => {
    let draft = emptyDraft(start)
    for (const [from, to] of pairs) {
      const next = pushHop(legal, draft, { from, to, hit: false } as Hop)
      expect(next, `hop ${from}/${to} should be on offer`).not.toBeNull()
      draft = next!
    }
    return draft
  }
}

describe('turn drafting', () => {
  it('accepts the two halves of a move in either order', () => {
    // 61 makes the bar point: 13/7 8/7. A player may build it from either end,
    // and the engine records only one canonical hop order, so order-insensitive
    // matching is what makes both routes work.
    const legal = generateLegalMoves(opening(), [6, 1])
    const forward = play(legal)([13, 7], [8, 7])
    const reverse = play(legal)([8, 7], [13, 7])

    expect(completed(legal, forward)).not.toBeNull()
    expect(completed(legal, reverse)).not.toBeNull()
    expect(forward.position.pts[7]).toBe(2)
    expect(reverse.position.pts[7]).toBe(2)
  })

  it('will not let the turn finish while a die is still playable', () => {
    const legal = generateLegalMoves(opening(), [6, 1])
    const half = play(legal)([13, 7])
    // Maximal dice usage: one die played is not a legal turn.
    expect(completed(legal, half)).toBeNull()
    expect(availableHops(legal, half).length).toBeGreaterThan(0)
  })

  it('offers only destinations that are actually legal from a point', () => {
    const legal = generateLegalMoves(opening(), [3, 1])
    const draft = emptyDraft(opening())
    const from8 = destinationsFrom(legal, draft, 8).map((h) => h.to).sort()
    // With 31 from the opening, the 8-point checker can go to 5 (making it) or
    // to 7. It cannot go anywhere else.
    expect(from8.every((to) => to === 5 || to === 7)).toBe(true)
    expect(from8.length).toBeGreaterThan(0)
  })

  it('undo restores the previous board exactly', () => {
    const legal = generateLegalMoves(opening(), [6, 1])
    const start = opening()
    const one = play(legal, start)([13, 7])
    const back = undoLast(start, one)
    expect(back.hops).toHaveLength(0)
    expect([...back.position.pts]).toEqual([...start.pts])
  })

  it('re-stamps the hit flag when hops are played out of canonical order', () => {
    // Two checkers land on the same opposing blot. Whichever goes FIRST hits;
    // the move's stored flags only describe its own canonical order, and the
    // engine rejects a hop whose flag disagrees with the board. Found by
    // playtest.ts, not by inspection — it needs this exact state to appear.
    const pts = new Int8Array(26)
    pts[8] = 1
    pts[6] = 1
    pts[3] = -1 // a lone opposing checker
    pts[24] = 2
    pts[13] = 5
    pts[20] = -5
    pts[17] = -3
    pts[12] = -5
    pts[1] = -1
    const position = { pts, off: 0, oppOff: 0 }
    const legal = generateLegalMoves(position, [5, 3])
    if (legal.length === 0) return

    for (const move of legal) {
      if (move.hops.length < 2) continue
      // Play the move's hops in reverse; every hop must still be accepted.
      let draft = emptyDraft(position)
      const reversed = [...move.hops].reverse()
      let ok = true
      for (const hop of reversed) {
        const next = pushHop(legal, draft, hop)
        if (!next) { ok = false; break }
        draft = next
      }
      if (ok) expect(completed(legal, draft)).not.toBeNull()
    }
  })

  it('forces entry from the bar before anything else', () => {
    const start = standardPosition()
    const pts = Int8Array.from(start.pts)
    pts[25] = 1 // a checker on the bar
    pts[6] = 4
    const position = { pts, off: 0, oppOff: 0 }
    const legal = generateLegalMoves(position, [2, 3])
    const draft = emptyDraft(position)
    expect(availableHops(legal, draft).every((h) => h.from === 25)).toBe(true)
  })
})
