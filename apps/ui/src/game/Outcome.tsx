import { motion } from 'motion/react'
import type { GameResult, GameState } from '@nard/engine'
import { digits, STRINGS, type Lang } from '../i18n/strings'
import { opponentById } from '../ladder/opponents'
import { Button } from '../chrome/Button'

const portraits = import.meta.glob<string>('../assets/portraits/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})
const portraitFor = (id: string) =>
  Object.entries(portraits).find(([p]) => p.includes(`/${id}.`))?.[1]

/**
 * The end of a game, and the end of a match.
 *
 * A restrained moment, not a celebration. No confetti, no fanfare, no "Great
 * game!" — see AGENTS.md §10. What a strong player wants here is the score, how
 * it was won, and a fast way to start the next one. Everything else is in his
 * way.
 *
 * The match result gets more weight than a game result, because it is the thing
 * that was actually being played for.
 */
export function Outcome({
  state,
  lang,
  opponentId,
  onNext,
  onLadder,
  onReview,
}: {
  state: GameState
  lang: Lang
  opponentId: string
  onNext: () => void
  onLadder: () => void
  /** Only present once the match is over and its record is archived. */
  onReview?: () => void
}) {
  const s = STRINGS[lang]
  const fa = lang === 'fa'
  const result = state.result
  if (!result) return null

  const matchOver = state.phase === 'match-over'
  const won = result.winner === 'light'
  const opponent = opponentById(opponentId)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="absolute inset-0 z-10 flex items-center justify-center"
      style={{ background: 'color-mix(in srgb, var(--app-bg) 78%, transparent)' }}
    >
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.05 }}
        dir={fa ? 'rtl' : 'ltr'}
        className="flex w-[24rem] flex-col items-center rounded-[3px] px-8 py-7 text-center"
        style={{ background: 'var(--app-panel)', border: '1px solid var(--inlay)' }}
      >
        <div className="text-[0.65rem] uppercase tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
          {matchOver ? s.matchOver : fa ? 'پایان بازی' : 'Game over'}
        </div>

        {/* Who it was against. The result of a match is not a number on its
            own — it is a number against a person, and the ladder is built out
            of people for exactly that reason. */}
        <img
          src={portraitFor(opponent.id)}
          alt=""
          width={72}
          height={90}
          className="mt-4 rounded-[2px] object-cover"
          style={{ border: '1px solid var(--inlay)', opacity: won ? 0.7 : 1 }}
        />

        <div className="mt-4 text-2xl" style={{ color: won ? 'var(--inlay)' : 'var(--text)' }}>
          {won ? s.youWin : s.theyWin}
        </div>

        <div className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
          {describe(result, lang)}
        </div>

        {state.match.length > 0 && (
          <div className="mt-6 grid w-full grid-cols-2 gap-6">
            <Side
              label={fa ? 'شما' : 'You'}
              value={digits(state.match.score.light, lang)}
              lead={state.match.score.light > state.match.score.dark}
            />
            <Side
              label={opponent.name[lang]}
              value={digits(state.match.score.dark, lang)}
              lead={state.match.score.dark > state.match.score.light}
            />
          </div>
        )}

        <div className="mt-8 flex w-full gap-2.5">
          {onReview && (
            <Button primary grow autoFocus onClick={onReview}>
              {fa ? 'مرور' : 'Review'}
            </Button>
          )}
          {!matchOver && (
            <Button primary={!onReview} grow onClick={onNext}>
              {s.nextGame}
            </Button>
          )}
          <Button grow onClick={onLadder}>
            {fa ? 'حریف دیگر' : 'Another opponent'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/** One side of the match score. The leader's number is the bright one. */
function Side({ label, value, lead }: { label: string; value: string; lead: boolean }) {
  return (
    <div>
      <div
        className="text-3xl leading-none font-semibold tabular-nums"
        style={{ color: lead ? 'var(--inlay)' : 'var(--text)' }}
      >
        {value}
      </div>
      <div
        className="mt-1.5 truncate text-[0.65rem] uppercase tracking-[0.14em]"
        style={{ color: 'var(--text-dim)' }}
      >
        {label}
      </div>
    </div>
  )
}

/** "3 points, backgammon" — how it was won, which is what he will want to know. */
function describe(result: GameResult, lang: Lang): string {
  const s = STRINGS[lang]
  const pts = digits(result.points, lang)
  const unit = lang === 'fa' ? 'امتیاز' : result.points === 1 ? 'point' : 'points'
  const kind =
    result.kind === 'gammon' ? s.gammon : result.kind === 'backgammon' ? s.backgammon : ''
  return kind ? `${pts} ${unit} · ${kind}` : `${pts} ${unit}`
}
