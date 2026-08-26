import {
  applyMove,
  generateLegalMoves,
  mirror,
  pipCount,
  type CubeState,
  type Dice,
  type Position,
} from '@nard/engine'

import type {
  CubeAnalysis,
  EvalOpts,
  Evaluator,
  Probs,
  RankedMove,
} from './index.js'

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function terminalProbs(position: Position): Probs | null {
  if (position.off === 15) {
    const gammon = position.oppOff === 0
    const backgammon =
      gammon &&
      ((position.pts[0] ?? 0) < 0 ||
        Array.from(position.pts.slice(1, 7)).some((count) => count < 0))
    return [1, gammon ? 1 : 0, backgammon ? 1 : 0, 0, 0]
  }
  if (position.oppOff === 15) {
    const opponentView = terminalProbs(mirror(position))
    if (opponentView === null) return null
    return [
      0,
      0,
      0,
      opponentView[1],
      opponentView[2],
    ]
  }
  return null
}

interface FallbackFeatures {
  readonly homePoints: number
  readonly blots: number
  readonly oppOnBar: number
  readonly opponentInHome: number
}

function fallbackFeatures(position: Position): FallbackFeatures {
  let homePoints = 0
  let blots = 0
  let opponentInHome = 0

  for (let point = 1; point <= 24; point += 1) {
    const count = position.pts[point] ?? 0
    if (count === 1) blots += 1
    if (point <= 6 && count >= 2) homePoints += 1
    if (point <= 6 && count < 0) opponentInHome -= count
  }

  return {
    homePoints,
    blots,
    oppOnBar: -(position.pts[0] ?? 0),
    opponentInHome,
  }
}

/** Lightweight fixed-weight fallback; intentionally weaker than gnubg. */
export function fallbackProbs(position: Position): Probs {
  const terminal = terminalProbs(position)
  if (terminal !== null) return terminal

  const features = fallbackFeatures(position)
  const opponentFeatures = fallbackFeatures(mirror(position))
  const pips = pipCount(position)
  const logit =
    (pips.opponent - pips.player) * 0.012 +
    (position.off - position.oppOff) * 0.24 +
    features.oppOnBar * 0.12 -
    opponentFeatures.oppOnBar * 0.12 +
    (features.homePoints - opponentFeatures.homePoints) * 0.035 -
    features.blots * 0.018 +
    opponentFeatures.blots * 0.018

  const win = sigmoid(logit)
  const winGammon =
    position.oppOff === 0
      ? win *
        sigmoid(
          -1.8 +
            position.off * 0.16 +
            features.homePoints * 0.18 +
            features.oppOnBar * 0.2,
        )
      : 0
  const loseGammon =
    position.off === 0
      ? (1 - win) *
        sigmoid(
          -1.8 +
            position.oppOff * 0.16 +
            opponentFeatures.homePoints * 0.18 +
            opponentFeatures.oppOnBar * 0.2,
        )
      : 0
  const winBackgammon =
    winGammon *
    clamp(
      (features.oppOnBar + features.opponentInHome) * 0.035,
      0,
      0.35,
    )
  const loseBackgammon =
    loseGammon *
    clamp(
      (opponentFeatures.oppOnBar + opponentFeatures.opponentInHome) * 0.035,
      0,
      0.35,
    )

  return [win, winGammon, winBackgammon, loseGammon, loseBackgammon]
}

export function equityFromProbs(probs: Probs): number {
  return (
    2 * probs[0] -
    1 +
    probs[1] +
    probs[2] -
    probs[3] -
    probs[4]
  )
}

export class NetEvaluator implements Evaluator {
  async rankMoves(
    pos: Position,
    dice: Dice,
    _opts?: EvalOpts,
  ): Promise<RankedMove[]> {
    const evaluated = generateLegalMoves(pos, dice).map((move) => {
      const probs = fallbackProbs(applyMove(pos, move))
      return { move, probs, equity: equityFromProbs(probs) }
    })
    evaluated.sort((left, right) => right.equity - left.equity)
    const best = evaluated[0]?.equity ?? 0

    return evaluated.map(({ move, probs, equity }) => ({
      move,
      probs,
      equity,
      eqdiff: equity - best,
    }))
  }

  async cubeDecision(pos: Position, _cube: CubeState): Promise<CubeAnalysis> {
    const equityNoDouble = equityFromProbs(fallbackProbs(pos))
    const equityDoubleTake = clamp(equityNoDouble * 2, -2, 2)
    const equityDoublePass = 1
    const response =
      equityDoubleTake <= equityDoublePass ? 'take' : 'pass'
    const doubleEquity = Math.min(equityDoubleTake, equityDoublePass)
    const action =
      equityNoDouble > 0.8 && equityNoDouble > doubleEquity
        ? 'too-good'
        : doubleEquity > equityNoDouble + 0.03
          ? 'double'
          : 'no-double'

    return {
      action,
      response,
      equityNoDouble,
      equityDoubleTake,
      equityDoublePass,
    }
  }

  async dispose(): Promise<void> {}
}
