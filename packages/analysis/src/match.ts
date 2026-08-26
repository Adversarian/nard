import {
  CommitRevealDiceSource,
  applyMove,
  bytesToHex,
  createGameState,
  createMatchState,
  decodePositionId,
  diceCommitment,
  encodePositionId,
  generateLegalMoves,
  offerDouble,
  passDouble,
  passTurn,
  playMove,
  rollFromSource,
  startNextGame,
  takeDouble,
  verifyDiceCommitment,
  type GameState,
  type MatchOptions,
  type Move,
  type PlayerId,
  type RulesConfig,
} from '@nard/engine'

export interface SavedMatchSetupV1 {
  readonly length: number
  readonly score: Readonly<Record<PlayerId, number>>
  readonly crawfordUsed: boolean
  readonly jacoby: boolean
}

export interface SavedRulesV1 {
  readonly variant: 'standard'
  readonly automaticDoubles: boolean
}

export interface SavedPlayerV1 {
  readonly name: string
}

export interface SavedMatchMetaV1 {
  /** Supplied by the host; the recording layer never reads the clock. */
  readonly startedAt: string
  readonly completedAt?: string
  readonly match: SavedMatchSetupV1
  readonly rules: SavedRulesV1
  readonly players?: Partial<Readonly<Record<PlayerId, SavedPlayerV1>>>
}

export type SavedDecisionV1 =
  | { readonly kind: 'roll' }
  | { readonly kind: 'move'; readonly positionId: string }
  | { readonly kind: 'pass-turn' }
  | { readonly kind: 'double' }
  | { readonly kind: 'take' }
  | { readonly kind: 'drop' }
  | { readonly kind: 'next-game' }

export interface SavedMatchV1 {
  readonly v: 1
  /** Lower-case hex, exactly 32 bytes. */
  readonly seed: string
  /** Lower-case SHA-256 hex, exactly 32 bytes. */
  readonly commitment: string
  readonly decisions: readonly SavedDecisionV1[]
  readonly meta: SavedMatchMetaV1
}

export interface ReplayStep {
  readonly decisionIndex: number
  readonly gameIndex: number
  readonly decision: SavedDecisionV1
  readonly before: GameState
  readonly after: GameState
  readonly rollNumberBefore: number
  readonly rollNumberAfter: number
  /** Present for move decisions after matching the saved resulting position. */
  readonly move?: Move
}

export interface MatchReplay {
  readonly state: GameState
  readonly rollNumber: number
  readonly decisionIndex: number
  readonly gameIndex: number
  readonly steps: readonly ReplayStep[]
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`)
  }
  return value
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean`)
  return value
}

function integer(value: unknown, name: string): number {
  if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer`)
  return value as number
}

function hexBytes(value: unknown, name: string): Uint8Array {
  const encoded = string(value, name)
  if (!/^[0-9a-fA-F]{64}$/.test(encoded)) {
    throw new RangeError(`${name} must be exactly 32 bytes of hex`)
  }
  const bytes = new Uint8Array(32)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(encoded.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function player(
  value: unknown,
  name: string,
): SavedPlayerV1 {
  const record = object(value, name)
  return { ...record, name: string(record.name, `${name}.name`) }
}

function meta(value: unknown): SavedMatchMetaV1 {
  const record = object(value, 'match.meta')
  const setup = object(record.match, 'match.meta.match')
  const score = object(setup.score, 'match.meta.match.score')
  const rules = object(record.rules, 'match.meta.rules')

  const length = integer(setup.length, 'match.meta.match.length')
  const light = integer(score.light, 'match.meta.match.score.light')
  const dark = integer(score.dark, 'match.meta.match.score.dark')
  const crawfordUsed = boolean(
    setup.crawfordUsed,
    'match.meta.match.crawfordUsed',
  )
  const jacoby = boolean(setup.jacoby, 'match.meta.match.jacoby')

  // The engine is the authority for match-option invariants.
  createMatchState({
    length,
    score: { light, dark },
    crawfordUsed,
    jacoby,
  })

  if (rules.variant !== 'standard') {
    throw new Error('match.meta.rules.variant must be standard in format v1')
  }
  const automaticDoubles = boolean(
    rules.automaticDoubles,
    'match.meta.rules.automaticDoubles',
  )

  let players: SavedMatchMetaV1['players']
  if (record.players !== undefined) {
    const savedPlayers = object(record.players, 'match.meta.players')
    players = {
      ...savedPlayers,
      ...(savedPlayers.light === undefined
        ? {}
        : { light: player(savedPlayers.light, 'match.meta.players.light') }),
      ...(savedPlayers.dark === undefined
        ? {}
        : { dark: player(savedPlayers.dark, 'match.meta.players.dark') }),
    }
  }

  const completedAt =
    record.completedAt === undefined
      ? {}
      : {
          completedAt: string(
            record.completedAt,
            'match.meta.completedAt',
          ),
        }
  const parsedPlayers = players === undefined ? {} : { players }

  return {
    ...record,
    startedAt: string(record.startedAt, 'match.meta.startedAt'),
    ...completedAt,
    match: {
      ...setup,
      length,
      score: { ...score, light, dark },
      crawfordUsed,
      jacoby,
    },
    rules: {
      ...rules,
      variant: 'standard',
      automaticDoubles,
    },
    ...parsedPlayers,
  } as SavedMatchMetaV1
}

function decision(value: unknown, index: number): SavedDecisionV1 {
  const record = object(value, `match.decisions[${index}]`)
  const kind = record.kind

  switch (kind) {
    case 'roll':
    case 'pass-turn':
    case 'double':
    case 'take':
    case 'drop':
    case 'next-game':
      return { ...record, kind } as SavedDecisionV1
    case 'move': {
      const positionId = string(
        record.positionId,
        `match.decisions[${index}].positionId`,
      )
      decodePositionId(positionId)
      return { ...record, kind, positionId } as SavedDecisionV1
    }
    default:
      throw new Error(`unknown match decision kind at index ${index}: ${String(kind)}`)
  }
}

/** Parse and validate a versioned saved match without performing any I/O. */
export function loadMatch(input: string | unknown): SavedMatchV1 {
  const parsed: unknown = typeof input === 'string' ? JSON.parse(input) : input
  const record = object(parsed, 'match')
  if (record.v !== 1) {
    throw new Error(`unsupported saved-match version: ${String(record.v)}`)
  }

  const seedBytes = hexBytes(record.seed, 'match.seed')
  const commitmentBytes = hexBytes(record.commitment, 'match.commitment')
  if (!verifyDiceCommitment(seedBytes, commitmentBytes)) {
    throw new Error('saved-match commitment does not match its seed')
  }
  if (!Array.isArray(record.decisions)) {
    throw new TypeError('match.decisions must be an array')
  }

  return {
    ...record,
    v: 1,
    seed: bytesToHex(seedBytes),
    commitment: bytesToHex(commitmentBytes),
    decisions: record.decisions.map(decision),
    meta: meta(record.meta),
  } as SavedMatchV1
}

/** Stable JSON representation suitable for a `matches/*.json` file. */
export function saveMatch(match: SavedMatchV1): string {
  return `${JSON.stringify(loadMatch(match), null, 2)}\n`
}

function seedBytes(match: SavedMatchV1): Uint8Array {
  return hexBytes(match.seed, 'match.seed')
}

function matchOptions(metaValue: SavedMatchMetaV1): MatchOptions {
  return {
    length: metaValue.match.length,
    score: metaValue.match.score,
    crawfordUsed: metaValue.match.crawfordUsed,
    jacoby: metaValue.match.jacoby,
  }
}

function rulesConfig(metaValue: SavedMatchMetaV1): RulesConfig {
  return {
    variant: metaValue.rules.variant,
    automaticDoubles: metaValue.rules.automaticDoubles,
  }
}

function moveForDecision(state: GameState, saved: SavedDecisionV1): Move {
  if (saved.kind !== 'move') throw new Error('expected a move decision')
  const move = generateLegalMoves(state.position, state.dice!).find(
    (candidate) =>
      encodePositionId(applyMove(state.position, candidate)) === saved.positionId,
  )
  if (move === undefined) {
    throw new Error(
      `saved move ${saved.positionId} is not legal at decision position`,
    )
  }
  return move
}

function applyDecision(
  state: GameState,
  saved: SavedDecisionV1,
  dice: CommitRevealDiceSource,
  rollNumber: number,
  rules: RulesConfig,
): { readonly state: GameState; readonly rollNumber: number; readonly move?: Move } {
  switch (saved.kind) {
    case 'roll':
      return {
        state: rollFromSource(state, dice, rollNumber, rules),
        rollNumber: rollNumber + 1,
      }
    case 'move': {
      const move = moveForDecision(state, saved)
      return { state: playMove(state, move), rollNumber, move }
    }
    case 'pass-turn':
      return { state: passTurn(state), rollNumber }
    case 'double':
      return { state: offerDouble(state), rollNumber }
    case 'take':
      return { state: takeDouble(state), rollNumber }
    case 'drop':
      return { state: passDouble(state), rollNumber }
    case 'next-game':
      return { state: startNextGame(state, rules), rollNumber }
  }
}

/** Replay exactly the first `throughDecision` recorded transitions. */
export function replayMatch(
  saved: SavedMatchV1,
  throughDecision = saved.decisions.length,
): MatchReplay {
  const match = loadMatch(saved)
  if (
    !Number.isInteger(throughDecision) ||
    throughDecision < 0 ||
    throughDecision > match.decisions.length
  ) {
    throw new RangeError('throughDecision is outside the saved decision list')
  }

  const source = new CommitRevealDiceSource(seedBytes(match))
  const rules = rulesConfig(match.meta)
  let state = createGameState(createMatchState(matchOptions(match.meta)))
  let rollNumber = 0
  let gameIndex = 0
  const steps: ReplayStep[] = []

  for (let index = 0; index < throughDecision; index += 1) {
    const savedDecision = match.decisions[index]!
    const before = state
    const rollNumberBefore = rollNumber
    const applied = applyDecision(
      state,
      savedDecision,
      source,
      rollNumber,
      rules,
    )
    state = applied.state
    rollNumber = applied.rollNumber

    steps.push({
      decisionIndex: index,
      gameIndex,
      decision: savedDecision,
      before,
      after: state,
      rollNumberBefore,
      rollNumberAfter: rollNumber,
      ...(applied.move === undefined ? {} : { move: applied.move }),
    })
    if (savedDecision.kind === 'next-game') gameIndex += 1
  }

  return {
    state,
    rollNumber,
    decisionIndex: throughDecision,
    gameIndex,
    steps,
  }
}

/**
 * Stateful only because recording is stateful. Every transition still delegates
 * to the pure engine, and the resulting file replays without this class.
 */
export class MatchRecorder {
  readonly #seed: Uint8Array
  readonly #commitment: Uint8Array
  readonly #meta: SavedMatchMetaV1
  readonly #rules: RulesConfig
  readonly #dice: CommitRevealDiceSource
  readonly #decisions: SavedDecisionV1[] = []
  #state: GameState
  #rollNumber = 0

  constructor(seed: Uint8Array, metaValue: SavedMatchMetaV1) {
    if (seed.length !== 32) throw new RangeError('match seed must be exactly 32 bytes')
    this.#seed = new Uint8Array(seed)
    this.#commitment = diceCommitment(this.#seed)
    this.#meta = meta(metaValue)
    this.#rules = rulesConfig(this.#meta)
    this.#dice = new CommitRevealDiceSource(this.#seed)
    this.#state = createGameState(createMatchState(matchOptions(this.#meta)))
  }

  get state(): GameState {
    return this.#state
  }

  get rollNumber(): number {
    return this.#rollNumber
  }

  get decisions(): readonly SavedDecisionV1[] {
    return this.#decisions
  }

  roll(): GameState {
    this.#state = rollFromSource(
      this.#state,
      this.#dice,
      this.#rollNumber,
      this.#rules,
    )
    this.#rollNumber += 1
    this.#decisions.push({ kind: 'roll' })
    return this.#state
  }

  playMove(move: Move): GameState {
    const positionId = encodePositionId(applyMove(this.#state.position, move))
    this.#state = playMove(this.#state, move)
    this.#decisions.push({ kind: 'move', positionId })
    return this.#state
  }

  passTurn(): GameState {
    this.#state = passTurn(this.#state)
    this.#decisions.push({ kind: 'pass-turn' })
    return this.#state
  }

  offerDouble(): GameState {
    this.#state = offerDouble(this.#state)
    this.#decisions.push({ kind: 'double' })
    return this.#state
  }

  takeDouble(): GameState {
    this.#state = takeDouble(this.#state)
    this.#decisions.push({ kind: 'take' })
    return this.#state
  }

  passDouble(): GameState {
    this.#state = passDouble(this.#state)
    this.#decisions.push({ kind: 'drop' })
    return this.#state
  }

  startNextGame(): GameState {
    this.#state = startNextGame(this.#state, this.#rules)
    this.#decisions.push({ kind: 'next-game' })
    return this.#state
  }

  toSavedMatch(): SavedMatchV1 {
    return {
      v: 1,
      seed: bytesToHex(this.#seed),
      commitment: bytesToHex(this.#commitment),
      decisions: [...this.#decisions],
      meta: this.#meta,
    }
  }
}
