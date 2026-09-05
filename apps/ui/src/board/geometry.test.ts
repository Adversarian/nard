import { describe, expect, it } from 'vitest'
import {
  BAR,
  BOARD_H,
  BOARD_W,
  FIELD_X,
  FIELD_Y,
  GEO,
  TRAY_CX,
  barCentre,
  checkerCentre,
  pointAt,
  pointGeom,
} from './geometry'

/**
 * `pointAt` is the inverse of `pointGeom`, and it has to stay that way.
 *
 * It is what decides where a dragged checker lands, and getting it wrong is
 * silent: the drop is legal, the animation plays, and the checker simply goes
 * somewhere the player did not aim. Nothing downstream can tell.
 */
describe('pointAt', () => {
  it('inverts pointGeom for every point', () => {
    for (let p = 1; p <= 24; p += 1) {
      const c = checkerCentre(p, 0, 1)
      expect(pointAt(c.x, c.y)).toBe(p)
    }
  })

  it('still finds the point near its tip, where the triangle is narrow', () => {
    for (let p = 1; p <= 24; p += 1) {
      const g = pointGeom(p)
      // Just short of the apex, and off to one side of the centre line — a
      // place the triangle itself does not cover but the player will aim at.
      const y = g.apexY - g.dir * 0.05
      expect(pointAt(g.x + GEO.u * 0.4, y)).toBe(p)
      expect(pointAt(g.x - GEO.u * 0.4, y)).toBe(p)
    }
  })

  it('finds the bar and the tray', () => {
    const b = barCentre(0, true)
    expect(pointAt(b.x, b.y)).toBe(BAR)
    expect(pointAt(TRAY_CX, FIELD_Y + GEO.innerH / 2)).toBe(0)
  })

  it('is null off the playing field', () => {
    expect(pointAt(FIELD_X - 0.2, FIELD_Y + 1)).toBeNull() // the frame
    expect(pointAt(BOARD_W / 2, FIELD_Y - 0.2)).toBeNull() // above the field
    expect(pointAt(BOARD_W / 2, BOARD_H + 1)).toBeNull() // below the board
  })

  it('never lands on the same point from both halves of the board', () => {
    // Top and bottom rows share every column, so an off-by-one in the
    // half-height test would map both to one point and silently halve the board.
    const seen = new Set<number>()
    for (let p = 1; p <= 24; p += 1) {
      const c = checkerCentre(p, 0, 1)
      const at = pointAt(c.x, c.y)
      expect(seen.has(at!)).toBe(false)
      seen.add(at!)
    }
    expect(seen.size).toBe(24)
  })
})
