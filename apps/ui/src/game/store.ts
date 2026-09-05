/**
 * Game store. One concern, not a global blob.
 *
 * Holds the engine's GameState plus the UI-only turn draft (see draft.ts), and
 * nothing else. Anything derivable is derived, so there is no second source of
 * truth about the board.
 */

import { create } from 'zustand'
/**
 * Only `canDouble` and `legalMoves` are read from the engine directly. Every
 * state TRANSITION goes through the MatchRecorder, so the record and the board
 * cannot drift apart — importing the engine's transition functions here is what
 * let that happen once already.
 */
import { canDouble, legalMoves, type GameState, type Hop, type PlayerId } from '@nard/engine'
import {
  availableHops,
  completed,
  destinationsFrom,
  emptyDraft,
  movableFrom,
  pushHop,
  undoLast,
  type Draft,
} from './draft'
import { MatchRecorder, saveMatch, type SavedMatchV1 } from '@nard/analysis'
import { archiveMatch } from './archive'
import { decisionMaker, toAbsolutePoint } from './view'
import { sound } from '../sound/player'
import {
  loadProgress,
  recordResult,
  saveProgress,
  type Opponent,
  type Progress,
} from '../ladder/opponents'
import {
  chooseOpponentMove,
  DEFAULT_OPPONENT,
  HOP_GAP_MS,
  DICE_SETTLE_MS,
  opponentTakesDouble,
  READ_THE_ROLL_MS,
  shouldOpponentDouble,
  sleep,
  type OpponentConfig,
} from './opponent'

/**
 * One line of the running turn log.
 *
 * Kept in the store rather than derived from the recorder because the recorder
 * stores DECISIONS, and turning those back into notation means replaying the
 * match from the seed on every render. The log is a view concern; it is
 * appended where the transition already happens and thrown away with the match.
 */
export interface LogEntry {
  readonly id: number
  readonly game: number
  readonly side: PlayerId
  readonly dice: readonly [number, number] | null
  /** Move notation, or the cube action taken. */
  readonly text: string
  readonly kind: 'move' | 'no-play' | 'double' | 'take' | 'drop'
  /**
   * Points this turn touched, in the SCREEN's absolute frame — the light
   * player's — not the engine's on-roll-relative one.
   *
   * Converted here, at the only place that knows whose turn produced them.
   * Storing them relative and converting at the board would mean every reader
   * having to know which side the entry came from, which is exactly the class
   * of mistake AGENTS.md §5 exists to prevent.
   */
  readonly points: readonly number[]
}

interface GameStore {
  state: GameState
  draft: Draft
  /** Point the player has picked a checker up from, if any. */
  selected: number | null
  /** Newest first, so the rail can render it without reversing every frame. */
  log: readonly LogEntry[]
  /** Which game of the match is being played. 1-based. */
  gameNo: number
  /**
   * Owns the game state and the commit-reveal dice.
   *
   * Every match is recorded and replayable by construction rather than as an
   * extra step that can be forgotten — which is also what makes the dice
   * provably fair (docs/dice-fairness.md) and the analysis possible at all.
   */
  recorder: MatchRecorder

  opponent: OpponentConfig
  /** True while the opponent is deciding, for the UI to show a quiet marker. */
  thinking: boolean
  /** True when the strong engine was unavailable and play fell back. */
  degraded: boolean
  /** Re-entry guard for the opponent driver. */
  busy: boolean
  /**
   * Skip the opponent's deliberate pacing. For automated playtests only — the
   * pauses exist so a person can follow the move, and a script cannot.
   */
  fast: boolean
  setFast(on: boolean): void

  /** Which screen is showing. The ladder is the entry point. */
  view: 'ladder' | 'play' | 'review'
  opponentId: string
  progress: Progress
  /** The archived match just finished, so Review knows what to open. */
  lastMatchId: string | null
  startMatch(opponent: Opponent, matchLength: number): void
  toLadder(): void
  toReview(): void
  runOpponent(): Promise<void>
  setOpponent(config: Partial<OpponentConfig>): void

  roll(): void
  select(point: number | null): void
  moveTo(to: number): void
  undo(): void
  double(): void
  take(): void
  passCube(): void
  nextGame(): void
}

function newRecorder(matchLength = 7): MatchRecorder {
  const seed = new Uint8Array(32)
  globalThis.crypto.getRandomValues(seed)
  return new MatchRecorder(seed, {
    startedAt: new Date().toISOString(),
    match: { length: matchLength, score: { light: 0, dark: 0 }, crawfordUsed: false, jacoby: false },
    rules: { variant: 'standard', automaticDoubles: false },
  })
}

const fresh = () => {
  const recorder = newRecorder()
  return {
    recorder,
    state: recorder.state,
    draft: emptyDraft(recorder.state.position),
    selected: null,
    log: [] as readonly LogEntry[],
    gameNo: 1,
  }
}

let logSeq = 0

export const useGame = create<GameStore>((set, get) => {
  /**
   * Append one line to the turn log.
   *
   * Capped rather than unbounded: a long match is hundreds of turns and the
   * rail only ever shows the tail of it, so keeping the whole thing costs
   * memory and a growing array copy per move for nothing. The full record
   * lives in the recorder, which is what Review reads.
   */
  const note = (entry: Omit<LogEntry, 'id' | 'game'>) => {
    logSeq += 1
    const line: LogEntry = { ...entry, id: logSeq, game: get().gameNo }
    set({ log: [line, ...get().log].slice(0, 120) })
  }

  return ({
  ...fresh(),
  opponent: DEFAULT_OPPONENT,
  thinking: false,
  degraded: false,
  busy: false,
  fast: false,
  view: 'ladder',
  opponentId: 'mehrdad',
  progress: loadProgress(),
  lastMatchId: null,

  startMatch(opponent, matchLength) {
    const recorder = newRecorder(matchLength)
    set({
      recorder,
      state: recorder.state,
      draft: emptyDraft(recorder.state.position),
      selected: null,
      log: [],
      gameNo: 1,
      opponent: { rung: opponent.rung, personality: opponent.personality, side: 'dark' },
      opponentId: opponent.id,
      view: 'play',
      degraded: false,
      lastMatchId: null,
    })
  },

  toLadder() {
    set({ view: 'ladder' })
  },

  toReview() {
    if (get().lastMatchId) set({ view: 'review' })
  },

  setFast(on) {
    set({ fast: on })
  },

  setOpponent(config) {
    set({ opponent: { ...get().opponent, ...config } })
  },

  /**
   * Drive the opponent until it is the player's turn again.
   *
   * A loop rather than one step per call, because a turn can span several
   * phases (offer the cube, roll, move) and the player should see it run
   * through them rather than needing something to poke it each time.
   */
  async runOpponent() {
    const me = get().opponent.side
    if (get().busy) return
    set({ busy: true })
    try {
      for (let guard = 0; guard < 200; guard++) {
        const { state, opponent } = get()

        if (state.phase === 'cube-offered' && decisionMaker(state) === me) {
          // The player doubled; the opponent answers.
          set({ thinking: true })
          const take = await opponentTakesDouble(state)
          await sleep(get().fast ? 0 : READ_THE_ROLL_MS)
          set({ thinking: false })
          take ? get().take() : get().passCube()
          continue
        }
        if (decisionMaker(state) !== me) return
        if (state.phase === 'game-over' || state.phase === 'match-over') return

        if (state.phase === 'to-roll' || state.phase === 'opening-roll') {
          if (state.phase === 'to-roll' && canDouble(state)) {
            set({ thinking: true })
            const doubles = await shouldOpponentDouble(state, opponent)
            set({ thinking: false })
            if (doubles) {
              get().double()
              return // the player now has a decision to make
            }
          }
          get().roll()
          // Let the dice finish tumbling and be READ before anything moves.
          await sleep(get().fast ? 0 : DICE_SETTLE_MS)
          continue
        }

        if (state.phase === 'to-move') {
          set({ thinking: true })
          const started = Date.now()
          const { move, degraded } = await chooseOpponentMove(state, opponent)
          // A floor, not an addition: a slow evaluation does not stack on top.
          const floor = get().fast ? 0 : READ_THE_ROLL_MS
          await sleep(Math.max(0, floor - (Date.now() - started)))
          set({ thinking: false, degraded: get().degraded || degraded })

          if (move === null) {
            // Through the recorder, not the engine directly. Advancing the
            // store while leaving the recorder behind desyncs the two, and the
            // next roll then throws — which is the recorder doing its job.
            if (get().state === state) {
              note({ side: state.onRoll, dice: state.dice, text: '', kind: 'no-play', points: [] })
              const passed = get().recorder.passTurn()
              set({ state: passed, draft: emptyDraft(passed.position) })
            }
            continue
          }
          // One checker at a time, so the player can see what was played.
          for (const hop of move.hops) {
            get().select(hop.from)
            get().moveTo(hop.to)
            await sleep(get().fast ? 0 : HOP_GAP_MS)
          }
          continue
        }
        return
      }
    } finally {
      set({ busy: false, thinking: false })
    }
  },

  roll() {
    const { state, recorder } = get()
    if (state.phase !== 'to-roll' && state.phase !== 'opening-roll') return
    const rolled = recorder.roll()
    sound.play('dice')
    set({ state: rolled, draft: emptyDraft(rolled.position), selected: null })

    // A roll with no legal play is not a decision; do not make the player
    // acknowledge it with a click. Show it, then move on.
    if (rolled.phase === 'to-move' && legalMoves(rolled).length === 0) {
      setTimeout(() => {
        const now = get().state
        if (now === rolled) {
          note({ side: rolled.onRoll, dice: rolled.dice, text: '', kind: 'no-play', points: [] })
          const passed = get().recorder.passTurn()
          set({ state: passed, draft: emptyDraft(passed.position), selected: null })
        }
      }, 900)
    }
  },

  select(point) {
    set({ selected: point })
  },

  moveTo(to) {
    const { state, draft, selected } = get()
    if (selected === null || state.phase !== 'to-move') return
    const legal = legalMoves(state)
    const hop = destinationsFrom(legal, draft, selected).find((h) => h.to === to)
    if (!hop) return

    const next = pushHop(legal, draft, hop as Hop)
    if (!next) return

    const move = completed(legal, next)
    if (move) {
      // Turn is complete — commit it. The engine only ever sees whole turns.
      note({
        side: state.onRoll,
        dice: state.dice,
        text: move.notation,
        kind: 'move',
        // 1..24 only: the bar and the tray are not points to light up.
        points: [
          ...new Set(
            move.hops
              .flatMap((h) => [h.from, h.to])
              .filter((pt) => pt >= 1 && pt <= 24)
              .map((pt) => toAbsolutePoint(pt, state.onRoll)),
          ),
        ],
      })
      const played = get().recorder.playMove(move)
      if (played.phase === 'game-over' || played.phase === 'match-over') {
        sound.play('win', { gain: 0.8 })
      }
      if (played.phase === 'match-over' && played.result) {
        const { progress, opponentId, recorder } = get()
        const next = recordResult(progress, opponentId, played.result.winner === 'light')
        saveProgress(next)
        const id = archiveMatch(recorder.toSavedMatch())
        set({ progress: next, lastMatchId: id })
      }
      set({ state: played, draft: emptyDraft(played.position), selected: null })
      return
    }
    set({ draft: next, selected: null })
  },

  undo() {
    const { state, draft } = get()
    if (draft.hops.length === 0) return
    set({ draft: undoLast(state.position, draft), selected: null })
  },

  double() {
    const { state, recorder } = get()
    if (!canDouble(state)) return
    sound.play('cube')
    note({ side: state.onRoll, dice: null, text: String(state.cube.value * 2), kind: 'double', points: [] })
    set({ state: recorder.offerDouble() })
  },
  take() {
    const { state, recorder } = get()
    if (state.phase !== 'cube-offered') return
    sound.play('cube', { gain: 0.7 })
    note({ side: decisionMaker(state), dice: null, text: String(state.cube.value * 2), kind: 'take', points: [] })
    const next = recorder.takeDouble()
    set({ state: next, draft: emptyDraft(next.position) })
  },
  passCube() {
    const { state, recorder } = get()
    if (state.phase !== 'cube-offered') return
    note({ side: decisionMaker(state), dice: null, text: '', kind: 'drop', points: [] })
    const next = recorder.passDouble()
    set({ state: next, draft: emptyDraft(next.position) })
  },

  nextGame() {
    const { state, recorder } = get()
    if (state.phase !== 'game-over') return
    const next = recorder.startNextGame()
    set({
      state: next,
      draft: emptyDraft(next.position),
      selected: null,
      gameNo: get().gameNo + 1,
    })
  },
  })
})

export interface Affordances {
  readonly movable: readonly number[]
  readonly destinations: readonly number[]
  /**
   * The destinations as HOPS, not just point numbers.
   *
   * The board needs `hit` to choose between a dot and a ring, and `from` to
   * work out which die a landing spends — which is the one piece of
   * information a plain highlight throws away, and the one backgammon needs
   * that chess does not.
   */
  readonly hops: readonly Hop[]
  readonly canUndo: boolean
  readonly anyPlay: boolean
}

/** Derived view of what the player may do right now. */
export function useAffordances(): Affordances {
  const state = useGame((s) => s.state)
  const draft = useGame((s) => s.draft)
  const selected = useGame((s) => s.selected)

  // The human plays light. During the opponent's turn there is nothing to click
  // — without this the player could pick up and move the opponent's checkers.
  if (state.phase !== 'to-move' || state.onRoll !== 'light') {
    return { movable: [], destinations: [], hops: [], canUndo: false, anyPlay: false }
  }
  const legal = legalMoves(state)
  const hops = selected === null ? [] : destinationsFrom(legal, draft, selected)
  return {
    movable: movableFrom(legal, draft),
    destinations: hops.map((h) => h.to),
    hops,
    canUndo: draft.hops.length > 0,
    anyPlay: availableHops(legal, draft).length > 0,
  }
}
