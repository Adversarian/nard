/**
 * The public type contract for the rules engine.
 *
 * This file is the shared boundary between the engine implementation and every
 * consumer (ai, analysis, ui). It is written before the implementation so that
 * work can proceed in parallel on both sides. Changing a type here changes an
 * agreement — enumerate the readers before you do it (see AGENTS.md §9).
 *
 * BOARD REPRESENTATION — read AGENTS.md §5 before touching anything here.
 * Positions are always described from the perspective of the player on roll.
 */

/** Stable player identity, used by the UI, scoring and saved matches. */
export type PlayerId = 'light' | 'dark'

export type Die = 1 | 2 | 3 | 4 | 5 | 6

/** The two dice of a roll. Doubles are `[d, d]` and yield four moves. */
export type Dice = readonly [Die, Die]

/** The bar, in on-roll coordinates. A checker here enters on `25 - die`. */
export const BAR = 25
/** Borne off, in on-roll coordinates. A checker reaches here at `p - die <= 0`. */
export const OFF = 0

/**
 * A board from the perspective of the player on roll.
 *
 *   pts[1..24]  signed checker count; positive = on roll, negative = opponent
 *   pts[25]     on-roll player's checkers on the bar (positive)
 *   pts[0]      opponent's checkers on the bar (negative)
 *
 * The on-roll player always moves from high points toward low, so a checker on
 * point `p` playing die `d` lands on `p - d`, uniformly — entering from the bar
 * and bearing off are the same arithmetic, not special cases.
 */
export interface Position {
  readonly pts: Int8Array
  /** Checkers the on-roll player has borne off. */
  readonly off: number
  /** Checkers the opponent has borne off. */
  readonly oppOff: number
}

/** One checker relocation within a turn. `from`/`to` are on-roll coordinates. */
export interface Hop {
  readonly from: number
  readonly to: number
  /** True when this hop sends an opposing blot to the bar. */
  readonly hit: boolean
}

/**
 * A complete turn: one to four hops, already validated as legal together.
 * `notation` is standard backgammon shorthand ("8/5 6/5", "bar/20*") and is the
 * interchange format with gnubg.
 */
export interface Move {
  readonly hops: readonly Hop[]
  readonly notation: string
}

export interface CubeState {
  /** 1, 2, 4, … The engine does not cap; the UI stops offering above 64. */
  readonly value: number
  /** `null` while the cube is centred. */
  readonly owner: PlayerId | null
}

export interface MatchState {
  /** Points to win. `0` means money play. */
  readonly length: number
  readonly score: Readonly<Record<PlayerId, number>>
  /** True when *this* game is the Crawford game. */
  readonly crawford: boolean
  /** True once the Crawford game has been played. */
  readonly crawfordUsed: boolean
  /** Money play only. */
  readonly jacoby: boolean
}

export type WinKind = 'single' | 'gammon' | 'backgammon'

export interface GameResult {
  readonly winner: PlayerId
  readonly kind: WinKind
  /** Points scored, cube value already applied. */
  readonly points: number
}

export type Phase =
  | 'opening-roll'
  | 'to-roll'
  | 'to-move'
  | 'cube-offered'
  | 'game-over'
  | 'match-over'

/** Everything needed to render the game and decide what may happen next. */
export interface GameState {
  readonly position: Position
  readonly onRoll: PlayerId
  /** `null` before the roll. */
  readonly dice: Dice | null
  /** Dice not yet consumed this turn; drives the UI's move affordances. */
  readonly remaining: readonly Die[]
  readonly cube: CubeState
  readonly match: MatchState
  readonly phase: Phase
  readonly result: GameResult | null
}

/**
 * Source of dice. The engine NEVER calls Math.random(); everything comes
 * through here, which is what makes matches replayable and the fairness
 * guarantee in docs/dice-fairness.md possible.
 */
export interface DiceSource {
  /** The n-th roll of the match, 0-indexed. Must be a pure function of n. */
  roll(n: number): Dice
}

export type Variant =
  | 'standard'
  | 'nackgammon'
  | 'hypergammon'
  | 'mahbooseh'
  | 'gulbara'

/**
 * Positional features used by AI personalities to bias move selection
 * (docs/ai-spec.md). Computed from the on-roll player's perspective.
 */
export interface StyleFeatures {
  /** Longest run of consecutive made points, 1..6. */
  readonly primeLength: number
  readonly blots: number
  /** Sum over our blots of the probability of being hit next roll. */
  readonly blotExposure: number
  /** Opponent checkers trapped behind our blockade. */
  readonly trapped: number
  /** Our pip count minus theirs; positive means we are ahead. */
  readonly raceLead: number
  /** Highest opponent-home-board anchor we hold, 0 if none. */
  readonly anchor: number
  readonly homePoints: number
  readonly oppOnBar: number
}
