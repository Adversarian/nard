import type {
  Dice,
  DiceSource,
  GameResult,
  GameState,
  MatchState,
  Move,
  PlayerId,
  Variant,
  WinKind,
} from './types.js'
import { applyMove, generateLegalMoves } from './moves.js'
import { mirror, positionKey, standardPosition, winKind } from './position.js'

export interface MatchOptions {
  /** Points to win. Zero creates money play. */
  readonly length?: number
  readonly score?: Partial<Readonly<Record<PlayerId, number>>>
  readonly crawfordUsed?: boolean
  /** Money play only; defaults off. */
  readonly jacoby?: boolean
}

export interface RulesConfig {
  readonly variant?: Variant
  /** Double the centred cube after tied opening rolls. Defaults off. */
  readonly automaticDoubles?: boolean
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 'light' ? 'dark' : 'light'
}

function validateRules(rules: RulesConfig): void {
  if ((rules.variant ?? 'standard') !== 'standard') {
    throw new Error(`variant ${rules.variant} is reserved for a later milestone`)
  }
}

function isOneAway(match: Pick<MatchState, 'length' | 'score'>): boolean {
  return (
    match.length > 0 &&
    (match.score.light === match.length - 1 ||
      match.score.dark === match.length - 1)
  )
}

export function createMatchState(options: MatchOptions = {}): MatchState {
  const length = options.length ?? 7
  if (!Number.isInteger(length) || length < 0 || (length > 0 && length % 2 === 0)) {
    throw new RangeError('match length must be zero (money play) or a positive odd number')
  }

  const score = {
    light: options.score?.light ?? 0,
    dark: options.score?.dark ?? 0,
  }
  for (const points of Object.values(score)) {
    if (!Number.isInteger(points) || points < 0) {
      throw new RangeError('scores must be non-negative integers')
    }
    if (length > 0 && points >= length) {
      throw new RangeError('cannot start a game after a player has won the match')
    }
  }

  const crawfordUsed = options.crawfordUsed ?? false
  const crawford =
    length > 0 && !crawfordUsed && isOneAway({ length, score })
  const jacoby = length === 0 ? (options.jacoby ?? false) : false

  return { length, score, crawford, crawfordUsed, jacoby }
}

export function createGameState(match: MatchState = createMatchState()): GameState {
  return {
    position: standardPosition(),
    onRoll: 'light',
    dice: null,
    remaining: [],
    cube: { value: 1, owner: null },
    match,
    phase: 'opening-roll',
    result: null,
  }
}

function validateDice(dice: Dice): void {
  for (const die of dice) {
    if (!Number.isInteger(die) || die < 1 || die > 6) {
      throw new RangeError('dice must contain values from 1 to 6')
    }
  }
}

function expandedDice(dice: Dice): readonly Dice[number][] {
  return dice[0] === dice[1]
    ? [dice[0], dice[0], dice[0], dice[0]]
    : [dice[0], dice[1]]
}

function automaticDoubleAllowed(state: GameState, rules: RulesConfig): boolean {
  if (!rules.automaticDoubles || state.match.crawford) return false
  return state.match.length === 0 || !state.match.crawfordUsed
}

export function rollGame(
  state: GameState,
  dice: Dice,
  rules: RulesConfig = {},
): GameState {
  validateRules(rules)
  validateDice(dice)

  if (state.phase !== 'opening-roll' && state.phase !== 'to-roll') {
    throw new Error(`cannot roll during phase ${state.phase}`)
  }

  if (state.phase === 'opening-roll') {
    if (dice[0] === dice[1]) {
      return automaticDoubleAllowed(state, rules)
        ? {
            ...state,
            cube: { value: state.cube.value * 2, owner: null },
          }
        : state
    }

    const winner: PlayerId = dice[0] > dice[1] ? 'light' : 'dark'
    const winnerDice: Dice =
      winner === 'light' ? dice : [dice[1], dice[0]]

    return {
      ...state,
      position:
        winner === state.onRoll ? state.position : mirror(state.position),
      onRoll: winner,
      dice: winnerDice,
      remaining: expandedDice(winnerDice),
      phase: 'to-move',
    }
  }

  return {
    ...state,
    dice,
    remaining: expandedDice(dice),
    phase: 'to-move',
  }
}

export function rollFromSource(
  state: GameState,
  source: DiceSource,
  rollNumber: number,
  rules: RulesConfig = {},
): GameState {
  if (!Number.isInteger(rollNumber) || rollNumber < 0) {
    throw new RangeError('roll number must be a non-negative integer')
  }
  return rollGame(state, source.roll(rollNumber), rules)
}

export function legalMoves(state: GameState): readonly Move[] {
  if (state.phase !== 'to-move' || state.dice === null) return []
  return generateLegalMoves(state.position, state.dice)
}

function scoredPoints(
  state: GameState,
  kind: WinKind,
  endedByPass: boolean,
): number {
  if (endedByPass) return state.cube.value

  const jacobySuppressesBonus =
    state.match.length === 0 &&
    state.match.jacoby &&
    state.cube.owner === null
  const multiplier =
    jacobySuppressesBonus ? 1 : kind === 'single' ? 1 : kind === 'gammon' ? 2 : 3

  return state.cube.value * multiplier
}

function finishGame(
  state: GameState,
  winner: PlayerId,
  kind: WinKind,
  endedByPass = false,
): GameState {
  const points = scoredPoints(state, kind, endedByPass)
  const score = {
    ...state.match.score,
    [winner]: state.match.score[winner] + points,
  }
  const match = {
    ...state.match,
    score,
    crawfordUsed: state.match.crawfordUsed || state.match.crawford,
  }
  const result: GameResult = { winner, kind, points }
  const matchOver = match.length > 0 && score[winner] >= match.length

  return {
    ...state,
    dice: null,
    remaining: [],
    match,
    phase: matchOver ? 'match-over' : 'game-over',
    result,
  }
}

export function playMove(state: GameState, move: Move): GameState {
  if (state.phase !== 'to-move' || state.dice === null) {
    throw new Error(`cannot move during phase ${state.phase}`)
  }

  const requestedPosition = applyMove(state.position, move)
  const requestedKey = positionKey(requestedPosition)
  const legal = generateLegalMoves(state.position, state.dice)
  const legalMove = legal.find(
    (candidate) =>
      positionKey(applyMove(state.position, candidate)) === requestedKey,
  )
  if (legalMove === undefined) throw new Error('move is not legal for the current roll')

  const position = applyMove(state.position, legalMove)
  const kind = winKind(position)
  if (kind !== null) {
    return finishGame({ ...state, position }, state.onRoll, kind)
  }

  return {
    ...state,
    position: mirror(position),
    onRoll: otherPlayer(state.onRoll),
    dice: null,
    remaining: [],
    phase: 'to-roll',
  }
}

/** End a turn when the roll has no legal checker play. */
export function passTurn(state: GameState): GameState {
  if (state.phase !== 'to-move' || state.dice === null) {
    throw new Error(`cannot pass during phase ${state.phase}`)
  }
  if (generateLegalMoves(state.position, state.dice).length > 0) {
    throw new Error('cannot pass while a legal move exists')
  }

  return {
    ...state,
    position: mirror(state.position),
    onRoll: otherPlayer(state.onRoll),
    dice: null,
    remaining: [],
    phase: 'to-roll',
  }
}

export function canDouble(state: GameState): boolean {
  return (
    state.phase === 'to-roll' &&
    !state.match.crawford &&
    (state.cube.owner === null || state.cube.owner === state.onRoll)
  )
}

export function offerDouble(state: GameState): GameState {
  if (!canDouble(state)) throw new Error('the doubling cube is not available')
  return { ...state, phase: 'cube-offered' }
}

export function takeDouble(state: GameState): GameState {
  if (state.phase !== 'cube-offered') {
    throw new Error(`cannot take during phase ${state.phase}`)
  }

  return {
    ...state,
    cube: {
      value: state.cube.value * 2,
      owner: otherPlayer(state.onRoll),
    },
    phase: 'to-roll',
  }
}

export function passDouble(state: GameState): GameState {
  if (state.phase !== 'cube-offered') {
    throw new Error(`cannot pass a cube during phase ${state.phase}`)
  }
  return finishGame(state, state.onRoll, 'single', true)
}

export function startNextGame(
  state: GameState,
  rules: RulesConfig = {},
): GameState {
  validateRules(rules)
  if (state.phase !== 'game-over') {
    throw new Error(`cannot start another game during phase ${state.phase}`)
  }

  const match = {
    ...state.match,
    crawford:
      state.match.length > 0 &&
      !state.match.crawfordUsed &&
      isOneAway(state.match),
  }

  return createGameState(match)
}
