import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applyMove,
  createMatchState,
  encodePositionId,
  generateLegalMoves,
  standardPosition,
  type Move,
  type Position,
} from '@nard/engine'
import { afterEach, describe, expect, it } from 'vitest'

import {
  chooseCube,
  DIFFICULTIES,
  PERSONALITY_SAFETY_CLAMP,
  selectRankedMove,
  type Evaluator,
  type Personality,
  type RankedMove,
} from './index.js'
import { GnubgEvaluator } from './gnubg.js'
import {
  NetEvaluator,
  equityFromProbs,
  fallbackProbs,
} from './net.js'

const fixture = fileURLToPath(new URL('../test/fake-bridge.mjs', import.meta.url))
const opening = standardPosition()
const openingDice = [6, 5] as const
const liveRoot =
  process.env.GNUBG_ROOT ??
  resolve(process.env.HOME ?? '', 'opt/gnubg/usr')
const liveBinary = process.env.GNUBG_BINARY ?? join(liveRoot, 'games/gnubg')

const evaluators: Evaluator[] = []

afterEach(async () => {
  await Promise.all(evaluators.splice(0).map((evaluator) => evaluator.dispose()))
})

function fakeRankResult(): string {
  const moves = generateLegalMoves(opening, openingDice)
  return JSON.stringify({
    moves: moves.map((move, index) => ({
      move: move.notation,
      positionId: encodePositionId(applyMove(opening, move)),
      equity: 1 - index * 0.05,
      eqdiff: -index * 0.05,
      probs: [0.6, 0.1, 0.01, 0.08, 0.005],
    })),
  })
}

function fakeEvaluator(
  mode: string,
  options: {
    readonly marker?: string
    readonly fallback?: Evaluator | null
    readonly timeoutMs?: number
    readonly errors?: string[]
  } = {},
): GnubgEvaluator {
  const env: NodeJS.ProcessEnv = {
    NARD_FAKE_MODE: mode,
    NARD_FAKE_RANK_RESULT: fakeRankResult(),
  }
  if (options.marker !== undefined) env.NARD_FAKE_MARKER = options.marker

  const evaluator = new GnubgEvaluator({
    command: { command: process.execPath, args: [fixture], env },
    timeoutMs: options.timeoutMs ?? 500,
    fallback:
      options.fallback === undefined ? new NetEvaluator() : options.fallback,
    onBackendError: (error) => options.errors?.push(error.message),
  })
  evaluators.push(evaluator)
  return evaluator
}

function ranked(move: Move, equity: number, eqdiff: number): RankedMove {
  return {
    move,
    equity,
    eqdiff,
    probs: [0.55, 0.12, 0.01, 0.1, 0.005],
  }
}

function terminalPosition(won: boolean): Position {
  const pts = new Int8Array(26)
  if (won) {
    pts[24] = -15
    return { pts, off: 15, oppOff: 0 }
  }
  pts[24] = 15
  return { pts, off: 0, oppOff: 15 }
}

describe('GNU Backgammon bridge supervision', () => {
  it('maps a fake child protocol response back to engine moves', async () => {
    const evaluator = fakeEvaluator('respond', { fallback: null })
    const result = await evaluator.rankMoves(opening, openingDice, { plies: 1 })

    expect(result).toHaveLength(generateLegalMoves(opening, openingDice).length)
    expect(result[0]?.eqdiff).toBe(0)
    expect(result.map(({ move }) => move.notation)).toEqual(
      generateLegalMoves(opening, openingDice).map((move) => move.notation),
    )

    await expect(
      evaluator.cubeDecision(opening, { value: 1, owner: null }),
    ).resolves.toMatchObject({
      action: 'no-double',
      response: 'take',
    })
  })

  it('falls back when the child dies and restarts on the next request', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nard-fake-bridge-'))
    const marker = join(directory, 'crashed')
    const errors: string[] = []

    try {
      const evaluator = fakeEvaluator('crash-once', { marker, errors })
      const degraded = await evaluator.rankMoves(opening, openingDice)
      const restarted = await evaluator.rankMoves(opening, openingDice)

      expect(degraded).toHaveLength(generateLegalMoves(opening, openingDice).length)
      expect(restarted[0]?.equity).toBe(1)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('exited before replying')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('times out a request and degrades instead of hanging', async () => {
    const errors: string[] = []
    const evaluator = fakeEvaluator('timeout', {
      timeoutMs: 40,
      errors,
    })
    const started = performance.now()
    const result = await evaluator.rankMoves(opening, openingDice)

    expect(performance.now() - started).toBeLessThan(500)
    expect(result).toHaveLength(generateLegalMoves(opening, openingDice).length)
    expect(errors[0]).toContain('timed out after 40ms')
  })
})

describe('fallback evaluation', () => {
  it('evaluates a won position above a lost one', () => {
    const won = equityFromProbs(fallbackProbs(terminalPosition(true)))
    const lost = equityFromProbs(fallbackProbs(terminalPosition(false)))

    expect(won).toBeGreaterThan(lost)
  })
})

describe('difficulty and personalities', () => {
  const moves = generateLegalMoves(opening, openingDice)

  it('rung 6 always chooses the top-ranked move', () => {
    const candidates = [
      ranked(moves[0]!, 0.2, 0),
      ranked(moves[1]!, 0.19, -0.01),
    ]

    expect(
      selectRankedMove(opening, candidates, {
        rung: 6,
        random: () => 0.999,
      }),
    ).toBe(candidates[0])
  })

  it('a higher tau selects worse moves more often', () => {
    const candidates = [
      ranked(moves[0]!, 0.2, 0),
      ranked(moves[1]!, 0.15, -0.05),
    ]
    let state = 0x4e415244
    const random = () => {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return (state >>> 0) / 0x1_0000_0000
    }
    const samples = 2_000
    let looseErrors = 0
    let tightErrors = 0

    for (let index = 0; index < samples; index += 1) {
      if (
        selectRankedMove(opening, candidates, {
          rung: 1,
          random,
        }).eqdiff < 0
      ) {
        looseErrors += 1
      }
      if (
        selectRankedMove(opening, candidates, {
          rung: 5,
          random,
        }).eqdiff < 0
      ) {
        tightErrors += 1
      }
    }

    expect(DIFFICULTIES[1].tau).toBeGreaterThan(DIFFICULTIES[5].tau)
    expect(looseErrors).toBeGreaterThan(tightErrors)
  })

  it('never lets a personality breach the equity safety clamp', () => {
    const personalities: readonly Personality[] = [
      'blitzer',
      'priming',
      'racer',
      'anchor',
      'purist',
    ]
    const candidates = [
      ranked(moves[0]!, 0.2, 0),
      ranked(
        moves[1]!,
        10,
        PERSONALITY_SAFETY_CLAMP - Number.EPSILON,
      ),
    ]

    for (const personality of personalities) {
      expect(
        selectRankedMove(opening, candidates, {
          rung: 1,
          personality,
          random: () => 0.999,
        }),
      ).toBe(candidates[0])
    }
  })

  it('applies cube weakness as an equity tolerance', () => {
    const analysis = {
      action: 'double' as const,
      response: 'pass' as const,
      equityNoDouble: 0.4,
      equityDoubleTake: 1.1,
      equityDoublePass: 1,
    }

    expect(chooseCube(analysis, 1)).toEqual({
      action: 'no-double',
      response: 'take',
    })
    expect(chooseCube(analysis, 6)).toEqual({
      action: 'double',
      response: 'pass',
    })
  })
})

it.skipIf(!existsSync(liveBinary))(
  'live gnubg smoke: ranks every move without pinning equity values',
  async () => {
    const evaluator = new GnubgEvaluator({ fallback: null })
    evaluators.push(evaluator)

    const result = await evaluator.rankMoves(opening, openingDice, { plies: 0 })
    const cube = await evaluator.cubeDecision(opening, {
      value: 1,
      owner: null,
    })

    expect(result).toHaveLength(generateLegalMoves(opening, openingDice).length)
    expect(result[0]?.eqdiff).toBeCloseTo(0)
    expect(result.every(({ eqdiff }) => eqdiff <= 0)).toBe(true)
    expect(['no-double', 'double', 'too-good']).toContain(cube.action)
    expect(['take', 'pass']).toContain(cube.response)

    const deadCubeContext = {
      cube: { value: 1, owner: null },
      match: createMatchState({ length: 1 }),
      onRoll: 'light' as const,
    }
    const matchResult = await evaluator.rankMoves(opening, openingDice, {
      plies: 0,
      context: deadCubeContext,
    })
    const deadCube = await evaluator.cubeDecision(
      opening,
      deadCubeContext.cube,
      { plies: 0, context: deadCubeContext },
    )
    expect(matchResult).toHaveLength(result.length)
    expect(deadCube.action).toBe('no-double')
  },
)
