import type {
  CubeState,
  Dice,
  Die,
  GameState,
  PlayerId,
  Position,
} from './types.js'
import { assertValidPosition } from './position.js'

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export type GnuGameState =
  | 'none'
  | 'playing'
  | 'game-over'
  | 'resigned'
  | 'drop'

export interface GnuMatchIdState {
  readonly dice: readonly [Die | 0, Die | 0]
  readonly onRoll: PlayerId
  readonly decisionPlayer: PlayerId
  readonly resignation: 0 | 1 | 2 | 3
  readonly cubeOffered: boolean
  readonly cube: CubeState
  readonly crawford: boolean
  readonly matchLength: number
  readonly score: Readonly<Record<PlayerId, number>>
  readonly jacoby: boolean
  readonly gameState: GnuGameState
}

function encodeBase64(bytes: Uint8Array): string {
  let result = ''
  let buffer = 0
  let bits = 0

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8

    while (bits >= 6) {
      bits -= 6
      result += BASE64[(buffer >> bits) & 0x3f]
      buffer &= (1 << bits) - 1
    }
  }

  if (bits > 0) result += BASE64[(buffer << (6 - bits)) & 0x3f]
  return result
}

function decodeBase64(encoded: string, byteLength: number): Uint8Array {
  const expectedLength = Math.ceil((byteLength * 8) / 6)
  if (encoded.length !== expectedLength) {
    throw new RangeError(`expected a ${expectedLength}-character GNU identifier`)
  }

  const bytes = new Uint8Array(byteLength)
  let byteIndex = 0
  let buffer = 0
  let bits = 0

  for (const character of encoded) {
    const value = BASE64.indexOf(character)
    if (value < 0) throw new Error(`invalid base64 character: ${character}`)

    buffer = (buffer << 6) | value
    bits += 6

    if (bits >= 8) {
      bits -= 8
      if (byteIndex < byteLength) {
        bytes[byteIndex] = (buffer >> bits) & 0xff
        byteIndex += 1
      }
      buffer &= (1 << bits) - 1
    }
  }

  if (byteIndex !== byteLength || buffer !== 0) {
    throw new Error('GNU identifier has non-zero padding bits')
  }

  return bytes
}

function checkerBoards(position: Position): readonly [number[], number[]] {
  const opponent = new Array<number>(25).fill(0)
  const player = new Array<number>(25).fill(0)

  for (let point = 1; point <= 24; point += 1) {
    const count = position.pts[point] ?? 0
    if (count > 0) player[point - 1] = count
    if (count < 0) opponent[24 - point] = -count
  }
  opponent[24] = -(position.pts[0] ?? 0)
  player[24] = position.pts[25] ?? 0

  return [opponent, player]
}

export function encodePositionId(position: Position): string {
  assertValidPosition(position)
  const bytes = new Uint8Array(10)
  let bit = 0

  for (const board of checkerBoards(position)) {
    for (const count of board) {
      for (let checker = 0; checker < count; checker += 1) {
        if (bit >= 80) throw new Error('position does not fit a GNU Position ID')
        bytes[Math.floor(bit / 8)]! |= 1 << (bit % 8)
        bit += 1
      }
      bit += 1
    }
  }

  if (bit > 80) throw new Error('position does not fit a GNU Position ID')
  return encodeBase64(bytes)
}

export function decodePositionId(id: string): Position {
  const bytes = decodeBase64(id, 10)
  const boards = [new Array<number>(25).fill(0), new Array<number>(25).fill(0)]
  let bit = 0

  for (const board of boards) {
    for (let point = 0; point < 25; point += 1) {
      let count = 0
      while (bit < 80 && ((bytes[Math.floor(bit / 8)]! >> (bit % 8)) & 1) === 1) {
        count += 1
        bit += 1
      }
      if (bit >= 80) throw new Error('invalid GNU Position ID')
      board[point] = count
      bit += 1
    }
  }

  const opponent = boards[0]!
  const player = boards[1]!
  const pts = new Int8Array(26)

  for (let point = 1; point <= 24; point += 1) {
    const playerCount = player[point - 1] ?? 0
    const opponentCount = opponent[24 - point] ?? 0
    if (playerCount > 0 && opponentCount > 0) {
      throw new Error(`both players occupy point ${point}`)
    }
    pts[point] = playerCount - opponentCount
  }
  pts[0] = -(opponent[24] ?? 0)
  pts[25] = player[24] ?? 0

  const playerOnBoard = player.reduce((sum, count) => sum + count, 0)
  const opponentOnBoard = opponent.reduce((sum, count) => sum + count, 0)
  if (playerOnBoard > 15 || opponentOnBoard > 15) {
    throw new Error('GNU Position ID contains more than 15 checkers for a side')
  }

  const position: Position = {
    pts,
    off: 15 - playerOnBoard,
    oppOff: 15 - opponentOnBoard,
  }
  assertValidPosition(position)

  if (encodePositionId(position) !== id) {
    throw new Error('non-canonical GNU Position ID')
  }

  return position
}

function setBits(
  bytes: Uint8Array,
  bitPosition: number,
  bitCount: number,
  value: number,
): void {
  for (let index = 0; index < bitCount; index += 1) {
    const bit = (value >> index) & 1
    const position = bitPosition + index
    if (bit === 1) bytes[Math.floor(position / 8)]! |= 1 << (position % 8)
  }
}

function getBits(bytes: Uint8Array, bitPosition: number, bitCount: number): number {
  let value = 0
  for (let index = 0; index < bitCount; index += 1) {
    const position = bitPosition + index
    const bit = (bytes[Math.floor(position / 8)]! >> (position % 8)) & 1
    value |= bit << index
  }
  return value
}

function playerNumber(player: PlayerId): 0 | 1 {
  return player === 'light' ? 0 : 1
}

function playerFromNumber(player: number): PlayerId {
  return player === 0 ? 'light' : 'dark'
}

function gameStateNumber(gameState: GnuGameState): number {
  return ['none', 'playing', 'game-over', 'resigned', 'drop'].indexOf(gameState)
}

function cubeExponent(value: number): number {
  if (!Number.isInteger(value) || value < 1 || (value & (value - 1)) !== 0) {
    throw new RangeError('cube value must be a positive power of two')
  }
  const exponent = Math.log2(value)
  if (exponent > 15) throw new RangeError('cube value is too large for a GNU Match ID')
  return exponent
}

function fromGameState(state: GameState): GnuMatchIdState {
  const gameState: GnuGameState =
    state.phase === 'game-over' || state.phase === 'match-over'
      ? 'game-over'
      : 'playing'

  return {
    dice: state.dice ?? [0, 0],
    onRoll: state.onRoll,
    decisionPlayer:
      state.phase === 'cube-offered'
        ? state.onRoll === 'light'
          ? 'dark'
          : 'light'
        : state.onRoll,
    resignation: 0,
    cubeOffered: state.phase === 'cube-offered',
    cube: state.cube,
    crawford: state.match.crawford,
    matchLength: state.match.length,
    score: state.match.score,
    jacoby: state.match.jacoby,
    gameState,
  }
}

export function encodeMatchId(state: GameState | GnuMatchIdState): string {
  const info = 'decisionPlayer' in state ? state : fromGameState(state)
  const bytes = new Uint8Array(9)
  const dice = [...info.dice].sort((left, right) => right - left)

  if (
    !Number.isInteger(info.matchLength) ||
    info.matchLength < 0 ||
    info.matchLength > 0x7fff
  ) {
    throw new RangeError('match length must fit in 15 bits')
  }
  for (const score of Object.values(info.score)) {
    if (!Number.isInteger(score) || score < 0 || score > 0x7fff) {
      throw new RangeError('match score must fit in 15 bits')
    }
  }

  setBits(bytes, 0, 4, cubeExponent(info.cube.value))
  setBits(
    bytes,
    4,
    2,
    info.cube.owner === null ? 3 : playerNumber(info.cube.owner),
  )
  setBits(bytes, 6, 1, playerNumber(info.onRoll))
  setBits(bytes, 7, 1, info.crawford ? 1 : 0)
  setBits(bytes, 8, 3, gameStateNumber(info.gameState))
  setBits(bytes, 11, 1, playerNumber(info.decisionPlayer))
  setBits(bytes, 12, 1, info.cubeOffered ? 1 : 0)
  setBits(bytes, 13, 2, info.resignation)
  setBits(bytes, 15, 3, dice[0] ?? 0)
  setBits(bytes, 18, 3, dice[1] ?? 0)
  setBits(bytes, 21, 15, info.matchLength)
  setBits(bytes, 36, 15, info.score.light)
  setBits(bytes, 51, 15, info.score.dark)
  // GNU's extended Match ID stores the inverse so old IDs default Jacoby on.
  setBits(bytes, 66, 1, info.jacoby ? 0 : 1)

  return encodeBase64(bytes)
}

export function decodeMatchId(id: string): GnuMatchIdState {
  const bytes = decodeBase64(id, 9)
  const gameStateCode = getBits(bytes, 8, 3)
  const gameState = ['none', 'playing', 'game-over', 'resigned', 'drop'][
    gameStateCode
  ] as GnuGameState | undefined
  if (gameState === undefined) throw new Error('invalid game-state code in GNU Match ID')

  const firstDie = getBits(bytes, 15, 3)
  const secondDie = getBits(bytes, 18, 3)
  if (firstDie > 6 || secondDie > 6) {
    throw new Error('invalid dice in GNU Match ID')
  }

  const cubeOwner = getBits(bytes, 4, 2)
  const matchLength = getBits(bytes, 21, 15)
  const score = {
    light: getBits(bytes, 36, 15),
    dark: getBits(bytes, 51, 15),
  }
  if (
    matchLength > 0 &&
    (score.light > matchLength || score.dark > matchLength)
  ) {
    throw new Error('score exceeds match length in GNU Match ID')
  }

  return {
    dice: [firstDie as Die | 0, secondDie as Die | 0],
    onRoll: playerFromNumber(getBits(bytes, 6, 1)),
    decisionPlayer: playerFromNumber(getBits(bytes, 11, 1)),
    resignation: getBits(bytes, 13, 2) as 0 | 1 | 2 | 3,
    cubeOffered: getBits(bytes, 12, 1) === 1,
    cube: {
      value: 2 ** getBits(bytes, 0, 4),
      owner:
        cubeOwner === 0 || cubeOwner === 1
          ? playerFromNumber(cubeOwner)
          : null,
    },
    crawford: getBits(bytes, 7, 1) === 1,
    matchLength,
    score,
    jacoby: getBits(bytes, 66, 1) === 0,
    gameState,
  }
}

/** Convenience type guard for callers importing dice from decoded IDs. */
export function hasRolledDice(
  dice: GnuMatchIdState['dice'],
): dice is Dice {
  return dice[0] !== 0 && dice[1] !== 0
}
