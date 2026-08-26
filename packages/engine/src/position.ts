import { BAR, type Position, type WinKind } from './types.js'

export interface PipCounts {
  readonly player: number
  readonly opponent: number
}

/** The standard 15-checker starting position, from the player-on-roll's view. */
export function standardPosition(): Position {
  const pts = new Int8Array(26)

  pts[24] = 2
  pts[13] = 5
  pts[8] = 3
  pts[6] = 5

  pts[1] = -2
  pts[12] = -5
  pts[17] = -3
  pts[19] = -5

  return { pts, off: 0, oppOff: 0 }
}

export function clonePosition(position: Position): Position {
  return {
    pts: new Int8Array(position.pts),
    off: position.off,
    oppOff: position.oppOff,
  }
}

/** Switch the point of view to the opponent. */
export function mirror(position: Position): Position {
  const pts = new Int8Array(26)

  for (let point = 0; point <= BAR; point += 1) {
    pts[point] = -(position.pts[BAR - point] ?? 0)
  }

  return {
    pts,
    off: position.oppOff,
    oppOff: position.off,
  }
}

export function positionEquals(left: Position, right: Position): boolean {
  if (left.off !== right.off || left.oppOff !== right.oppOff) return false

  for (let point = 0; point <= BAR; point += 1) {
    if (left.pts[point] !== right.pts[point]) return false
  }

  return true
}

/** Stable internal key used only for equality and move deduplication. */
export function positionKey(position: Position): string {
  return `${position.off}/${position.oppOff}/${Array.from(position.pts).join(',')}`
}

export function pipCount(position: Position): PipCounts {
  let player = (position.pts[BAR] ?? 0) * BAR
  let opponent = -(position.pts[0] ?? 0) * BAR

  for (let point = 1; point < BAR; point += 1) {
    const count = position.pts[point] ?? 0
    if (count > 0) player += count * point
    if (count < 0) opponent += -count * (BAR - point)
  }

  return { player, opponent }
}

/** Classify a win by the player represented by positive checkers. */
export function winKind(position: Position): WinKind | null {
  if (position.off < 15) return null
  if (position.oppOff > 0) return 'single'

  if ((position.pts[0] ?? 0) < 0) return 'backgammon'

  for (let point = 1; point <= 6; point += 1) {
    if ((position.pts[point] ?? 0) < 0) return 'backgammon'
  }

  return 'gammon'
}

export function assertValidPosition(position: Position): void {
  if (position.pts.length !== 26) {
    throw new RangeError('a position must contain exactly 26 point slots')
  }
  if (!Number.isInteger(position.off) || position.off < 0 || position.off > 15) {
    throw new RangeError('off must be an integer from 0 to 15')
  }
  if (
    !Number.isInteger(position.oppOff) ||
    position.oppOff < 0 ||
    position.oppOff > 15
  ) {
    throw new RangeError('oppOff must be an integer from 0 to 15')
  }
  if ((position.pts[0] ?? 0) > 0 || (position.pts[BAR] ?? 0) < 0) {
    throw new RangeError('bar slots have the wrong sign')
  }

  let player = position.off
  let opponent = position.oppOff
  for (let point = 0; point <= BAR; point += 1) {
    const count = position.pts[point] ?? 0
    if (count > 0) player += count
    if (count < 0) opponent -= count
  }

  if (player !== 15 || opponent !== 15) {
    throw new RangeError('a standard position must contain exactly 15 checkers per side')
  }
}
