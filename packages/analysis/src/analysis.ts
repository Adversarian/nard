import {
  applyMove,
  canDouble,
  encodeMatchId,
  encodePositionId,
  generateLegalMoves,
  passTurn,
  rollGame,
  styleFeatures,
  type Dice,
  type GameState,
  type Move,
  type PlayerId,
  type Position,
  type RulesConfig,
} from '@nard/engine'
import type {
  CubeAnalysis,
  Evaluator,
  EvaluationContext,
  RankedMove,
} from '@nard/ai'

import { bandFor, type ErrorBand } from './bands.js'
import {
  loadMatch,
  replayMatch,
  type ReplayStep,
  type SavedMatchV1,
} from './match.js'

const PLAYERS = ['light', 'dark'] as const
const STANDARD_ROLLS: readonly {
  readonly dice: Dice
  readonly weight: number
}[] = (() => {
  const rolls: { dice: Dice; weight: number }[] = []
  for (let first = 1; first <= 6; first += 1) {
    for (let second = first; second <= 6; second += 1) {
      rolls.push({
        dice: [first, second] as Dice,
        weight: first === second ? 1 : 2,
      })
    }
  }
  return rolls
})()

export type AnalysisPhase =
  | 'opening'
  | 'middle-game'
  | 'bear-in'
  | 'bear-off'
  | 'race'

export type BlunderTheme =
  | 'hitting'
  | 'priming'
  | 'anchoring'
  | 'safety-vs-boldness'
  | 'cube-timing'
  | 'bear-off-technique'

export type BlunderDirection =
  | 'too-passive'
  | 'too-aggressive'
  | 'unclear'

export type CubeAction = 'no-double' | 'double' | 'take' | 'pass'

export interface AnalysedMove {
  readonly notation: string
  readonly positionId: string
  readonly equity: number
}

interface DecisionAnalysisBase {
  readonly decisionIndex: number
  readonly gameIndex: number
  readonly player: PlayerId
  readonly positionId: string
  readonly matchId: string
  readonly equity: number
  readonly bestEquity: number
  /** Played minus best, always <= 0. */
  readonly error: number
  readonly band: ErrorBand
  readonly equivalent: boolean
  readonly searchDepth: 0 | 1 | 2
}

export interface CheckerDecisionAnalysis extends DecisionAnalysisBase {
  readonly kind: 'checker'
  readonly dice: Dice
  readonly played: AnalysedMove
  readonly best: AnalysedMove
  readonly forced: boolean
  /** Null only when a malformed recording has no preceding roll event. */
  readonly luck: number | null
}

export interface CubeDecisionAnalysis extends DecisionAnalysisBase {
  readonly kind: 'cube'
  readonly played: CubeAction
  readonly best: CubeAction
  /** GNU denominator: actual actions, plus no-doubles within 0.16 or too good. */
  readonly countsForPr: boolean
  /** Luck belongs to rolls, not pre-roll cube choices. */
  readonly luck: null
}

export type DecisionAnalysis =
  | CheckerDecisionAnalysis
  | CubeDecisionAnalysis

export interface RollLuck {
  readonly decisionIndex: number
  readonly gameIndex: number
  readonly player: PlayerId
  readonly dice: Dice
  readonly equity: number
  readonly meanEquity: number
  /** Actual best-play equity minus probability-weighted mean roll equity. */
  readonly luck: number
}

export interface PerformanceMetric {
  readonly decisions: number
  readonly equityLost: number
  readonly pr: number | null
}

export interface PlayerPerformance {
  readonly checker: PerformanceMetric
  readonly cube: PerformanceMetric
  readonly overall: PerformanceMetric
}

export interface LuckSkillSummary {
  readonly luck: Readonly<Record<PlayerId, number>>
  readonly luckDifferential: number
  readonly skillEquityLost: Readonly<Record<PlayerId, number>>
  /** Positive means light lost less equity through decisions. */
  readonly skillDifferential: number
}

export interface GameAnalysis {
  readonly gameIndex: number
  readonly performance: Readonly<Record<PlayerId, PlayerPerformance>>
  readonly luck: Readonly<Record<PlayerId, number>>
}

export interface Blunder {
  readonly decisionIndex: number
  readonly gameIndex: number
  readonly player: PlayerId
  readonly error: number
  readonly phase: AnalysisPhase
  readonly theme: BlunderTheme
  readonly direction: BlunderDirection
  readonly positionId: string
  readonly matchId: string
}

export interface MatchAnalysis {
  readonly v: 1
  readonly commitment: string
  readonly searchDepth: 0 | 1 | 2
  readonly decisions: readonly DecisionAnalysis[]
  readonly rolls: readonly RollLuck[]
  readonly games: readonly GameAnalysis[]
  readonly performance: Readonly<Record<PlayerId, PlayerPerformance>>
  readonly luckSkill: LuckSkillSummary
  readonly blunders: readonly Blunder[]
}

export interface AnalysisProgress {
  readonly completed: number
  readonly total: number
  readonly stage: 'checker' | 'cube' | 'luck'
  readonly decisionIndex: number
}

export interface AnalyseMatchOptions {
  readonly plies?: 0 | 1 | 2
  readonly onProgress?: (progress: AnalysisProgress) => void
}

interface MutableMetric {
  decisions: number
  equityLost: number
}

type MutablePerformance = Record<
  PlayerId,
  { checker: MutableMetric; cube: MutableMetric }
>

function emptyPerformance(): MutablePerformance {
  return {
    light: {
      checker: { decisions: 0, equityLost: 0 },
      cube: { decisions: 0, equityLost: 0 },
    },
    dark: {
      checker: { decisions: 0, equityLost: 0 },
      cube: { decisions: 0, equityLost: 0 },
    },
  }
}

function metric(value: MutableMetric): PerformanceMetric {
  return {
    decisions: value.decisions,
    equityLost: value.equityLost,
    pr:
      value.decisions === 0
        ? null
        : (PR_SCALE * value.equityLost) / value.decisions,
  }
}

function playerPerformance(
  value: MutablePerformance[PlayerId],
): PlayerPerformance {
  const combined = {
    decisions: value.checker.decisions + value.cube.decisions,
    equityLost: value.checker.equityLost + value.cube.equityLost,
  }
  return {
    checker: metric(value.checker),
    cube: metric(value.cube),
    overall: metric(combined),
  }
}

function frozenPerformance(
  value: MutablePerformance,
): Readonly<Record<PlayerId, PlayerPerformance>> {
  return {
    light: playerPerformance(value.light),
    dark: playerPerformance(value.dark),
  }
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 'light' ? 'dark' : 'light'
}

function evaluationContext(state: GameState): EvaluationContext {
  return {
    cube: state.cube,
    match: state.match,
    onRoll: state.onRoll,
  }
}

function stateKey(state: GameState): string {
  return `${encodePositionId(state.position)}:${encodeMatchId(state)}`
}

function resultingPositionId(position: Position, move: Move): string {
  return encodePositionId(applyMove(position, move))
}

function analysedMove(
  position: Position,
  candidate: RankedMove,
): AnalysedMove {
  return {
    notation: candidate.move.notation,
    positionId: resultingPositionId(position, candidate.move),
    equity: candidate.equity,
  }
}

function optimalCubeEquity(analysis: CubeAnalysis): number {
  return Math.max(
    analysis.equityNoDouble,
    Math.min(analysis.equityDoubleTake, analysis.equityDoublePass),
  )
}

function noContact(position: Position): boolean {
  if ((position.pts[25] ?? 0) > 0 || (position.pts[0] ?? 0) < 0) return false

  let furthestPlayer = 0
  let furthestOpponent = 25
  for (let point = 1; point <= 24; point += 1) {
    const count = position.pts[point] ?? 0
    if (count > 0) furthestPlayer = Math.max(furthestPlayer, point)
    if (count < 0) furthestOpponent = Math.min(furthestOpponent, point)
  }
  return furthestPlayer < furthestOpponent
}

function allPlayerCheckersHome(position: Position): boolean {
  for (let point = 7; point <= 25; point += 1) {
    if ((position.pts[point] ?? 0) > 0) return false
  }
  return true
}

function phaseFor(
  position: Position,
  checkerOrdinal: number,
): AnalysisPhase {
  if (checkerOrdinal < 6) return 'opening'
  if (position.off > 0) return 'bear-off'
  if (allPlayerCheckersHome(position)) return 'bear-in'
  if (noContact(position)) return 'race'
  return 'middle-game'
}

function riskScore(position: Position, move: Move): number {
  const features = styleFeatures(position)
  const hits = move.hops.filter(({ hit }) => hit).length
  return (
    hits * 2 +
    features.oppOnBar * 0.5 +
    features.blotExposure +
    features.blots * 0.15 +
    features.homePoints * 0.1 +
    features.primeLength * 0.1 -
    features.anchor * 0.05
  )
}

function directionForMoves(
  before: Position,
  played: Move,
  best: Move,
): BlunderDirection {
  const playedRisk = riskScore(applyMove(before, played), played)
  const bestRisk = riskScore(applyMove(before, best), best)
  if (Math.abs(playedRisk - bestRisk) < 1e-9) return 'unclear'
  return playedRisk < bestRisk ? 'too-passive' : 'too-aggressive'
}

function themeForMoves(
  before: Position,
  played: Move,
  best: Move,
  phase: AnalysisPhase,
): BlunderTheme {
  const playedPosition = applyMove(before, played)
  const bestPosition = applyMove(before, best)
  const playedHits = played.hops.filter(({ hit }) => hit).length
  const bestHits = best.hops.filter(({ hit }) => hit).length
  if (playedHits !== bestHits) return 'hitting'

  const playedStyle = styleFeatures(playedPosition)
  const bestStyle = styleFeatures(bestPosition)
  const candidates: readonly [BlunderTheme, number][] = [
    ['priming', Math.abs(playedStyle.primeLength - bestStyle.primeLength) / 6],
    ['anchoring', Math.abs(playedStyle.anchor - bestStyle.anchor) / 6],
    [
      'safety-vs-boldness',
      Math.abs(playedStyle.blotExposure - bestStyle.blotExposure) +
        Math.abs(playedStyle.blots - bestStyle.blots) * 0.1,
    ],
  ]
  const strongest = [...candidates].sort((left, right) => right[1] - left[1])[0]!
  if (
    strongest[1] < 0.1 &&
    (phase === 'bear-in' || phase === 'bear-off' || phase === 'race')
  ) {
    return 'bear-off-technique'
  }
  return strongest[0]
}

function cubeBlunder(
  analysed: CubeDecisionAnalysis,
  checkerOrdinal: number,
  position: Position,
): Blunder {
  const direction: BlunderDirection =
    analysed.played === 'double' || analysed.played === 'take'
      ? 'too-aggressive'
      : 'too-passive'
  return {
    decisionIndex: analysed.decisionIndex,
    gameIndex: analysed.gameIndex,
    player: analysed.player,
    error: analysed.error,
    phase: phaseFor(position, checkerOrdinal),
    theme: 'cube-timing',
    direction,
    positionId: analysed.positionId,
    matchId: analysed.matchId,
  }
}

function checkerBlunder(
  analysed: CheckerDecisionAnalysis,
  checkerOrdinal: number,
  before: Position,
  played: Move,
  best: Move,
): Blunder {
  const phase = phaseFor(before, checkerOrdinal)
  return {
    decisionIndex: analysed.decisionIndex,
    gameIndex: analysed.gameIndex,
    player: analysed.player,
    error: analysed.error,
    phase,
    theme: themeForMoves(before, played, best, phase),
    direction: directionForMoves(before, played, best),
    positionId: analysed.positionId,
    matchId: analysed.matchId,
  }
}

function workUnits(steps: readonly ReplayStep[]): number {
  let total = 0
  for (const step of steps) {
    if (step.decision.kind === 'move') total += 1
    if (
      step.decision.kind === 'double' ||
      step.decision.kind === 'take' ||
      step.decision.kind === 'drop' ||
      (step.decision.kind === 'roll' &&
        step.before.phase === 'to-roll' &&
        canDouble(step.before))
    ) {
      total += 1
    }
    if (step.decision.kind === 'roll' && step.after.phase === 'to-move') {
      total += step.before.phase === 'opening-roll' ? 31 : 22
    }
  }
  return total
}

function matchRules(match: SavedMatchV1): RulesConfig {
  return {
    variant: match.meta.rules.variant,
    automaticDoubles: match.meta.rules.automaticDoubles,
  }
}

export async function analyseMatch(
  input: SavedMatchV1,
  evaluator: Evaluator,
  options: AnalyseMatchOptions = {},
): Promise<MatchAnalysis> {
  const match = loadMatch(input)
  const replay = replayMatch(match)
  const plies = options.plies ?? 2
  const total = workUnits(replay.steps)
  let completed = 0
  const report = (
    stage: AnalysisProgress['stage'],
    decisionIndex: number,
  ): void => {
    completed += 1
    options.onProgress?.({ completed, total, stage, decisionIndex })
  }

  const rankCache = new Map<string, Promise<readonly RankedMove[]>>()
  const cubeCache = new Map<string, Promise<CubeAnalysis>>()
  const rank = (
    state: GameState,
    dice: Dice,
  ): Promise<readonly RankedMove[]> => {
    const key = `${stateKey(state)}:${dice[0]},${dice[1]}:${plies}`
    let pending = rankCache.get(key)
    if (pending === undefined) {
      pending = evaluator.rankMoves(state.position, dice, {
        plies,
        context: evaluationContext(state),
      })
      rankCache.set(key, pending)
    }
    return pending
  }
  const cube = (state: GameState): Promise<CubeAnalysis> => {
    const key = `${stateKey(state)}:${plies}`
    let pending = cubeCache.get(key)
    if (pending === undefined) {
      pending = evaluator.cubeDecision(state.position, state.cube, {
        plies,
        context: evaluationContext(state),
      })
      cubeCache.set(key, pending)
    }
    return pending
  }

  const bestEquityAfterRoll = async (
    state: GameState,
    perspective: PlayerId,
  ): Promise<number> => {
    if (state.phase !== 'to-move' || state.dice === null) {
      throw new Error('luck evaluation requires a rolled position')
    }
    const legal = generateLegalMoves(state.position, state.dice)
    let value: number
    if (legal.length > 0) {
      const ranked = await rank(state, state.dice)
      if (ranked.length === 0) {
        throw new Error('evaluator omitted every legal move during luck analysis')
      }
      value = ranked[0]!.equity
    } else {
      const passed = passTurn(state)
      value = -optimalCubeEquity(await cube(passed))
    }
    return state.onRoll === perspective ? value : -value
  }

  const performance = emptyPerformance()
  const gamePerformance = new Map<number, MutablePerformance>()
  const luckTotals: Record<PlayerId, number> = { light: 0, dark: 0 }
  const gameLuck = new Map<number, Record<PlayerId, number>>()
  const decisions: DecisionAnalysis[] = []
  const rolls: RollLuck[] = []
  const blunders: Blunder[] = []
  const lastLuck = new Map<string, number>()
  const checkerOrdinals = new Map<number, number>()

  const mutableGame = (gameIndex: number): MutablePerformance => {
    let value = gamePerformance.get(gameIndex)
    if (value === undefined) {
      value = emptyPerformance()
      gamePerformance.set(gameIndex, value)
    }
    return value
  }
  const mutableGameLuck = (
    gameIndex: number,
  ): Record<PlayerId, number> => {
    let value = gameLuck.get(gameIndex)
    if (value === undefined) {
      value = { light: 0, dark: 0 }
      gameLuck.set(gameIndex, value)
    }
    return value
  }
  const addError = (
    gameIndex: number,
    player: PlayerId,
    kind: 'checker' | 'cube',
    error: number,
    countsForPr = true,
  ): void => {
    const loss = -Math.min(0, error)
    performance[player][kind].equityLost += loss
    if (countsForPr) performance[player][kind].decisions += 1
    const game = mutableGame(gameIndex)
    game[player][kind].equityLost += loss
    if (countsForPr) game[player][kind].decisions += 1
  }

  for (const step of replay.steps) {
    const checkerOrdinal = checkerOrdinals.get(step.gameIndex) ?? 0

    if (step.decision.kind === 'roll' && step.after.phase === 'to-move') {
      const player = step.after.onRoll
      const actual = await bestEquityAfterRoll(step.after, player)
      report('luck', step.decisionIndex)

      let weighted = 0
      let weight = 0
      if (step.before.phase === 'opening-roll') {
        for (let lightDie = 1; lightDie <= 6; lightDie += 1) {
          for (let darkDie = 1; darkDie <= 6; darkDie += 1) {
            if (lightDie === darkDie) continue
            const alternative = rollGame(
              step.before,
              [lightDie, darkDie] as Dice,
              matchRules(match),
            )
            weighted += await bestEquityAfterRoll(alternative, player)
            weight += 1
            report('luck', step.decisionIndex)
          }
        }
      } else {
        for (const alternative of STANDARD_ROLLS) {
          const rolled = rollGame(
            step.before,
            alternative.dice,
            matchRules(match),
          )
          weighted +=
            (await bestEquityAfterRoll(rolled, player)) * alternative.weight
          weight += alternative.weight
          report('luck', step.decisionIndex)
        }
      }

      const meanEquity = weighted / weight
      const luck = actual - meanEquity
      rolls.push({
        decisionIndex: step.decisionIndex,
        gameIndex: step.gameIndex,
        player,
        dice: step.after.dice!,
        equity: actual,
        meanEquity,
        luck,
      })
      luckTotals[player] += luck
      mutableGameLuck(step.gameIndex)[player] += luck
      lastLuck.set(`${step.gameIndex}:${player}`, luck)
    }

    if (
      step.decision.kind === 'roll' &&
      step.before.phase === 'to-roll' &&
      canDouble(step.before)
    ) {
      const raw = await cube(step.before)
      report('cube', step.decisionIndex)
      const doubleEquity = Math.min(
        raw.equityDoubleTake,
        raw.equityDoublePass,
      )
      const bestEquity = Math.max(raw.equityNoDouble, doubleEquity)
      const error = Math.min(0, raw.equityNoDouble - bestEquity)
      const countsForPr =
        raw.action === 'too-good' ||
        Math.abs(raw.equityNoDouble - doubleEquity) <= 0.16
      const analysed: CubeDecisionAnalysis = {
        kind: 'cube',
        decisionIndex: step.decisionIndex,
        gameIndex: step.gameIndex,
        player: step.before.onRoll,
        positionId: encodePositionId(step.before.position),
        matchId: encodeMatchId(step.before),
        played: 'no-double',
        best:
          raw.equityNoDouble >= doubleEquity ? 'no-double' : 'double',
        equity: raw.equityNoDouble,
        bestEquity,
        error,
        band: bandFor(error),
        equivalent: Math.abs(error) < 0.005,
        searchDepth: plies,
        countsForPr,
        luck: null,
      }
      decisions.push(analysed)
      addError(
        step.gameIndex,
        analysed.player,
        'cube',
        analysed.error,
        countsForPr,
      )
      if (analysed.band === 'blunder') {
        blunders.push(
          cubeBlunder(analysed, checkerOrdinal, step.before.position),
        )
      }
    }

    if (step.decision.kind === 'double') {
      const raw = await cube(step.before)
      report('cube', step.decisionIndex)
      const doubleEquity = Math.min(
        raw.equityDoubleTake,
        raw.equityDoublePass,
      )
      const bestEquity = Math.max(raw.equityNoDouble, doubleEquity)
      const error = Math.min(0, doubleEquity - bestEquity)
      const analysed: CubeDecisionAnalysis = {
        kind: 'cube',
        decisionIndex: step.decisionIndex,
        gameIndex: step.gameIndex,
        player: step.before.onRoll,
        positionId: encodePositionId(step.before.position),
        matchId: encodeMatchId(step.before),
        played: 'double',
        best:
          raw.equityNoDouble >= doubleEquity ? 'no-double' : 'double',
        equity: doubleEquity,
        bestEquity,
        error,
        band: bandFor(error),
        equivalent: Math.abs(error) < 0.005,
        searchDepth: plies,
        countsForPr: true,
        luck: null,
      }
      decisions.push(analysed)
      addError(step.gameIndex, analysed.player, 'cube', error)
      if (analysed.band === 'blunder') {
        blunders.push(
          cubeBlunder(analysed, checkerOrdinal, step.before.position),
        )
      }
    }

    if (step.decision.kind === 'take' || step.decision.kind === 'drop') {
      const raw = await cube(step.before)
      report('cube', step.decisionIndex)
      const takeEquity = -raw.equityDoubleTake
      const passEquity = -raw.equityDoublePass
      const bestEquity = Math.max(takeEquity, passEquity)
      const played: CubeAction =
        step.decision.kind === 'take' ? 'take' : 'pass'
      const equity = played === 'take' ? takeEquity : passEquity
      const error = Math.min(0, equity - bestEquity)
      const analysed: CubeDecisionAnalysis = {
        kind: 'cube',
        decisionIndex: step.decisionIndex,
        gameIndex: step.gameIndex,
        player: otherPlayer(step.before.onRoll),
        positionId: encodePositionId(step.before.position),
        matchId: encodeMatchId(step.before),
        played,
        best: takeEquity >= passEquity ? 'take' : 'pass',
        equity,
        bestEquity,
        error,
        band: bandFor(error),
        equivalent: Math.abs(error) < 0.005,
        searchDepth: plies,
        countsForPr: true,
        luck: null,
      }
      decisions.push(analysed)
      addError(step.gameIndex, analysed.player, 'cube', error)
      if (analysed.band === 'blunder') {
        blunders.push(
          cubeBlunder(analysed, checkerOrdinal, step.before.position),
        )
      }
    }

    if (step.decision.kind === 'move') {
      if (step.before.dice === null || step.move === undefined) {
        throw new Error('replay omitted dice or the matched checker move')
      }
      const ranked = await rank(step.before, step.before.dice)
      report('checker', step.decisionIndex)
      if (ranked.length === 0) {
        throw new Error('evaluator omitted every legal checker move')
      }
      const playedPositionId = resultingPositionId(
        step.before.position,
        step.move,
      )
      const played = ranked.find(
        (candidate) =>
          resultingPositionId(step.before.position, candidate.move) ===
          playedPositionId,
      )
      if (played === undefined) {
        throw new Error('evaluator omitted the checker move that was played')
      }
      const best = ranked[0]!
      const error = Math.min(0, played.equity - best.equity)
      const forced =
        generateLegalMoves(step.before.position, step.before.dice).length === 1
      const analysed: CheckerDecisionAnalysis = {
        kind: 'checker',
        decisionIndex: step.decisionIndex,
        gameIndex: step.gameIndex,
        player: step.before.onRoll,
        positionId: encodePositionId(step.before.position),
        matchId: encodeMatchId(step.before),
        dice: step.before.dice,
        played: analysedMove(step.before.position, played),
        best: analysedMove(step.before.position, best),
        equity: played.equity,
        bestEquity: best.equity,
        error,
        band: bandFor(error),
        equivalent: Math.abs(error) < 0.005,
        forced,
        searchDepth: plies,
        luck:
          lastLuck.get(`${step.gameIndex}:${step.before.onRoll}`) ?? null,
      }
      lastLuck.delete(`${step.gameIndex}:${step.before.onRoll}`)
      decisions.push(analysed)
      if (!forced) addError(step.gameIndex, analysed.player, 'checker', error)
      if (analysed.band === 'blunder') {
        blunders.push(
          checkerBlunder(
            analysed,
            checkerOrdinal,
            step.before.position,
            played.move,
            best.move,
          ),
        )
      }
      checkerOrdinals.set(step.gameIndex, checkerOrdinal + 1)
    }

    if (step.decision.kind === 'pass-turn') {
      lastLuck.delete(`${step.gameIndex}:${step.before.onRoll}`)
    }
  }

  const frozen = frozenPerformance(performance)
  const games = [...new Set(replay.steps.map(({ gameIndex }) => gameIndex))]
    .sort((left, right) => left - right)
    .map(
      (gameIndex): GameAnalysis => ({
        gameIndex,
        performance: frozenPerformance(
          gamePerformance.get(gameIndex) ?? emptyPerformance(),
        ),
        luck: gameLuck.get(gameIndex) ?? { light: 0, dark: 0 },
      }),
    )
  const skillEquityLost = {
    light: frozen.light.overall.equityLost,
    dark: frozen.dark.overall.equityLost,
  }

  return {
    v: 1,
    commitment: match.commitment,
    searchDepth: plies,
    decisions,
    rolls,
    games,
    performance: frozen,
    luckSkill: {
      luck: luckTotals,
      luckDifferential: luckTotals.light - luckTotals.dark,
      skillEquityLost,
      skillDifferential: skillEquityLost.dark - skillEquityLost.light,
    },
    blunders: [...blunders].sort((left, right) => left.error - right.error),
  }
}

export interface RollingPrPoint {
  readonly matchIndex: number
  readonly commitment: string
  readonly windowStart: number
  readonly windowSize: number
  readonly performance: Readonly<Record<PlayerId, PlayerPerformance>>
}

/** Aggregate PR by equity and decision counts, never by averaging PR values. */
/**
 * PR is mean equity loss per decision in milli-EMG — the same scale GNU
 * Backgammon and Extreme Gammon report, so a number here means what it means
 * everywhere else in backgammon. World class is about 2-3; a strong club player
 * around 7.
 *
 * Verified against gnubg on the same match: our total equity lost matches its
 * "Error total EMG" exactly, and this multiplier makes our PR match its
 * "Error rate mEMG" exactly too.
 */
export const PR_SCALE = 1000

export function rollingPr(
  analyses: readonly MatchAnalysis[],
  windowSize = 20,
): readonly RollingPrPoint[] {
  if (!Number.isInteger(windowSize) || windowSize <= 0) {
    throw new RangeError('rolling PR window must be a positive integer')
  }

  return analyses.map((analysis, matchIndex) => {
    const windowStart = Math.max(0, matchIndex - windowSize + 1)
    const aggregate = emptyPerformance()
    for (
      let included = windowStart;
      included <= matchIndex;
      included += 1
    ) {
      const performance = analyses[included]!.performance
      for (const player of PLAYERS) {
        for (const kind of ['checker', 'cube'] as const) {
          aggregate[player][kind].decisions +=
            performance[player][kind].decisions
          aggregate[player][kind].equityLost +=
            performance[player][kind].equityLost
        }
      }
    }
    return {
      matchIndex,
      commitment: analysis.commitment,
      windowStart,
      windowSize: matchIndex - windowStart + 1,
      performance: frozenPerformance(aggregate),
    }
  })
}
