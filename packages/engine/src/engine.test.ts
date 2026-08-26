import { createHash, createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  CommitRevealDiceSource,
  applyMove,
  canDouble,
  createGameState,
  createMatchState,
  decodeMatchId,
  decodePositionId,
  diceCommitment,
  encodeMatchId,
  encodePositionId,
  generateLegalMoves,
  mirror,
  passTurn,
  passDouble,
  pipCount,
  playMove,
  positionEquals,
  rollGame,
  standardPosition,
  startNextGame,
  styleFeatures,
  takeDouble,
  offerDouble,
  verifyDiceCommitment,
  winKind,
  type Dice,
  type Die,
  type HashFunctions,
  type Position,
} from './index.js'

function position(
  player: Readonly<Record<number, number>>,
  opponent: Readonly<Record<number, number>> = {},
  off = 0,
  oppOff = 0,
): Position {
  const pts = new Int8Array(26)
  for (const [point, count] of Object.entries(player)) pts[Number(point)] = count
  for (const [point, count] of Object.entries(opponent)) {
    pts[Number(point)] = -count
  }
  return { pts, off, oppOff }
}

function resultingKeys(pos: Position, dice: Dice): readonly string[] {
  return generateLegalMoves(pos, dice)
    .map((move) => encodePositionId(applyMove(pos, move)))
    .sort()
}

describe('legal move generation', () => {
  it('uses both dice when a one-die play is also available', () => {
    const pos = position({ 8: 1 }, { 2: 2 }, 14, 13)
    const moves = generateLegalMoves(pos, [6, 1])

    expect(moves).toHaveLength(1)
    expect(moves[0]?.hops).toHaveLength(2)
    expect(encodePositionId(applyMove(pos, moves[0]!))).toBe(
      encodePositionId(position({ 1: 1 }, { 2: 2 }, 14, 13)),
    )
  })

  it('plays the larger die when only one die can be used', () => {
    const pos = position({ 25: 1 }, { 14: 2 }, 14, 13)
    const moves = generateLegalMoves(pos, [6, 5])

    expect(moves).toHaveLength(1)
    expect(moves[0]?.hops).toEqual([{ from: 25, to: 19, hit: false }])
  })

  it('forces bar entry and hits a blot', () => {
    const pos = position({ 25: 1, 8: 1 }, { 20: 1 }, 13, 14)
    const moves = generateLegalMoves(pos, [5, 1])

    expect(moves.every((move) => move.hops[0]?.from === 25)).toBe(true)
    expect(moves.some((move) => move.hops[0]?.hit)).toBe(true)
  })

  it('uses all four dice for doubles when possible', () => {
    const pos = position({ 8: 1 }, {}, 14, 15)
    const moves = generateLegalMoves(pos, [2, 2])

    expect(moves).toHaveLength(1)
    expect(moves[0]?.hops).toHaveLength(4)
    expect(applyMove(pos, moves[0]!).off).toBe(15)
  })

  it('rejects an oversize bear-off while a higher checker remains', () => {
    const pos = position({ 6: 1, 3: 1 }, {}, 13, 15)
    const moves = generateLegalMoves(pos, [4, 1])

    expect(
      moves.some((move) =>
        move.hops.some((hop) => hop.from === 3 && hop.to === 0),
      ),
    ).toBe(false)
  })

  it('deduplicates different hop orders that reach the same position', () => {
    const pos = position({ 13: 1, 8: 1 }, {}, 13, 15)
    const moves = generateLegalMoves(pos, [6, 1])
    const keys = moves.map((move) => encodePositionId(applyMove(pos, move)))

    expect(new Set(keys).size).toBe(keys.length)
    expect(
      keys.filter(
        (key) => key === encodePositionId(position({ 7: 2 }, {}, 13, 15)),
      ),
    ).toHaveLength(1)
  })

  it('mirrors positions involutively and switches perspective after a move', () => {
    const pos = position(
      { 25: 1, 20: 2, 8: 2, 6: 2 },
      { 24: 1, 19: 2, 7: 2, 5: 2 },
      8,
      8,
    )
    const dice: Dice = [5, 3]

    expect(positionEquals(mirror(mirror(pos)), pos)).toBe(true)

    const state = {
      ...createGameState(),
      position: pos,
      dice,
      remaining: dice,
      phase: 'to-move' as const,
    }
    for (const move of generateLegalMoves(pos, dice)) {
      expect(
        positionEquals(playMove(state, move).position, mirror(applyMove(pos, move))),
      ).toBe(true)
    }
  })
})

describe('position and match identifiers', () => {
  it('matches GNU Backgammon known position IDs', () => {
    expect(encodePositionId(standardPosition())).toBe('4HPwATDgc/ABMA')
    expect(encodePositionId(decodePositionId('4PPgASjgc/ABMA'))).toBe(
      '4PPgASjgc/ABMA',
    )
    expect(positionEquals(decodePositionId('4HPwATDgc/ABMA'), standardPosition())).toBe(
      true,
    )
  })

  it('round-trips every Match ID field', () => {
    const state = {
      dice: [6, 5] as const,
      onRoll: 'dark' as const,
      decisionPlayer: 'light' as const,
      resignation: 2 as const,
      cubeOffered: true,
      cube: { value: 8, owner: 'dark' as const },
      crawford: false,
      matchLength: 7,
      score: { light: 3, dark: 5 },
      jacoby: false,
      gameState: 'playing' as const,
    }
    const id = encodeMatchId(state)

    expect(id).toHaveLength(12)
    expect(decodeMatchId(id)).toEqual(state)
  })

  it('matches GNU Backgammon known Match ID fields', () => {
    expect(
      encodeMatchId({
        dice: [6, 5],
        onRoll: 'dark',
        decisionPlayer: 'dark',
        resignation: 0,
        cubeOffered: false,
        cube: { value: 1, owner: null },
        crawford: false,
        matchLength: 7,
        score: { light: 0, dark: 0 },
        jacoby: false,
        gameState: 'playing',
      }),
    ).toBe('cAn3AAAAAAAE')
  })
})

describe('game and match transitions', () => {
  it('re-rolls tied openings and lets the higher opening die start', () => {
    const initial = createGameState()

    expect(rollGame(initial, [4, 4])).toEqual(initial)
    expect(rollGame(initial, [4, 4], { automaticDoubles: true }).cube.value).toBe(
      2,
    )

    const opened = rollGame(initial, [2, 6])
    expect(opened).toMatchObject({
      onRoll: 'dark',
      dice: [6, 2],
      remaining: [6, 2],
      phase: 'to-move',
    })
  })

  it('passes only when no bar entry is available', () => {
    const blocked = position({ 25: 1 }, { 20: 2, 19: 2 }, 14, 11)
    const state = {
      ...createGameState(),
      position: blocked,
      dice: [6, 5] as Dice,
      remaining: [6, 5] as const,
      phase: 'to-move' as const,
    }

    expect(generateLegalMoves(blocked, [6, 5])).toEqual([])
    expect(passTurn(state)).toMatchObject({
      onRoll: 'dark',
      dice: null,
      remaining: [],
      phase: 'to-roll',
    })
  })

  it('enforces cube ownership and awards the pre-double stake on a pass', () => {
    let state = createGameState(createMatchState({ length: 7 }))
    state = { ...state, phase: 'to-roll' }

    expect(canDouble(state)).toBe(true)
    const offered = offerDouble(state)
    const taken = takeDouble(offered)
    expect(taken.cube).toEqual({ value: 2, owner: 'dark' })
    expect(canDouble(taken)).toBe(false)

    const dropped = passDouble(offerDouble({ ...taken, onRoll: 'dark' }))
    expect(dropped.result).toEqual({
      winner: 'dark',
      kind: 'single',
      points: 2,
    })
  })

  it('plays exactly one Crawford game and restores the cube afterwards', () => {
    const match = createMatchState({
      length: 7,
      score: { light: 6, dark: 4 },
    })
    let state = createGameState(match)
    expect(state.match.crawford).toBe(true)
    state = { ...state, phase: 'to-roll' }
    expect(canDouble(state)).toBe(false)

    const winningPosition = position({ 1: 1 }, {}, 14, 15)
    state = {
      ...state,
      position: winningPosition,
      dice: [1, 2],
      remaining: [1, 2],
      phase: 'to-move',
      onRoll: 'dark',
    }
    state = playMove(state, generateLegalMoves(winningPosition, [1, 2])[0]!)
    expect(state.match.crawfordUsed).toBe(true)
    expect(state.phase).toBe('game-over')

    const next = startNextGame(state)
    expect(next.match.crawford).toBe(false)
    expect(canDouble({ ...next, phase: 'to-roll' })).toBe(true)
  })

  it('detects single, gammon and backgammon wins', () => {
    expect(winKind(position({}, {}, 15, 1))).toBe('single')
    expect(winKind(position({}, { 7: 15 }, 15, 0))).toBe('gammon')
    expect(winKind(position({}, { 1: 1 }, 15, 0))).toBe('backgammon')
  })

  it('applies Jacoby only to centred-cube money games', () => {
    const winningPosition = position({ 1: 1 }, { 7: 15 }, 14, 0)
    const move = generateLegalMoves(winningPosition, [1, 2])[0]!
    const base = {
      ...createGameState(createMatchState({ length: 0, jacoby: true })),
      position: winningPosition,
      dice: [1, 2] as Dice,
      remaining: [1, 2] as const,
      phase: 'to-move' as const,
    }

    expect(playMove(base, move).result?.points).toBe(1)
    expect(
      playMove({ ...base, cube: { value: 2, owner: 'light' } }, move).result
        ?.points,
    ).toBe(4)
  })
})

describe('style features and deterministic dice', () => {
  it('counts the standard race as 167 pips for each side', () => {
    expect(pipCount(standardPosition())).toEqual({ player: 167, opponent: 167 })
  })

  it('extracts structural features from the on-roll perspective', () => {
    const features = styleFeatures(
      position({ 24: 2, 6: 2, 5: 2, 4: 2, 3: 1 }, { 2: 2, 0: 1 }, 6, 12),
    )

    expect(features).toMatchObject({
      primeLength: 3,
      blots: 1,
      anchor: 1,
      homePoints: 3,
      oppOnBar: 1,
    })
    expect(features.blotExposure).toBeGreaterThanOrEqual(0)
  })

  it('replays identical dice and rejects modulo-biased bytes', () => {
    const hashes: HashFunctions = {
      sha256(message) {
        return new Uint8Array(createHash('sha256').update(message).digest())
      },
      hmacSha256(key, message) {
        return new Uint8Array(createHmac('sha256', key).update(message).digest())
      },
    }
    const seed = new Uint8Array(32).map((_, index) => index)
    const first = new CommitRevealDiceSource(seed, hashes)
    const second = new CommitRevealDiceSource(seed, hashes)

    expect(Array.from({ length: 100 }, (_, index) => first.roll(index))).toEqual(
      Array.from({ length: 100 }, (_, index) => second.roll(index)),
    )

    const rejectionSource = new CommitRevealDiceSource(seed, {
      sha256: hashes.sha256,
      hmacSha256() {
        return Uint8Array.from([252, 255, 0, 251])
      },
    })
    expect(rejectionSource.roll(0)).toEqual([1, 6] satisfies [Die, Die])

    const commitment = diceCommitment(seed, hashes)
    expect(verifyDiceCommitment(seed, commitment, hashes)).toBe(true)
    commitment[0] = (commitment[0] ?? 0) ^ 1
    expect(verifyDiceCommitment(seed, commitment, hashes)).toBe(false)
  })
})
