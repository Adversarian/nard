/**
 * Interface language.
 *
 * Persian is not a translation layer bolted on — it is the language the player
 * actually thinks about this game in, so the terms are the ones used at a real
 * board (تاس for the dice, مارس for a gammon), not literal renderings of the
 * English.
 *
 * Note what does NOT change with language: the board. See
 * docs/design-language.md — an experienced player has a fixed spatial model of
 * a board, and mirroring it because he switched language would be hostile.
 * Only the surrounding chrome flips.
 */

export type Lang = 'en' | 'fa'

export interface Strings {
  readonly appName: string
  readonly matchTo: (n: number) => string
  readonly moneyGame: string
  readonly crawford: string
  readonly roll: string
  readonly undo: string
  readonly take: (v: number) => string
  readonly pass: string
  readonly double: string
  readonly noPlay: string
  readonly you: string
  readonly opponent: string
  readonly thinking: string
  readonly reducedEngine: string
  readonly reducedEngineHint: string
  readonly youWin: string
  readonly theyWin: string
  readonly nextGame: string
  readonly matchOver: string
  readonly mute: string
  readonly unmute: string
  readonly gammon: string
  readonly backgammon: string
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Render a number in the interface's own digits. */
export function digits(n: number, lang: Lang): string {
  const s = String(n)
  return lang === 'fa' ? s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]!) : s
}

const en: Strings = {
  appName: 'nard',
  matchTo: (n) => `Match to ${n}`,
  moneyGame: 'Money game',
  crawford: 'Crawford',
  roll: 'Roll',
  undo: 'Undo',
  take: (v) => `Take ${v}`,
  pass: 'Pass',
  double: 'Double',
  noPlay: 'No legal play',
  you: 'You',
  opponent: 'Opponent',
  thinking: 'thinking…',
  reducedEngine: 'reduced engine',
  reducedEngineHint:
    'The strong engine is unavailable; the opponent is playing on a weaker fallback.',
  youWin: 'You win',
  theyWin: 'Opponent wins',
  nextGame: 'Next game',
  matchOver: 'Match over',
  mute: 'Mute',
  unmute: 'Unmute',
  gammon: 'gammon',
  backgammon: 'backgammon',
}

const fa: Strings = {
  appName: 'نرد',
  matchTo: (n) => `مسابقه تا ${digits(n, 'fa')}`,
  moneyGame: 'بازی پولی',
  crawford: 'کرافورد',
  roll: 'تاس',
  undo: 'برگشت',
  take: (v) => `قبول ${digits(v, 'fa')}`,
  pass: 'پاس',
  double: 'دوبل',
  noPlay: 'حرکتی نداری',
  you: 'شما',
  opponent: 'حریف',
  thinking: 'در حال فکر…',
  reducedEngine: 'موتور ضعیف',
  reducedEngineHint: 'موتور اصلی در دسترس نیست؛ حریف با موتور ضعیف‌تری بازی می‌کند.',
  youWin: 'بردی',
  theyWin: 'حریف برد',
  nextGame: 'بازی بعدی',
  matchOver: 'پایان مسابقه',
  mute: 'بی‌صدا',
  unmute: 'صدا',
  // مارس is what the game is actually called at an Iranian board, not a gloss.
  gammon: 'مارس',
  backgammon: 'مارس ترکی',
}

export const STRINGS: Readonly<Record<Lang, Strings>> = { en, fa }

export function langFromUrl(): Lang {
  const l = new URLSearchParams(location.search).get('lang')
  return l === 'fa' ? 'fa' : 'en'
}
