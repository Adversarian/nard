import { BAR, OFF, type Dice, type Die, type Hop, type Move, type Position } from './types.js'
import { clonePosition, positionKey } from './position.js'

interface MoveCandidate {
  readonly move: Move
  readonly position: Position
  readonly used: readonly Die[]
}

function canBearOff(position: Position): boolean {
  if ((position.pts[BAR] ?? 0) > 0) return false

  for (let point = 7; point < BAR; point += 1) {
    if ((position.pts[point] ?? 0) > 0) return false
  }

  return true
}

function mayOvershoot(position: Position, from: number): boolean {
  for (let point = from + 1; point <= 6; point += 1) {
    if ((position.pts[point] ?? 0) > 0) return false
  }

  return true
}

function legalHopsForDie(position: Position, die: Die): readonly Hop[] {
  const sources: number[] = []

  if ((position.pts[BAR] ?? 0) > 0) {
    sources.push(BAR)
  } else {
    for (let point = 24; point >= 1; point -= 1) {
      if ((position.pts[point] ?? 0) > 0) sources.push(point)
    }
  }

  const bearingOff = canBearOff(position)
  const hops: Hop[] = []

  for (const from of sources) {
    const destination = from - die

    if (destination <= OFF) {
      if (
        from !== BAR &&
        bearingOff &&
        (destination === OFF || mayOvershoot(position, from))
      ) {
        hops.push({ from, to: OFF, hit: false })
      }
      continue
    }

    const destinationCount = position.pts[destination] ?? 0
    if (destinationCount <= -2) continue

    hops.push({
      from,
      to: destination,
      hit: destinationCount === -1,
    })
  }

  return hops
}

function applyHop(position: Position, hop: Hop): Position {
  if (!Number.isInteger(hop.from) || hop.from < 1 || hop.from > BAR) {
    throw new RangeError(`invalid hop source: ${hop.from}`)
  }
  if (!Number.isInteger(hop.to) || hop.to < OFF || hop.to >= BAR) {
    throw new RangeError(`invalid hop destination: ${hop.to}`)
  }
  if (hop.to >= hop.from) {
    throw new RangeError('the player on roll must move from high points toward low')
  }
  if ((position.pts[hop.from] ?? 0) <= 0) {
    throw new Error(`no player checker at point ${hop.from}`)
  }

  const result = clonePosition(position)
  result.pts[hop.from] = (result.pts[hop.from] ?? 0) - 1

  if (hop.to === OFF) {
    return {
      pts: result.pts,
      off: result.off + 1,
      oppOff: result.oppOff,
    }
  }

  const destinationCount = result.pts[hop.to] ?? 0
  if (destinationCount <= -2) {
    throw new Error(`point ${hop.to} is blocked`)
  }
  if ((destinationCount === -1) !== hop.hit) {
    throw new Error(`hop hit flag does not match point ${hop.to}`)
  }

  if (hop.hit) {
    result.pts[hop.to] = 0
    result.pts[0] = (result.pts[0] ?? 0) - 1
  }
  result.pts[hop.to] = (result.pts[hop.to] ?? 0) + 1

  return result
}

function pointName(point: number): string {
  if (point === BAR) return 'bar'
  if (point === OFF) return 'off'
  return String(point)
}

function formatMove(hops: readonly Hop[]): string {
  return hops
    .map((hop) => `${pointName(hop.from)}/${pointName(hop.to)}${hop.hit ? '*' : ''}`)
    .join(' ')
}

function removeDie(dice: readonly Die[], index: number): readonly Die[] {
  return [...dice.slice(0, index), ...dice.slice(index + 1)]
}

function collectCandidates(
  position: Position,
  remaining: readonly Die[],
  hops: readonly Hop[],
  used: readonly Die[],
  candidates: MoveCandidate[],
): void {
  let continued = false
  const considered = new Set<Die>()

  for (let index = 0; index < remaining.length; index += 1) {
    const die = remaining[index]
    if (die === undefined || considered.has(die)) continue
    considered.add(die)

    const legalHops = legalHopsForDie(position, die)
    if (legalHops.length === 0) continue
    continued = true

    for (const hop of legalHops) {
      collectCandidates(
        applyHop(position, hop),
        removeDie(remaining, index),
        [...hops, hop],
        [...used, die],
        candidates,
      )
    }
  }

  if (!continued) {
    candidates.push({
      move: { hops, notation: formatMove(hops) },
      position,
      used,
    })
  }
}

/** Generate every distinct legal resulting position for a roll. */
export function generateLegalMoves(position: Position, dice: Dice): readonly Move[] {
  const remaining: Die[] =
    dice[0] === dice[1]
      ? [dice[0], dice[0], dice[0], dice[0]]
      : [dice[0], dice[1]]

  const candidates: MoveCandidate[] = []
  collectCandidates(position, remaining, [], [], candidates)

  const maximumUsage = Math.max(...candidates.map((candidate) => candidate.used.length))
  if (maximumUsage === 0) return []

  let filtered = candidates.filter(
    (candidate) => candidate.used.length === maximumUsage,
  )

  if (maximumUsage === 1 && dice[0] !== dice[1]) {
    const largestPlayedDie = Math.max(
      ...filtered.map((candidate) => candidate.used[0] ?? 0),
    )
    filtered = filtered.filter(
      (candidate) => candidate.used[0] === largestPlayedDie,
    )
  }

  const byResult = new Map<string, MoveCandidate>()
  for (const candidate of filtered) {
    const key = positionKey(candidate.position)
    const previous = byResult.get(key)
    if (previous === undefined || candidate.move.notation < previous.move.notation) {
      byResult.set(key, candidate)
    }
  }

  return [...byResult.values()]
    .map((candidate) => candidate.move)
    .sort((left, right) =>
      left.notation < right.notation ? -1 : left.notation > right.notation ? 1 : 0,
    )
}

/** Apply a complete move. Dice legality is enforced by generateLegalMoves. */
export function applyMove(position: Position, move: Move): Position {
  let result = position
  for (const hop of move.hops) result = applyHop(result, hop)
  return result
}
