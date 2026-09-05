import { useEffect, useMemo, useState } from 'react'
import {
  bandFor,
  type Blunder,
  type DecisionAnalysis,
  type MatchAnalysis,
  type SavedMatchV1,
} from '@nard/analysis'
import { digits, STRINGS, type Lang } from '../i18n/strings'
import { opponentById } from '../ladder/opponents'
import { runAnalysis } from './analyse'
import { recordPr } from '../game/archive'
import { Button } from '../chrome/Button'

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
  const s = STRINGS[lang]
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
          {fa ? 'مرور مسابقه' : 'Match review'}
        </h1>
        <Button onClick={onClose}>{fa ? 'بستن' : 'Close'}</Button>
      </header>

      <div className="mx-auto mt-2 w-full max-w-4xl text-xs" style={{ color: 'var(--text-dim)' }}>
        {fa ? 'حریف' : 'Opponent'}: {opponentById(opponentId).name[lang]} ·{' '}
        {fa ? 'عمق ارزیابی' : 'Evaluated at'} {n(plies)} {fa ? 'لایه' : 'ply'}
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
              {fa ? 'در حال تحلیل مسابقه' : 'Analysing the match'}
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
              {fa
                ? 'هر موقعیت دوباره با موتور ارزیابی می‌شود تا خطای هر حرکت مشخص شود.'
                : 'Every position is evaluated again, so the cost of each play can be measured.'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mx-auto mt-16 w-full max-w-md text-center text-sm" style={{ color: 'var(--bad)' }}>
          {fa ? 'تحلیل ممکن نشد' : 'Analysis unavailable'} — {error}
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
          label={fa ? 'شما' : 'You'}
          checker={you.checker}
          cube={you.cube}
          lang={lang}
          highlight
        />
        <PrCard
          label={opponentById(opponentId).name[lang]}
          checker={them.checker}
          cube={them.cube}
          lang={lang}
        />
      </section>

      <section className="mt-6">
        <H>{fa ? 'کیفیت حرکت‌ها' : 'How you played'}</H>
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
                {bandLabel(band, lang)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <H>{fa ? 'شانس' : 'Luck'}</H>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
          {fa
            ? `شما ${n2(analysis.luckSkill.luck.light)} · حریف ${n2(analysis.luckSkill.luck.dark)}`
            : `You ${n2(analysis.luckSkill.luck.light)} · Opponent ${n2(analysis.luckSkill.luck.dark)}`}
          {' — '}
          <span style={{ color: 'var(--warn)' }}>
            {fa ? 'تقریبی' : 'approximate'}
          </span>
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-dim)', opacity: 0.75 }}>
          {fa
            ? 'اعداد شانس هنوز با GNU Backgammon مطابقت کامل ندارند؛ امتیاز مهارت دقیق است.'
            : 'Luck figures do not yet agree exactly with GNU Backgammon. The skill numbers do.'}
        </p>
      </section>

      <section className="mt-6">
        <H>
          {fa ? 'بدترین حرکت‌ها' : 'Worst plays'} ({n(analysis.blunders.length)})
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
            {fa ? 'هیچ اشتباه بزرگی نبود.' : 'No blunders. Well played.'}
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
          PR · {fa ? 'حرکت' : 'checker'}
        </span>
      </div>
      <div className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
        {cube.pr === null
          ? fa
            ? 'بدون تصمیم دوبل'
            : 'no cube decisions'
          : `${digits(Math.round(cube.pr), lang)} PR · ${fa ? 'دوبل' : 'cube'}`}
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
        {mine ? (fa ? 'شما' : 'you') : opponentById(opponentId).name[lang]}
      </span>
      <span className="font-mono text-xs" style={{ color: 'var(--text)' }}>
        {played} → <span style={{ color: 'var(--good)' }}>{best}</span>
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

function bandLabel(b: string, lang: Lang): string {
  const en: Record<string, string> = {
    good: 'good',
    doubtful: 'doubtful',
    error: 'errors',
    blunder: 'blunders',
  }
  const fa: Record<string, string> = {
    good: 'خوب',
    doubtful: 'مشکوک',
    error: 'خطا',
    blunder: 'اشتباه بزرگ',
  }
  return (lang === 'fa' ? fa : en)[b] ?? b
}
