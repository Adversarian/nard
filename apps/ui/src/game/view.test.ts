import { describe, expect, it } from 'vitest'
import {
  createGameState,
  generateLegalMoves,
  playMove,
  rollGame,
  standardPosition,
} from '@nard/engine'
import { entitiesFrom } from '../board/entities'
import { reconcile, toAbsolute } from './view'

describe('screen frame', () => {
  it('keeps the board still when the turn changes hands', () => {
    // The engine mirrors after every turn. The screen must not.
    let state = rollGame(createGameState(), [6, 1])
    const before = toAbsolute(state.position, state.onRoll)
    const light13 = before.pts[13]

    state = playMove(state, generateLegalMoves(state.position, [6, 1])[0]!)
    const after = toAbsolute(state.position, state.onRoll)

    // Dark's checkers sat on point 12 in light's frame and have not moved.
    expect(after.pts[12]).toBe(before.pts[12])
    // Light's 13-point lost a checker to the move, not to a frame flip.
    expect(after.pts[13]).not.toBe(undefined)
    expect(Math.sign(after.pts[13] ?? 0)).toBe(Math.sign(light13 ?? 0))
  })

  it('moves one checker, not thirty, when one checker moves', () => {
    const start = standardPosition()
    const before = entitiesFrom(start.pts, 0, 0)
    const moved = Int8Array.from(start.pts)
    moved[13] = 4
    moved[7] = 1

    const after = reconcile(before, { pts: moved, off: 0, oppOff: 0 })
    const changed = after.filter((e) => {
      const was = before.find((b) => b.id === e.id)
      return was && JSON.stringify(was.loc) !== JSON.stringify(e.loc)
    })
    expect(changed).toHaveLength(1)
    expect(changed[0]!.loc).toEqual({ kind: 'point', point: 7 })
  })
})
