import {
  applyMove,
  createGameState,
  createMatchState,
  encodePositionId,
  passTurn,
  playMove,
  rollGame,
  type Dice,
  type Die,
  type GameState,
  type PlayerId,
  type Position,
} from '../packages/engine/src/index.js'
import {
  createEvaluator,
  DIFFICULTIES,
  PERSONALITY_SAFETY_CLAMP,
  selectRankedMove,
  type DifficultyRung,
  type Evaluator,
  type RankedMove,
} from '../packages/ai/src/index.js'

const DEFAULT_GAMES = 12
const DEFAULT_DECISIONS = 240
const DEFAULT_SEED = 0x4e415244
const MAX_TURNS = 1_000
const RUNGS = [1, 2, 3, 4, 5, 6] as const

interface RungStats {
  decisions: number
  equityLost: number
}

interface RungResult extends RungStats {
  readonly rung: DifficultyRung
  readonly games: number
  readonly pr: number
}

function integerArgument(name: string, fallback: number): number {
  const prefix = `--${name}=`
  const value = process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
  if (value === undefined) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return parsed
}

function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function die(random: () => number): Die {
  return (Math.floor(random() * 6) + 1) as Die
}

function roll(random: () => number): Dice {
  return [die(random), die(random)]
}

function moveId(position: Position, move: RankedMove): string {
  return encodePositionId(applyMove(position, move.move))
}

async function rankedAt(
  evaluator: Evaluator,
  state: GameState,
  plies: 0 | 1 | 2,
): Promise<RankedMove[]> {
  if (state.dice === null) throw new Error('cannot evaluate before rolling')
  return evaluator.rankMoves(state.position, state.dice, { plies })
}

function expectedEquityLoss(
  position: Position,
  candidates: readonly RankedMove[],
  referenceLoss: ReadonlyMap<string, number>,
  tau: number,
): number {
  const eligible = candidates.filter(
    (candidate) => candidate.eqdiff >= PERSONALITY_SAFETY_CLAMP,
  )
  if (eligible.length === 0) {
    throw new Error('difficulty policy discarded every legal move')
  }

  const bestEquity = Math.max(...eligible.map(({ equity }) => equity))
  if (tau === 0) {
    const best = eligible.find(({ equity }) => equity === bestEquity)!
    const loss = referenceLoss.get(moveId(position, best))
    if (loss === undefined) throw new Error('reference omitted a legal move')
    return loss
  }

  let weightedLoss = 0
  let totalWeight = 0
  for (const candidate of eligible) {
    const weight = Math.exp((candidate.equity - bestEquity) / tau)
    const loss = referenceLoss.get(moveId(position, candidate))
    if (loss === undefined) throw new Error('reference omitted a legal move')
    weightedLoss += weight * loss
    totalWeight += weight
  }
  return weightedLoss / totalWeight
}

async function playCorpusGame(
  evaluator: Evaluator,
  challenger: DifficultyRung,
  challengerPlayer: PlayerId,
  diceRandom: () => number,
  moveRandom: () => number,
  stats: Readonly<Record<DifficultyRung, RungStats>>,
): Promise<void> {
  let state = createGameState(createMatchState({ length: 1 }))
  let turns = 0

  while (state.phase !== 'match-over') {
    if (turns >= MAX_TURNS) {
      throw new Error(`self-play game exceeded ${MAX_TURNS} turns`)
    }

    if (state.phase === 'opening-roll' || state.phase === 'to-roll') {
      state = rollGame(state, roll(diceRandom))
      if (state.phase !== 'to-move') continue
    }

    if (state.phase !== 'to-move') {
      throw new Error(`self-play reached unsupported phase ${state.phase}`)
    }

    const reference = await rankedAt(evaluator, state, 2)
    if (reference.length === 0) {
      state = passTurn(state)
      turns += 1
      continue
    }

    let candidates0: readonly RankedMove[] = reference
    let candidates1: readonly RankedMove[] = reference

    if (reference.length > 1) {
      candidates0 = await rankedAt(evaluator, state, 0)
      candidates1 = await rankedAt(evaluator, state, 1)
      const referenceLoss = new Map(
        reference.map((candidate) => [
          moveId(state.position, candidate),
          -candidate.eqdiff,
        ]),
      )

      for (const rung of RUNGS) {
        const difficulty = DIFFICULTIES[rung]
        const candidates =
          difficulty.plies === 0
            ? candidates0
            : difficulty.plies === 1
              ? candidates1
              : reference
        stats[rung].decisions += 1
        stats[rung].equityLost += expectedEquityLoss(
          state.position,
          candidates,
          referenceLoss,
          difficulty.tau,
        )
      }
    }

    const playerRung =
      state.onRoll === challengerPlayer ? challenger : (6 as const)
    const difficulty = DIFFICULTIES[playerRung]
    const candidates =
      difficulty.plies === 0
        ? candidates0
        : difficulty.plies === 1
          ? candidates1
          : reference
    const selected =
      reference.length === 1
        ? reference[0]!
        : selectRankedMove(state.position, candidates, {
            rung: playerRung,
            personality: 'purist',
            random: moveRandom,
          })

    state = playMove(state, selected.move)
    turns += 1
  }
}

function printResults(results: readonly RungResult[]): void {
  console.log('Expected checker-play PR on shared rung-vs-6 self-play corpus')
  console.log('Rung  Plies      τ   Games  Decisions      PR')

  for (const result of results) {
    const difficulty = DIFFICULTIES[result.rung]
    console.log(
      [
        String(result.rung).padStart(4),
        String(difficulty.plies).padStart(6),
        difficulty.tau.toFixed(3).padStart(7),
        String(result.games).padStart(7),
        String(result.decisions).padStart(10),
        result.pr.toFixed(2).padStart(7),
      ].join(' '),
    )
  }
}

function assertMonotonic(results: readonly RungResult[]): void {
  for (let index = 1; index < results.length; index += 1) {
    const weaker = results[index - 1]!
    const stronger = results[index]!
    if (stronger.pr >= weaker.pr) {
      throw new Error(
        `PR is not improving from rung ${weaker.rung} (${weaker.pr.toFixed(2)}) ` +
          `to rung ${stronger.rung} (${stronger.pr.toFixed(2)})`,
      )
    }
  }
}

const minimumGames = integerArgument('games', DEFAULT_GAMES)
const minimumDecisions = integerArgument('decisions', DEFAULT_DECISIONS)
const seed = integerArgument('seed', DEFAULT_SEED)
const evaluator = await createEvaluator({ allowFallback: false })
const stats: Record<DifficultyRung, RungStats> = {
  1: { decisions: 0, equityLost: 0 },
  2: { decisions: 0, equityLost: 0 },
  3: { decisions: 0, equityLost: 0 },
  4: { decisions: 0, equityLost: 0 },
  5: { decisions: 0, equityLost: 0 },
  6: { decisions: 0, equityLost: 0 },
}

try {
  let games = 0
  while (games < minimumGames || stats[1].decisions < minimumDecisions) {
    const challenger = RUNGS[games % RUNGS.length]!
    const challengerPlayer: PlayerId =
      Math.floor(games / RUNGS.length) % 2 === 0 ? 'light' : 'dark'
    const gameSeed = (seed ^ games) >>> 0
    await playCorpusGame(
      evaluator,
      challenger,
      challengerPlayer,
      pseudoRandom(gameSeed),
      pseudoRandom(gameSeed ^ 0xa5a5a5a5),
      stats,
    )
    games += 1
    console.log(
      `Corpus game ${games}: rung ${challenger} vs rung 6, ` +
        `${stats[1].decisions} shared decisions`,
    )
  }

  const results = RUNGS.map((rung): RungResult => {
    const rungStats = stats[rung]
    return {
      rung,
      games,
      ...rungStats,
      pr:
        rungStats.decisions === 0
          ? 0
          : (500 * rungStats.equityLost) / rungStats.decisions,
    }
  })

  printResults(results)
  assertMonotonic(results)
} finally {
  await evaluator.dispose()
}
