import { useState } from 'react'
import { OPPONENTS, isBeaten, opponentKey, type Opponent, type Progress } from './opponents'
import { digits, T, type Lang } from '../i18n'
import { PrHistory } from '../review/PrHistory'
import { Wordmark } from '../chrome/Wordmark'

const portraits = import.meta.glob<string>('../assets/portraits/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})
const portraitFor = (id: string) =>
  Object.entries(portraits).find(([p]) => p.includes(`/${id}.`))?.[1]

const MATCH_LENGTHS = [1, 3, 5, 7, 11] as const

/**
 * Choosing an opponent, not a difficulty.
 *
 * A slider asks "how much should I be allowed to win". A person with a name and
 * a way of playing asks "who am I playing tonight", which is the question a
 * player actually has. The rung is never shown as a number — the style line
 * tells you what you are in for, and that is more use than "level 4". Reading
 * order carries the ladder: Davoud first, Ostad last.
 *
 * LAYOUT. Two columns of wide cards, portrait beside the text, rather than
 * three columns of tall ones with everything centred. The tall version gave
 * each card a third of its height in dead space — the blurbs are one or two
 * lines and the win/loss row is empty until you have played someone — and
 * centred body text in a card that size reads as a list of captions rather than
 * a line-up of people. Beside the text, the portrait can also be larger in the
 * same footprint, which is the point: these are the faces you are choosing
 * between.
 */
export function Ladder({
  lang,
  progress,
  onStart,
}: {
  lang: Lang
  progress: Progress
  onStart: (opponent: Opponent, matchLength: number) => void
}) {
  const t = T(lang)
  const [length, setLength] = useState(7)
  const fa = lang === 'fa'

  return (
    <div
      dir={fa ? 'rtl' : 'ltr'}
      className="room flex min-h-full flex-col items-center justify-center gap-8 px-6 py-10"
    >
      <h1>
        <Wordmark size="lg" />
      </h1>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
        {OPPONENTS.map((o) => {
          const beaten = isBeaten(o.id, progress)
          const rec = progress.record[o.id]
          return (
            <button
              key={o.id}
              onClick={() => onStart(o, length)}
              className="group flex items-start gap-4 rounded-[3px] p-3.5 text-start transition-all hover:-translate-y-0.5"
              style={{
                border: `1px solid ${beaten ? 'var(--inlay)' : 'var(--app-line)'}`,
                background: 'var(--app-panel)',
              }}
            >
              {/*
                A framed print, not an avatar. These are portrait-format
                engravings; a circular crop threw away a third of the taller
                ones — Ostad lost his coat entirely — and the 4:5 frame they
                were drawn in costs almost nothing to keep.
              */}
              <div className="relative shrink-0">
                <img
                  src={portraitFor(o.id)}
                  alt=""
                  width={104}
                  height={130}
                  className="rounded-[2px] object-cover transition-opacity group-hover:opacity-100"
                  style={{ border: '1px solid var(--inlay)', opacity: 0.92 }}
                />
                {beaten && (
                  <span
                    className="absolute -bottom-2 flex h-5 w-5 items-center justify-center rounded-full text-label"
                    style={{
                      [fa ? 'left' : 'right']: '-0.5rem',
                      background: 'var(--inlay)',
                      color: 'var(--app-bg)',
                    }}
                    title={t('ladder.beaten')}
                  >
                    ✓
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col self-stretch">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg leading-tight" style={{ color: 'var(--text)' }}>
                    {t(opponentKey(o.id, 'name'))}
                  </span>
                  {rec && (
                    <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--text-dim)' }}>
                      {digits(rec.won, lang)}–{digits(rec.lost, lang)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-sm" style={{ color: 'var(--inlay)' }}>
                  {t(opponentKey(o.id, 'style'))}
                </div>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                  {t(opponentKey(o.id, 'blurb'))}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <PrHistory lang={lang} />

      {/*
        One segmented control, not five separate buttons — the choice is one
        value out of a set, and five outlined boxes read as five actions.

        And it SAYS WHAT IT DOES. It was labelled "Match length" over a row of
        bare numbers, which assumes the player already knows that backgammon is
        scored in points, that a match runs until someone reaches a total, and
        that the number is that total. The first person to use this asked what
        it was for, which is the only test that matters.
      */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <span
            className="text-label uppercase tracking-[0.2em]"
            style={{ color: 'var(--text-dim)' }}
          >
            {t('ladder.matchTo')}
          </span>
          <div
            className="flex overflow-hidden rounded-[3px]"
            style={{ border: '1px solid var(--app-line)' }}
          >
            {MATCH_LENGTHS.map((n) => (
              <button
                key={n}
                onClick={() => setLength(n)}
                className="px-4 py-1.5 text-sm tabular-nums transition-colors"
                style={
                  length === n
                    ? { background: 'var(--inlay)', color: 'var(--app-bg)' }
                    : { color: 'var(--text-dim)' }
                }
              >
                {digits(n, lang)}
              </button>
            ))}
          </div>
          <span
            className="text-label uppercase tracking-[0.2em]"
            style={{ color: 'var(--text-dim)' }}
          >
            {t('ladder.points')}
          </span>
        </div>
        <p
          className="max-w-md text-center text-xs leading-relaxed"
          style={{ color: 'var(--text-dim)', opacity: 0.85 }}
        >
          {t('ladder.matchHint', { n: length })}
        </p>
      </div>
    </div>
  )
}
