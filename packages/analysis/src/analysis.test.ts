import { readFileSync } from 'node:fs'

import {
  generateLegalMoves,
  type CubeState,
  type Dice,
  type GameState,
  type Position,
} from '@nard/engine'
import type {
  CubeAnalysis,
  EvalOpts,
  Evaluator,
  RankedMove,
} from '@nard/ai'
import { describe, expect, it } from 'vitest'

import {
  MatchRecorder,
  analyseMatch,
  bandFor,
  exportMatchToMat,
  initialSm2Schedule,
  loadMatch,
  replayMatch,
  reviewSm2,
  saveMatch,
} from './index.js'

const fixture = readFileSync(
  new URL('../test/fixtures/match-v1.json', import.meta.url),
  'utf8',
)
const comparisonFixture = readFileSync(
  new URL('../test/fixtures/gnubg-comparison-v1.json', import.meta.url),
  'utf8',
)
const cubeComparisonFixture = readFileSync(
  new URL('../test/fixtures/gnubg-cube-comparison-v1.json', import.meta.url),
  'utf8',
)

function meta(length = 1) {
  return {
    startedAt: '2026-08-26T09:00:00.000Z',
    match: {
      length,
      score: { light: 0, dark: 0 },
      crawfordUsed: false,
      jacoby: false,
    },
    rules: {
      variant: 'standard' as const,
      automaticDoubles: false,
    },
    players: {
      light: { name: 'Father' },
      dark: { name: 'Son' },
    },
  }
}

function comparable(state: GameState) {
  return {
    ...state,
    position: {
      ...state.position,
      pts: [...state.position.pts],
    },
  }
}

class DeterministicEvaluator implements Evaluator {
  async rankMoves(
    position: Position,
    dice: Dice,
    _opts?: EvalOpts,
  ): Promise<RankedMove[]> {
    return generateLegalMoves(position, dice).map((move, index) => ({
      move,
      equity: -index * 0.1,
      eqdiff: -index * 0.1,
      probs: [0.5, 0, 0, 0, 0],
    }))
  }

  async cubeDecision(
    _position: Position,
    _cube: CubeState,
    _opts?: EvalOpts,
  ): Promise<CubeAnalysis> {
    return {
      action: 'double',
      response: 'take',
      equityNoDouble: 0.2,
      equityDoubleTake: 0.3,
      equityDoublePass: 1,
    }
  }

  async dispose(): Promise<void> {}
}

describe('saved matches', () => {
  it('keeps the v1 fixture readable and preserves later additive fields', () => {
    const loaded = loadMatch(fixture)
    const savedAgain = JSON.parse(saveMatch(loaded)) as Record<string, unknown>

    expect(loaded.v).toBe(1)
    expect((savedAgain.futureTopLevel as { kept: boolean }).kept).toBe(true)
    expect(
      (savedAgain.meta as Record<string, unknown>).futureMeta,
    ).toBe('kept')
    const savedMeta = savedAgain.meta as Record<string, unknown>
    const savedSetup = savedMeta.match as Record<string, unknown>
    expect(savedSetup.futureMatch).toBe('kept')
    expect(
      (savedSetup.score as Record<string, unknown>).futureScore,
    ).toBe('kept')
    expect(
      (savedMeta.rules as Record<string, unknown>).futureRules,
    ).toBe('kept')
    const savedPlayers = savedMeta.players as Record<string, unknown>
    expect(savedPlayers.futurePlayers).toBe('kept')
    expect(
      (savedPlayers.light as Record<string, unknown>).futurePlayer,
    ).toBe('kept')
    expect(
      (
        (savedAgain.decisions as Record<string, unknown>[])[0]!
      ).futureDecision,
    ).toBe('kept')
    expect(replayMatch(loaded).decisionIndex).toBe(2)
  })

  it('replays a complete recorded match to a bit-identical state', () => {
    const seed = Uint8Array.from({ length: 32 }, (_, index) => 255 - index)
    const recorder = new MatchRecorder(seed, meta())
    let transitions = 0

    while (recorder.state.phase !== 'match-over') {
      if (transitions >= 1_000) throw new Error('test match did not finish')
      if (
        recorder.state.phase === 'opening-roll' ||
        recorder.state.phase === 'to-roll'
      ) {
        recorder.roll()
      } else if (recorder.state.phase === 'to-move') {
        const legal = generateLegalMoves(
          recorder.state.position,
          recorder.state.dice!,
        )
        if (legal.length === 0) recorder.passTurn()
        else recorder.playMove(legal[transitions % legal.length]!)
      }
      transitions += 1
    }

    const loaded = loadMatch(saveMatch(recorder.toSavedMatch()))
    const replayed = replayMatch(loaded)
    expect(comparable(replayed.state)).toEqual(comparable(recorder.state))
    expect(replayed.rollNumber).toBe(recorder.rollNumber)

    const halfway = Math.floor(loaded.decisions.length / 2)
    expect(replayMatch(loaded, halfway).decisionIndex).toBe(halfway)
  })

  it('keeps the complete GNU comparison fixture replayable', () => {
    const replayed = replayMatch(loadMatch(comparisonFixture))
    expect(replayed.state.phase).toBe('match-over')
    expect(replayed.state.match.score).toEqual({ light: 0, dark: 1 })
    expect(replayed.rollNumber).toBe(66)
  })

  it('exports a GNU Backgammon-readable MAT shape', () => {
    const mat = exportMatchToMat(loadMatch(fixture))
    expect(mat).toContain('1 point match')
    expect(mat).toContain('Game 1')
    expect(mat).toContain('Father : 0')
    expect(mat).toMatch(/\d\d: \S+/)
  })

  it('does not duplicate a dropped game result in MAT export', () => {
    const mat = exportMatchToMat(loadMatch(cubeComparisonFixture))
    expect(mat).toContain('Doubles => 2')
    expect(mat).toContain('Drops')
    expect(mat).not.toContain('Wins 1 point')
  })
})

describe('analysis', () => {
  it('reports checker and cube PR separately and excludes forced plays', async () => {
    const recorder = new MatchRecorder(
      Uint8Array.from({ length: 32 }, (_, index) => index + 7),
      meta(3),
    )

    recorder.roll()
    let legal = generateLegalMoves(recorder.state.position, recorder.state.dice!)
    recorder.playMove(legal.at(-1)!)
    recorder.roll()
    legal = generateLegalMoves(recorder.state.position, recorder.state.dice!)
    if (legal.length === 0) recorder.passTurn()
    else recorder.playMove(legal.at(-1)!)

    const progress: { completed: number; total: number }[] = []
    const analysis = await analyseMatch(
      recorder.toSavedMatch(),
      new DeterministicEvaluator(),
      {
        onProgress(value) {
          progress.push(value)
        },
      },
    )
    const checker = analysis.decisions.filter(
      (decision) => decision.kind === 'checker',
    )
    const nonForced = checker.filter((decision) => !decision.forced)

    expect(analysis.performance.light.checker.decisions +
      analysis.performance.dark.checker.decisions).toBe(nonForced.length)
    expect(
      analysis.performance.light.cube.decisions +
        analysis.performance.dark.cube.decisions,
    ).toBe(1)
    expect(analysis.blunders.length).toBeGreaterThan(0)
    expect(progress.at(-1)?.completed).toBe(progress.at(-1)?.total)
  })

  it('uses the specified boundary bands', () => {
    expect(bandFor(-0.02)).toBe('doubtful')
    expect(bandFor(-0.04)).toBe('error')
    expect(bandFor(-0.08)).toBe('blunder')
    expect(bandFor(-0.080_001)).toBe('blunder')
  })
})

describe('SM-2 drills', () => {
  it('uses the standard 1 day, 6 day, then ease-scaled intervals', () => {
    let schedule = initialSm2Schedule('2026-08-26T00:00:00.000Z')
    schedule = reviewSm2(schedule, 5, '2026-08-26T00:00:00.000Z')
    expect(schedule.intervalDays).toBe(1)
    schedule = reviewSm2(schedule, 5, '2026-08-27T00:00:00.000Z')
    expect(schedule.intervalDays).toBe(6)
    schedule = reviewSm2(schedule, 5, '2026-09-02T00:00:00.000Z')
    expect(schedule.intervalDays).toBeGreaterThan(6)

    schedule = reviewSm2(schedule, 2, '2026-09-20T00:00:00.000Z')
    expect(schedule.repetitions).toBe(0)
    expect(schedule.intervalDays).toBe(1)
  })
})
