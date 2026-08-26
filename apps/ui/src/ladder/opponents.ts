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
import type { Lang } from '../i18n/strings'

export interface Opponent {
  readonly id: string
  readonly rung: DifficultyRung
  readonly personality: Personality
  readonly name: Readonly<Record<Lang, string>>
  /** One line of character, shown on the card. */
  readonly blurb: Readonly<Record<Lang, string>>
  /** How they play, in the player's terms. Not a difficulty number. */
  readonly style: Readonly<Record<Lang, string>>
}

export const OPPONENTS: readonly Opponent[] = [
  {
    id: 'davoud',
    rung: 1,
    personality: 'purist',
    name: { en: 'Davoud', fa: 'داوود' },
    blurb: {
      en: 'Learned the rules a year ago and has not lost interest yet.',
      fa: 'پارسال قواعد را یاد گرفته و هنوز خسته نشده.',
    },
    style: { en: 'Plays the obvious move', fa: 'حرکت واضح را بازی می‌کند' },
  },
  {
    id: 'nasrin',
    rung: 2,
    personality: 'racer',
    name: { en: 'Nasrin', fa: 'نسرین' },
    blurb: {
      en: 'Hates a fight. Would rather be two pips ahead than hold an anchor.',
      fa: 'از درگیری بدش می‌آید. دو خانه جلو بودن را به لنگر ترجیح می‌دهد.',
    },
    style: { en: 'Runs for home', fa: 'به سمت خانه فرار می‌کند' },
  },
  {
    id: 'keyvan',
    rung: 3,
    personality: 'blitzer',
    name: { en: 'Keyvan', fa: 'کیوان' },
    blurb: {
      en: 'Learned in a coffee house. Hits first and counts afterwards.',
      fa: 'در قهوه‌خانه یاد گرفته. اول می‌زند، بعد حساب می‌کند.',
    },
    style: { en: 'Attacks', fa: 'حمله می‌کند' },
  },
  {
    id: 'mehrdad',
    rung: 4,
    personality: 'priming',
    name: { en: 'Mehrdad', fa: 'مهرداد' },
    blurb: {
      en: 'Patient to a fault. Will build a wall and wait behind it all evening.',
      fa: 'بیش از حد صبور. دیوار می‌سازد و تمام شب پشتش صبر می‌کند.',
    },
    style: { en: 'Builds primes', fa: 'دیوار می‌سازد' },
  },
  {
    id: 'parvaneh',
    rung: 5,
    personality: 'anchor',
    name: { en: 'Parvaneh', fa: 'پروانه' },
    blurb: {
      en: 'Happy to be behind. Holds two points in your home board and waits.',
      fa: 'از عقب بودن ناراحت نیست. دو خانه در خانهٔ تو می‌گیرد و صبر می‌کند.',
    },
    style: { en: 'Plays a backgame', fa: 'بازی عقب می‌کند' },
  },
  {
    id: 'ostad',
    rung: 6,
    personality: 'purist',
    name: { en: 'Ostad', fa: 'استاد' },
    blurb: {
      en: 'No style at all. Only the best move, every time.',
      fa: 'هیچ سبکی ندارد. فقط بهترین حرکت، هر بار.',
    },
    style: { en: 'Pure equity', fa: 'فقط بهترین حرکت' },
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
