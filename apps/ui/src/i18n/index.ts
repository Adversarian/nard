import en from './en.json'
import fa from './fa.json'

/**
 * Interface language.
 *
 * ALL COPY LIVES IN en.json AND fa.json. Nothing in a component may contain a
 * user-facing string, in either language. That rule is what makes the Persian
 * reviewable at all: it can be handed to a native speaker as one file, and
 * back-translated as one file, instead of being hunted out of thirty-odd
 * `fa ? '…' : '…'` ternaries scattered through the components — which is how
 * `بازی عقب می‌کند` ("does back game", a word-for-word calque of "plays a
 * backgame" that means nothing) survived unnoticed.
 *
 * Persian is not a translation layer bolted on. It is the language the player
 * actually thinks about this game in, so the terms are the ones used at a real
 * board — تاس for the dice, مارس for a gammon — not literal renderings of the
 * English. Where the two languages need different phrasing rather than the same
 * sentence twice, that is correct and expected.
 *
 * Note what does NOT change with language: the board. See
 * docs/design-language.md — an experienced player has a fixed spatial model of
 * a board, and mirroring it because he switched language would be hostile. Only
 * the surrounding chrome flips.
 */
export type Lang = 'en' | 'fa'

/** Every key, taken from the English bundle — which is the canonical set. */
export type Key = keyof typeof en

const BUNDLES: Record<Lang, Partial<Record<Key, string>>> = { en, fa }

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Render a number in the interface's own digits. */
export function digits(n: number, lang: Lang): string {
  const s = String(n)
  return lang === 'fa' ? s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]!) : s
}

export type Vars = Record<string, string | number>

/**
 * Look up one string.
 *
 * Numbers substituted into `{n}` placeholders are converted to the interface's
 * own digits automatically. Doing that at the call site is a step that gets
 * forgotten, and a Persian sentence with Latin numerals in the middle of it is
 * the sort of thing that looks fine to whoever wrote it and wrong to everyone
 * who reads it.
 *
 * A key missing from Persian falls back to English rather than rendering the
 * key itself: a missing translation should look unfinished, not broken. The
 * test in i18n.test.ts asserts there are none.
 */
export function translate(lang: Lang, key: Key, vars?: Vars): string {
  const template = BUNDLES[lang][key] ?? en[key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name]
    if (value === undefined) return `{${name}}`
    return typeof value === 'number' ? digits(value, lang) : String(value)
  })
}

/** Bind the language once, at the top of a component. */
export function T(lang: Lang) {
  return (key: Key, vars?: Vars) => translate(lang, key, vars)
}

export type Translate = ReturnType<typeof T>

export function langFromUrl(): Lang {
  const l = new URLSearchParams(location.search).get('lang')
  return l === 'fa' ? 'fa' : 'en'
}
