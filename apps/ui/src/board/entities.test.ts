import { describe, expect, it } from 'vitest'
import { entitiesFrom, layout, topEntityAt } from './entities'

describe('topEntityAt', () => {
  it('returns the checker painted on top of a stack', () => {
    const pts = new Array<number>(26).fill(0)
    pts[8] = 3
    const entities = entitiesFrom(pts.map((v, i) => (i === 8 ? v : 0)), 0, 0)
    const top = topEntityAt(entities, 8)
    expect(top).not.toBeNull()

    // "Top" must mean the one drawn last, or a drag lifts a checker from the
    // middle of the stack and the one the player sees stays put.
    const placements = layout(entities).filter((pl) => pl.entity.loc.kind === 'point')
    const highest = placements.reduce((a, b) => (b.z > a.z ? b : a))
    expect(top!.id).toBe(highest.entity.id)
  })

  it('finds the on-roll player on the bar, not the opponent', () => {
    const pts = new Array<number>(26).fill(0)
    pts[25] = 2
    pts[0] = -2
    const entities = entitiesFrom(pts, 0, 0)
    const top = topEntityAt(entities, 25)
    expect(top?.onRoll).toBe(true)
  })

  it('is null on an empty point', () => {
    expect(topEntityAt(entitiesFrom(new Array<number>(26).fill(0), 0, 0), 8)).toBeNull()
  })
})
