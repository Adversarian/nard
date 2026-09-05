import { motion } from 'motion/react'
import type { GameResult, GameState } from '@nard/engine'
import { digits, T, type Lang, type Translate } from '../i18n'
import { opponentById, opponentKey } from '../ladder/opponents'
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
  const t = T(lang)
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
        className="flex w-[26rem] flex-col items-center rounded-[3px] px-8 py-7 text-center"
        style={{
          background: 'var(--app-panel)',
          border: '1px solid var(--app-line)',
          boxShadow: '0 24px 60px -14px var(--shadow)',
        }}
      >
        <div className="text-label uppercase tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
          {t(matchOver ? 'outcome.matchOver' : 'outcome.gameOver')}
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
          {t(won ? 'outcome.youWin' : 'outcome.theyWin')}
        </div>

        <div className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
          {describe(result, lang, t)}
        </div>

        {state.match.length > 0 && (
          <div className="mt-6 grid w-full grid-cols-2 gap-6">
            <Side
              label={t('common.you')}
              value={digits(state.match.score.light, lang)}
              lead={state.match.score.light > state.match.score.dark}
            />
            <Side
              label={t(opponentKey(opponent.id, 'name'))}
              value={digits(state.match.score.dark, lang)}
              lead={state.match.score.dark > state.match.score.light}
            />
          </div>
        )}

        {/* Stacked, not side by side.
            Three of these can be showing at once and the longest label is two
            words; in a row they wrapped mid-button, which is the sort of thing
            that only shows up once someone actually captures the screen — and
            this one was named in the review pack for weeks without ever being
            photographed. */}
        <div className="mt-8 flex w-full flex-col gap-2.5">
          {onReview && (
            <Button primary grow autoFocus onClick={onReview}>
              {t('outcome.review')}
            </Button>
          )}
          {!matchOver && (
            <Button primary={!onReview} grow onClick={onNext}>
              {t('outcome.nextGame')}
            </Button>
          )}
          <Button grow onClick={onLadder}>
            {t('outcome.another')}
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
        className="mt-1.5 truncate text-label uppercase tracking-[0.14em]"
        style={{ color: 'var(--text-dim)' }}
      >
        {label}
      </div>
    </div>
  )
}

/** "3 points, backgammon" — how it was won, which is what he will want to know. */
function describe(result: GameResult, lang: Lang, t: Translate): string {
  const pts = digits(result.points, lang)
  const unit = t(result.points === 1 ? 'result.point' : 'result.points')
  const kind =
    result.kind === 'gammon'
      ? t('result.gammon')
      : result.kind === 'backgammon'
        ? t('result.backgammon')
        : ''
  return kind ? `${pts} ${unit} · ${kind}` : `${pts} ${unit}`
}
