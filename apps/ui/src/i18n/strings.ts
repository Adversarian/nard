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
  readonly soundOn: string
  readonly soundOff: string
  readonly gammon: string
  readonly backgammon: string
  readonly yourTurn: string
  readonly theirTurn: string
  readonly cube: string
  readonly game: string
  readonly noMovesYet: string
  readonly offeredYou: (v: string) => string
  readonly level: string
  readonly youLeadBy: (v: string) => string
  readonly theyLeadBy: (v: string) => string
  readonly tookIt: string
  readonly passed: string
  readonly chooseOpponent: string
  readonly playTo: string
  readonly barPoint: string
  readonly offTray: string
  readonly hit: string
  readonly matchLengthHint: (n: string) => string
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Render a number in the interface's own digits. */
export function digits(n: number, lang: Lang): string {
  const s = String(n)
  return lang === 'fa' ? s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]!) : s
}

/**
 * Move notation for display.
 *
 * The digits become Persian ones in the Persian interface — a player reading
 * ۱۳/۱۰ should not have to switch numeral systems halfway down a column whose
 * dice are already in Persian. `bar` stays Latin: it is a technical token of
 * standard backgammon notation, the same way chess keeps its file letters, and
 * mixing an Arabic-script word into a forced-LTR run is a bidi problem for no
 * gain.
 *
 * The caller must render the result inside `dir="ltr"`. Notation is inherently
 * left-to-right — it reads from-point then to-point — and in an RTL paragraph
 * the hit marker migrates off the end of the play it belongs to.
 */
export function notation(text: string, lang: Lang): string {
  return lang === 'fa' ? digits2(text) : text
}

const digits2 = (s: string) => s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]!)

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
  soundOn: 'On',
  soundOff: 'Off',
  gammon: 'gammon',
  backgammon: 'backgammon',
  yourTurn: 'your move',
  theirTurn: 'on roll',
  cube: 'cube',
  game: 'Game',
  noMovesYet: 'No moves yet.',
  offeredYou: (v) => `Doubled to ${v}.`,
  level: 'level',
  youLeadBy: (v) => `you +${v}`,
  theyLeadBy: (v) => `them +${v}`,
  tookIt: 'Took',
  passed: 'Passed',
  chooseOpponent: 'Choose opponent',
  playTo: 'play to',
  barPoint: 'bar',
  offTray: 'off',
  hit: 'hit',
  matchLengthHint: (n) =>
    `First to ${n} points takes the match. A gammon is worth two points, a backgammon three, and the doubling cube multiplies whatever the game is worth.`,
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
  soundOn: 'روشن',
  soundOff: 'خاموش',
  // مارس is what the game is actually called at an Iranian board, not a gloss.
  gammon: 'مارس',
  backgammon: 'مارس ترکی',
  yourTurn: 'نوبت شما',
  theirTurn: 'نوبت حریف',
  cube: 'کوب',
  game: 'بازی',
  noMovesYet: 'هنوز حرکتی نشده.',
  offeredYou: (v) => `دوبل به ${v}.`,
  level: 'برابر',
  youLeadBy: (v) => `شما ${v}+`,
  theyLeadBy: (v) => `حریف ${v}+`,
  tookIt: 'قبول کرد',
  passed: 'پاس داد',
  chooseOpponent: 'انتخاب حریف',
  playTo: 'تا',
  barPoint: 'بار',
  offTray: 'خارج',
  hit: 'زد',
  matchLengthHint: (n) =>
    `هر کس زودتر ${n} امتیاز بگیرد مسابقه را می‌برد. مارس دو امتیاز دارد، مارس ترکی سه، و کوب امتیاز بازی را چند برابر می‌کند.`,
}

export const STRINGS: Readonly<Record<Lang, Strings>> = { en, fa }

export function langFromUrl(): Lang {
  const l = new URLSearchParams(location.search).get('lang')
  return l === 'fa' ? 'fa' : 'en'
}
