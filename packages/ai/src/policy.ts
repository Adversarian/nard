import {
  applyMove,
  styleFeatures,
  type Position,
  type StyleFeatures,
} from '@nard/engine'

import type { CubeAnalysis, Evaluator, RankedMove } from './index.js'
import type { Dice } from '@nard/engine'

export type DifficultyRung = 1 | 2 | 3 | 4 | 5 | 6
export type Personality =
  | 'blitzer'
  | 'priming'
  | 'racer'
  | 'anchor'
  | 'purist'

export interface Difficulty {
  readonly rung: DifficultyRung
  readonly name: string
  readonly plies: 0 | 1 | 2
  readonly tau: number
  readonly cubeTolerance: number
}

export const DIFFICULTIES: Readonly<Record<DifficultyRung, Difficulty>> = {
  1: {
    rung: 1,
    name: 'تازه‌کار',
    plies: 0,
    tau: 0.15,
    cubeTolerance: Number.POSITIVE_INFINITY,
  },
  2: {
    rung: 2,
    name: 'مبتدی',
    plies: 0,
    tau: 0.08,
    cubeTolerance: 0.18,
  },
  3: {
    rung: 3,
    name: 'باشگاهی',
    plies: 1,
    tau: 0.065,
    cubeTolerance: 0.09,
  },
  4: {
    rung: 4,
    name: 'قوی',
    plies: 1,
    tau: 0.04,
    cubeTolerance: 0.045,
  },
  5: {
    rung: 5,
    name: 'استاد',
    plies: 2,
    tau: 0.022,
    cubeTolerance: 0.015,
  },
  6: {
    rung: 6,
    name: 'بی‌رحم',
    plies: 2,
    tau: 0,
    cubeTolerance: 0,
  },
}

export const PERSONALITY_SAFETY_CLAMP = -0.15

interface StyleWeights extends StyleFeatures {
  readonly gammon: number
}

const PERSONALITY_WEIGHTS: Readonly<Record<Personality, StyleWeights>> = {
  blitzer: {
    gammon: 0.05,
    primeLength: 0,
    blots: 0,
    blotExposure: 0.008,
    trapped: 0,
    raceLead: 0,
    anchor: 0,
    homePoints: 0.008,
    oppOnBar: 0.012,
  },
  priming: {
    gammon: 0,
    primeLength: 0.012,
    blots: 0,
    blotExposure: 0,
    trapped: 0.006,
    raceLead: -0.0004,
    anchor: 0,
    homePoints: 0,
    oppOnBar: 0,
  },
  racer: {
    gammon: 0,
    primeLength: 0,
    blots: -0.004,
    blotExposure: -0.012,
    trapped: -0.004,
    raceLead: 0.0008,
    anchor: -0.004,
    homePoints: 0,
    oppOnBar: -0.006,
  },
  anchor: {
    gammon: 0,
    primeLength: -0.006,
    blots: 0,
    blotExposure: 0,
    trapped: 0,
    raceLead: -0.0003,
    anchor: 0.014,
    homePoints: 0,
    oppOnBar: 0,
  },
  purist: {
    gammon: 0,
    primeLength: 0,
    blots: 0,
    blotExposure: 0,
    trapped: 0,
    raceLead: 0,
    anchor: 0,
    homePoints: 0,
    oppOnBar: 0,
  },
}

export interface MoveSelection {
  readonly rung: DifficultyRung
  readonly personality?: Personality
  readonly random?: () => number
}

interface ScoredMove {
  readonly ranked: RankedMove
  readonly score: number
}

function styleBias(
  position: Position,
  candidate: RankedMove,
  personality: Personality,
): number {
  if (personality === 'purist') return 0

  const weights = PERSONALITY_WEIGHTS[personality]
  const features = styleFeatures(applyMove(position, candidate.move))
  const gammon = candidate.probs[1]

  return (
    weights.gammon * gammon +
    weights.primeLength * features.primeLength +
    weights.blots * features.blots +
    weights.blotExposure * features.blotExposure +
    weights.trapped * features.trapped +
    weights.raceLead * features.raceLead +
    weights.anchor * features.anchor +
    weights.homePoints * features.homePoints +
    weights.oppOnBar * features.oppOnBar
  )
}

function sample(
  candidates: readonly ScoredMove[],
  tau: number,
  random: () => number,
): RankedMove {
  if (candidates.length === 0) throw new Error('cannot select from no legal moves')
  const best = candidates.reduce((left, right) =>
    right.score > left.score ? right : left,
  )
  if (tau === 0) return best.ranked

  const weights = candidates.map((candidate) =>
    Math.exp((candidate.score - best.score) / tau),
  )
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let target = Math.min(Math.max(random(), 0), 1 - Number.EPSILON) * total

  for (let index = 0; index < candidates.length; index += 1) {
    target -= weights[index] ?? 0
    if (target < 0) return candidates[index]!.ranked
  }
  return candidates[candidates.length - 1]!.ranked
}

export function selectRankedMove(
  position: Position,
  rankedMoves: readonly RankedMove[],
  selection: MoveSelection,
): RankedMove {
  const personality = selection.personality ?? 'purist'
  const candidates = rankedMoves
    .filter((candidate) => candidate.eqdiff >= PERSONALITY_SAFETY_CLAMP)
    .map((ranked) => ({
      ranked,
      score: ranked.equity + styleBias(position, ranked, personality),
    }))

  return sample(
    candidates,
    DIFFICULTIES[selection.rung].tau,
    selection.random ?? Math.random,
  )
}

export async function chooseMove(
  evaluator: Evaluator,
  position: Position,
  dice: Dice,
  selection: MoveSelection,
): Promise<RankedMove | null> {
  const difficulty = DIFFICULTIES[selection.rung]
  const ranked = await evaluator.rankMoves(position, dice, {
    plies: difficulty.plies,
  })
  return ranked.length === 0
    ? null
    : selectRankedMove(position, ranked, selection)
}

export interface CubeChoice {
  readonly action: CubeAnalysis['action']
  readonly response: CubeAnalysis['response']
}

export function chooseCube(
  analysis: CubeAnalysis,
  rung: DifficultyRung,
): CubeChoice {
  if (rung === 1) return { action: 'no-double', response: 'take' }

  const tolerance = DIFFICULTIES[rung].cubeTolerance
  const doubleEquity = Math.min(
    analysis.equityDoubleTake,
    analysis.equityDoublePass,
  )
  const action =
    analysis.action === 'too-good'
      ? analysis.equityNoDouble > doubleEquity + tolerance
        ? 'too-good'
        : 'double'
      : doubleEquity > analysis.equityNoDouble + tolerance
        ? 'double'
        : 'no-double'
  const response =
    analysis.equityDoubleTake <= analysis.equityDoublePass + tolerance
      ? 'take'
      : 'pass'

  return { action, response }
}
