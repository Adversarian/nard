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

interface GameStore {
  state: GameState
  draft: Draft
  /** Point the player has picked a checker up from, if any. */
  selected: number | null
  rollNumber: number
  dice: SeededDiceSource

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

  if (state.phase !== 'to-move') {
    return { movable: [], destinations: [], canUndo: draft.hops.length > 0, anyPlay: false }
  }
  const legal = legalMoves(state)
  return {
    movable: movableFrom(legal, draft),
    destinations: selected === null ? [] : destinationsFrom(legal, draft, selected).map((h) => h.to),
    canUndo: draft.hops.length > 0,
    anyPlay: availableHops(legal, draft).length > 0,
  }
}
