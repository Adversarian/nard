import { motion } from 'motion/react'
import type { GameResult, GameState } from '@nard/engine'
import { digits, STRINGS, type Lang } from '../i18n/strings'
import { opponentById } from '../ladder/opponents'

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
        className="flex min-w-80 flex-col items-center rounded-sm px-10 py-8 text-center"
        style={{ background: 'var(--app-panel)', border: '1px solid var(--inlay)' }}
      >
        <div
          className="text-xs uppercase tracking-[0.25em]"
          style={{ color: 'var(--text-dim)' }}
        >
          {matchOver ? s.matchOver : fa ? 'پایان بازی' : 'Game over'}
        </div>

        <div className="mt-3 text-2xl" style={{ color: 'var(--text)' }}>
          {won ? s.youWin : s.theyWin}
        </div>

        <div className="mt-1 text-sm" style={{ color: 'var(--inlay)' }}>
          {describe(result, lang)}
        </div>

        {state.match.length > 0 && (
          <div className="mt-5 font-mono text-lg" style={{ color: 'var(--text)' }}>
            {digits(state.match.score.light, lang)} – {digits(state.match.score.dark, lang)}
          </div>
        )}
        <div className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
          {fa ? 'شما' : 'You'} · {opponent.name[lang]}
        </div>

        <div className="mt-7 flex gap-3">
          {onReview && (
            <button
              onClick={onReview}
              autoFocus
              className="rounded-sm px-4 py-2 text-sm"
              style={{ border: '1px solid var(--inlay)', color: 'var(--text)' }}
            >
              {fa ? 'مرور' : 'Review'}
            </button>
          )}
          {!matchOver && (
            <button
              onClick={onNext}
              className="rounded-sm px-4 py-2 text-sm"
              style={{ border: '1px solid var(--inlay)', color: 'var(--text)' }}
            >
              {s.nextGame}
            </button>
          )}
          <button
            onClick={onLadder}
            className="rounded-sm px-4 py-2 text-sm"
            style={{
              border: `1px solid ${matchOver ? 'var(--inlay)' : 'var(--frame)'}`,
              color: matchOver ? 'var(--text)' : 'var(--text-dim)',
            }}
          >
            {fa ? 'حریف دیگر' : 'Another opponent'}
          </button>
        </div>
      </motion.div>
    </motion.div>
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
