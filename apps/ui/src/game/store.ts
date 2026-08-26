/**
 * Game store. One concern, not a global blob.
 *
 * Holds the engine's GameState plus the UI-only turn draft (see draft.ts), and
 * nothing else. Anything derivable is derived, so there is no second source of
 * truth about the board.
 */

import { create } from 'zustand'
import {
  canDouble,
  createGameState,
  legalMoves,
  offerDouble,
  passDouble,
  passTurn,
  playMove,
  rollFromSource,
  startNextGame,
  takeDouble,
  type GameState,
  type Hop,
} from '@nard/engine'
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
import { SeededDiceSource } from './dice'
import { decisionMaker } from './view'
import {
  chooseOpponentMove,
  DEFAULT_OPPONENT,
  HOP_GAP_MS,
  opponentTakesDouble,
  shouldOpponentDouble,
  sleep,
  THINK_FLOOR_MS,
  type OpponentConfig,
} from './opponent'

interface GameStore {
  state: GameState
  draft: Draft
  /** Point the player has picked a checker up from, if any. */
  selected: number | null
  rollNumber: number
  dice: SeededDiceSource

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

const fresh = () => {
  const state = createGameState()
  return { state, draft: emptyDraft(state.position), selected: null, rollNumber: 0 }
}

export const useGame = create<GameStore>((set, get) => ({
  ...fresh(),
  dice: new SeededDiceSource(),
  opponent: DEFAULT_OPPONENT,
  thinking: false,
  degraded: false,
  busy: false,
  fast: false,

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
          await sleep(get().fast ? 0 : THINK_FLOOR_MS)
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
          await sleep(get().fast ? 0 : 220)
          continue
        }

        if (state.phase === 'to-move') {
          set({ thinking: true })
          const started = Date.now()
          const { move, degraded } = await chooseOpponentMove(state, opponent)
          // A floor, not an addition: a slow evaluation does not stack on top.
          const floor = get().fast ? 0 : THINK_FLOOR_MS
          await sleep(Math.max(0, floor - (Date.now() - started)))
          set({ thinking: false, degraded: get().degraded || degraded })

          if (move === null) {
            if (get().state === state) set({ state: passTurn(state) })
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
    const { state, dice, rollNumber } = get()
    if (state.phase !== 'to-roll' && state.phase !== 'opening-roll') return
    const rolled = rollFromSource(state, dice, rollNumber)
    set({ state: rolled, rollNumber: rollNumber + 1, draft: emptyDraft(rolled.position), selected: null })

    // A roll with no legal play is not a decision; do not make the player
    // acknowledge it with a click. Show it, then move on.
    if (rolled.phase === 'to-move' && legalMoves(rolled).length === 0) {
      setTimeout(() => {
        const now = get().state
        if (now === rolled) {
          const passed = passTurn(now)
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
      const played = playMove(state, move)
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
    const { state } = get()
    if (!canDouble(state)) return
    set({ state: offerDouble(state) })
  },
  take() {
    const { state } = get()
    if (state.phase !== 'cube-offered') return
    const next = takeDouble(state)
    set({ state: next, draft: emptyDraft(next.position) })
  },
  passCube() {
    const { state } = get()
    if (state.phase !== 'cube-offered') return
    const next = passDouble(state)
    set({ state: next, draft: emptyDraft(next.position) })
  },

  nextGame() {
    const { state } = get()
    if (state.phase !== 'game-over') return
    const next = startNextGame(state)
    set({ state: next, draft: emptyDraft(next.position), selected: null })
  },
}))

export interface Affordances {
  readonly movable: readonly number[]
  readonly destinations: readonly number[]
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
    return { movable: [], destinations: [], canUndo: false, anyPlay: false }
  }
  const legal = legalMoves(state)
  return {
    movable: movableFrom(legal, draft),
    destinations: selected === null ? [] : destinationsFrom(legal, draft, selected).map((h) => h.to),
    canUndo: draft.hops.length > 0,
    anyPlay: availableHops(legal, draft).length > 0,
  }
}
