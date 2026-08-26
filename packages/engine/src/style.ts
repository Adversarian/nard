import type { Dice, Die, Position, StyleFeatures } from './types.js'
import { generateLegalMoves } from './moves.js'
import { mirror, pipCount } from './position.js'

function made(position: Position, point: number): boolean {
  return (position.pts[point] ?? 0) >= 2
}

function longestPrime(position: Position): number {
  let longest = 0
  let current = 0

  for (let point = 1; point <= 24; point += 1) {
    current = made(position, point) ? current + 1 : 0
    longest = Math.max(longest, current)
  }

  return Math.min(longest, 6)
}

function trappedCheckers(position: Position): number {
  let maximum = 0
  let start = 1

  while (start <= 24) {
    if (!made(position, start)) {
      start += 1
      continue
    }

    let end = start
    while (end + 1 <= 24 && made(position, end + 1)) end += 1

    if (end - start + 1 >= 2) {
      let trapped = 0
      for (let point = 1; point < start; point += 1) {
        const count = position.pts[point] ?? 0
        if (count < 0) trapped -= count
      }
      maximum = Math.max(maximum, trapped)
    }

    start = end + 1
  }

  return maximum
}

function blotExposure(position: Position): number {
  const blots: number[] = []
  for (let point = 1; point <= 24; point += 1) {
    if ((position.pts[point] ?? 0) === 1) blots.push(point)
  }
  if (blots.length === 0) return 0

  const opponentPosition = mirror(position)
  let total = 0

  for (const blot of blots) {
    const opponentTarget = 25 - blot
    let hittingRolls = 0

    for (let first = 1; first <= 6; first += 1) {
      for (let second = 1; second <= 6; second += 1) {
        const dice = [first as Die, second as Die] as Dice
        const canHit = generateLegalMoves(opponentPosition, dice).some((move) =>
          move.hops.some((hop) => hop.hit && hop.to === opponentTarget),
        )
        if (canHit) hittingRolls += 1
      }
    }

    total += hittingRolls / 36
  }

  return total
}

function highestAnchor(position: Position): number {
  let anchor = 0

  for (let point = 19; point <= 24; point += 1) {
    if (made(position, point)) anchor = Math.max(anchor, 25 - point)
  }

  return anchor
}

export function styleFeatures(position: Position): StyleFeatures {
  let blots = 0
  let homePoints = 0

  for (let point = 1; point <= 24; point += 1) {
    if ((position.pts[point] ?? 0) === 1) blots += 1
    if (point <= 6 && made(position, point)) homePoints += 1
  }

  const pips = pipCount(position)

  return {
    primeLength: longestPrime(position),
    blots,
    blotExposure: blotExposure(position),
    trapped: trappedCheckers(position),
    raceLead: pips.opponent - pips.player,
    anchor: highestAnchor(position),
    homePoints,
    oppOnBar: -(position.pts[0] ?? 0),
  }
}
