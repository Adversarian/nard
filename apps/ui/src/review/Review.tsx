import { useEffect, useMemo, useState } from 'react'
import {
  bandFor,
  type Blunder,
  type DecisionAnalysis,
  type MatchAnalysis,
  type SavedMatchV1,
} from '@nard/analysis'
import { digits, T, type Lang, type Translate } from '../i18n'
import { opponentKey } from '../ladder/opponents'
import { runAnalysis } from './analyse'
import { recordPr } from '../game/archive'
import { Button } from '../chrome/Button'
import { Notation } from '../chrome/Notation'

/**
 * Match review.
 *
 * The point of this screen is a number that goes down over months, and a list
 * of the plays that cost the most. Everything else is supporting detail.
 *
 * Two honesty rules from docs/analysis-spec.md are enforced here rather than
 * left to good intentions: the evaluation depth is always stated, and luck is
 * labelled approximate because our figures do not yet agree with GNU
 * Backgammon's.
 */
export function Review({
  saved,
  matchId,
  lang,
  opponentId,
  onClose,
}: {
  saved: SavedMatchV1
  matchId: string
  lang: Lang
  opponentId: string
  onClose: () => void
}) {
  const t = T(lang)
  const fa = lang === 'fa'
  const n = (v: number) => digits(v, lang)
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 1 })
  const [error, setError] = useState<string | null>(null)
  const [plies] = useState<0 | 1 | 2>(1)

  useEffect(() => {
    let cancelled = false
    setAnalysis(null)
    setError(null)
    runAnalysis(saved, {
      plies,
      onProgress: (done, total) => {
        if (!cancelled) setProgress({ done, total })
      },
    })
      .then((a) => {
        if (cancelled) return
        setAnalysis(a)
        // Remember the figure so the history chart never has to re-analyse.
        const pr = a.performance.light.checker.pr
        if (pr !== null) {
          recordPr({
            id: matchId,
            at: saved.meta.startedAt,
            checkerPr: pr,
            cubePr: a.performance.light.cube.pr,
            opponentId,
          })
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [saved, plies, matchId, opponentId])

  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100)

  return (
    <div
      dir={fa ? 'rtl' : 'ltr'}
      className="room flex min-h-full flex-col px-6 py-8"
    >
            {/*
        `w-full` is load-bearing. This element is `mx-auto max-w-4xl`, which
        centres a BLOCK at 896px — but the page root is now `flex flex-col` to
        centre the analysing card, and a flex item with auto side margins
        shrinks to its content instead. Without it the Close button sits
        against the title in the middle of the page.
      */}
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <h1 className="text-lg" style={{ color: 'var(--text)' }}>
          {t('review.title')}
        </h1>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </header>

      <div className="mx-auto mt-2 w-full max-w-4xl text-xs" style={{ color: 'var(--text-dim)' }}>
        {t('common.opponent')}: {t(opponentKey(opponentId, 'name'))} ·{' '}
        {t('review.evaluatedAt', { n: plies })}
      </div>

      {!analysis && !error && (
        /*
         * Analysis replays every position in the match through the engine, and
         * on a long match that is a genuine wait. What was here was a hairline
         * bar in the middle of an otherwise empty black page, which reads as a
         * screen that has failed rather than one that is working — so this says
         * what is being done, how far along it is, and how many positions are
         * left, and it does it in a card the size of the thing it is replacing.
         */
        <div className="flex flex-1 items-center justify-center">
          <div
            className="flex w-[22rem] flex-col items-center rounded-[3px] px-8 py-8 text-center"
            style={{ background: 'var(--app-panel)', border: '1px solid var(--app-line)' }}
          >
            <div className="text-sm" style={{ color: 'var(--text)' }}>
              {t('review.analysing')}
            </div>
            <div
              className="mt-5 h-1 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--app-line)' }}
            >
              <div
                className="h-full transition-[width] duration-200"
                style={{ width: `${pct}%`, background: 'var(--inlay)' }}
              />
            </div>
            <div className="mt-3 text-xs tabular-nums" style={{ color: 'var(--text-dim)' }}>
              {n(progress.done)} / {n(progress.total)} · {n(pct)}%
            </div>
            <p className="mt-5 text-xs leading-relaxed" style={{ color: 'var(--text-dim)', opacity: 0.8 }}>
              {t('review.analysingHint')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mx-auto mt-16 w-full max-w-md text-center text-sm" style={{ color: 'var(--bad)' }}>
          {t('review.unavailable')} — {error}
        </p>
      )}

      {analysis && <Body analysis={analysis} lang={lang} opponentId={opponentId} />}
    </div>
  )
}

function Body({
  analysis,
  lang,
  opponentId,
}: {
  analysis: MatchAnalysis
  lang: Lang
  opponentId: string
}) {
  const t = T(lang)
  const fa = lang === 'fa'
  const n = (v: number) => digits(v, lang)
  const you = analysis.performance.light
  const them = analysis.performance.dark
  const bands = useMemo(() => countBands(analysis), [analysis])
  // Blunders carry position ids; the notation lives on the decision they came
  // from, so join the two rather than duplicating it.
  const byIndex = useMemo(
    () => new Map(analysis.decisions.map((d) => [d.decisionIndex, d])),
    [analysis],
  )

  return (
    <div className="mx-auto mt-8 w-full max-w-4xl">
      <section className="grid grid-cols-2 gap-4">
        <PrCard
          label={t('common.you')}
          checker={you.checker}
          cube={you.cube}
          lang={lang}
          highlight
        />
        <PrCard
          label={t(opponentKey(opponentId, 'name'))}
          checker={them.checker}
          cube={them.cube}
          lang={lang}
        />
      </section>

      <section className="mt-6">
        <H>{t('review.howYouPlayed')}</H>
        <div className="mt-2 flex gap-1.5">
          {(['good', 'doubtful', 'error', 'blunder'] as const).map((band) => (
            <div
              key={band}
              className="flex-1 rounded-sm px-3 py-2 text-center"
              style={{ background: 'var(--app-panel)', border: '1px solid var(--app-line)' }}
            >
              <div className="text-lg" style={{ color: bandColour(band) }}>
                {n(bands[band])}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {bandLabel(band, t)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <H>{t('review.luck')}</H>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
          {t('review.luckLine', {
            you: n2(analysis.luckSkill.luck.light),
            them: n2(analysis.luckSkill.luck.dark),
          })}
          {' — '}
          <span style={{ color: 'var(--warn)' }}>
            {t('review.approximate')}
          </span>
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-dim)', opacity: 0.75 }}>
          {t('review.luckCaveat')}
        </p>
      </section>

      <section className="mt-6">
        <H>
          {t('review.worstPlays')} ({n(analysis.blunders.length)})
        </H>
        <ol className="mt-2 space-y-1.5">
          {analysis.blunders.slice(0, 12).map((b, i) => (
            <BlunderRow
              key={i}
              blunder={b}
              decision={byIndex.get(b.decisionIndex)}
              lang={lang}
              opponentId={opponentId}
            />
          ))}
        </ol>
        {analysis.blunders.length === 0 && (
          <p className="mt-2 text-sm" style={{ color: 'var(--text-dim)' }}>
            {t('review.noBlunders')}
          </p>
        )}
      </section>
    </div>
  )
}

const n2 = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2)

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
      {children}
    </h2>
  )
}

function PrCard({
  label,
  checker,
  cube,
  lang,
  highlight = false,
}: {
  label: string
  checker: { decisions: number; equityLost: number; pr: number | null }
  cube: { decisions: number; equityLost: number; pr: number | null }
  lang: Lang
  highlight?: boolean
}) {
  const t = T(lang)
  const fa = lang === 'fa'
  return (
    <div
      className="rounded-sm px-5 py-4"
      style={{
        background: 'var(--app-panel)',
        border: `1px solid ${highlight ? 'var(--inlay)' : 'var(--app-line)'}`,
      }}
    >
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl" style={{ color: 'var(--text)' }}>
          {checker.pr === null ? '—' : digits(Math.round(checker.pr), lang)}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          PR · {t('review.checker')}
        </span>
      </div>
      <div className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
        {cube.pr === null
          ? t('review.noCubeDecisions')
          : `${digits(Math.round(cube.pr), lang)} PR · ${t('review.cube')}`}
      </div>
    </div>
  )
}

function BlunderRow({
  blunder,
  decision,
  lang,
  opponentId,
}: {
  blunder: Blunder
  decision: DecisionAnalysis | undefined
  lang: Lang
  opponentId: string
}) {
  const t = T(lang)
  const fa = lang === 'fa'
  const mine = blunder.player === 'light'
  const played =
    decision?.kind === 'checker' ? decision.played.notation : (decision?.played ?? '')
  const best =
    decision?.kind === 'checker' ? decision.best.notation : (decision?.best ?? '')
  return (
    <li
      className="flex items-baseline gap-3 rounded-sm px-3 py-2 text-sm"
      style={{
        background: 'var(--app-panel)',
        border: '1px solid var(--app-line)',
        opacity: mine ? 1 : 0.55,
      }}
    >
      <span className="font-mono" style={{ color: 'var(--bad)', minWidth: '4.5em' }}>
        {blunder.error.toFixed(3)}
      </span>
      <span style={{ color: 'var(--text-dim)', minWidth: '5em' }}>
        {mine ? t('review.youLower') : t(opponentKey(opponentId, 'name'))}
      </span>
      <span className="flex flex-wrap items-baseline gap-2" style={{ color: 'var(--text)' }}>
        <Notation text={played} lang={lang} />
        {/* A word, not another arrow. The plays themselves are full of arrows
            now, and "X → Y" between two of them reads as one long move rather
            than as a comparison between what was played and what was best. */}
        <span className="text-label uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          {t('common.best')}
        </span>
        <Notation text={best} lang={lang} tone="good" />
      </span>
      <span className="ms-auto text-xs" style={{ color: 'var(--text-dim)' }}>
        {blunder.theme} · {blunder.direction}
      </span>
    </li>
  )
}

function countBands(a: MatchAnalysis): Record<'good' | 'doubtful' | 'error' | 'blunder', number> {
  const out = { good: 0, doubtful: 0, error: 0, blunder: 0 }
  for (const d of a.decisions) {
    if (d.player !== 'light') continue
    out[bandFor(d.error)] += 1
  }
  return out
}

const bandColour = (b: string) =>
  b === 'good' ? 'var(--good)' : b === 'blunder' ? 'var(--bad)' : 'var(--warn)'

/** The four quality bands, named. Their copy lives in the bundles like the rest. */
function bandLabel(b: string, t: Translate): string {
  return t(
    b === 'good'
      ? 'band.good'
      : b === 'doubtful'
        ? 'band.doubtful'
        : b === 'error'
          ? 'band.error'
          : 'band.blunder',
  )
}
