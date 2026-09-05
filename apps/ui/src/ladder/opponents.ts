/**
 * The six opponents.
 *
 * Difficulty is chosen by picking a person, not by dragging a slider. A slider
 * says "how much should I be allowed to win"; a named opponent with a style says
 * "who am I playing tonight", which is the question a player actually asks.
 *
 * Each is a (rung, personality) pair from docs/ai-spec.md. The rungs are ordered
 * and the personalities are deliberately spread across them, so climbing the
 * ladder means meeting stronger play AND unfamiliar styles rather than the same
 * opponent with the noise turned down.
 */

import type { DifficultyRung, Personality } from '@nard/ai'
import type { Key } from '../i18n'

export interface Opponent {
  readonly id: string
  readonly rung: DifficultyRung
  readonly personality: Personality
}

/**
 * Where an opponent's copy lives in the bundles.
 *
 * Their name, the line of character and the way they play are TEXT, so they
 * belong in en.json / fa.json with everything else a player reads — not in this
 * file, which is about rungs and personalities. The cast is honest: the ids are
 * data, so the key cannot be checked at compile time, and the bundle test
 * catches a missing one instead.
 */
export const opponentKey = (id: string, part: 'name' | 'style' | 'blurb'): Key =>
  `opponent.${id}.${part}` as Key

export const OPPONENTS: readonly Opponent[] = [
  {
    id: 'davoud',
    rung: 1,
    personality: 'purist',
  },
  {
    id: 'nasrin',
    rung: 2,
    personality: 'racer',
  },
  {
    id: 'keyvan',
    rung: 3,
    personality: 'blitzer',
  },
  {
    id: 'mehrdad',
    rung: 4,
    personality: 'priming',
  },
  {
    id: 'parvaneh',
    rung: 5,
    personality: 'anchor',
  },
  {
    id: 'ostad',
    rung: 6,
    personality: 'purist',
  },
]

export const opponentById = (id: string): Opponent =>
  OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[3]!

/**
 * Ladder progress — a RECORD, not a gate.
 *
 * Every opponent is available from the first launch. Making an expert beat a
 * beginner before he is allowed to play a strong opponent wastes the evening he
 * actually wanted, and is the kind of progression-for-its-own-sake that
 * AGENTS.md §10 rules out. Beating Ostad still means something; it just does not
 * mean unlocking anything.
 */
export interface Progress {
  readonly beaten: readonly string[]
  readonly record: Readonly<Record<string, { won: number; lost: number }>>
}

export const EMPTY_PROGRESS: Progress = { beaten: [], record: {} }

/** Has this opponent been beaten in a match? Shown as a mark, never as a gate. */
export function isBeaten(id: string, progress: Progress): boolean {
  return progress.beaten.includes(id)
}

const KEY = 'nard.progress'

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_PROGRESS
    const parsed = JSON.parse(raw) as Progress
    return { beaten: parsed.beaten ?? [], record: parsed.record ?? {} }
  } catch {
    return EMPTY_PROGRESS
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // Blocked storage just means progress does not persist. Not worth guarding.
  }
}

export function recordResult(p: Progress, id: string, won: boolean): Progress {
  const prev = p.record[id] ?? { won: 0, lost: 0 }
  return {
    beaten: won && !p.beaten.includes(id) ? [...p.beaten, id] : p.beaten,
    record: {
      ...p.record,
      [id]: { won: prev.won + (won ? 1 : 0), lost: prev.lost + (won ? 0 : 1) },
    },
  }
}
