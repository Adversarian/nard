import { useState } from 'react'
import { OPPONENTS, isBeaten, type Opponent, type Progress } from './opponents'
import { digits, STRINGS, type Lang } from '../i18n/strings'

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
 * tells you what you are in for, and that is more use than "level 4".
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
  const s = STRINGS[lang]
  const [length, setLength] = useState(7)
  const fa = lang === 'fa'

  return (
    <div
      dir={fa ? 'rtl' : 'ltr'}
      className="flex min-h-full flex-col items-center justify-center px-6 py-10"
      style={{ background: 'var(--app-bg)' }}
    >
      <h1
        className={fa ? 'text-2xl' : 'text-sm tracking-[0.4em] uppercase'}
        style={{ color: 'var(--text-dim)' }}
      >
        {s.appName}
      </h1>

      <div className="mt-10 grid w-full max-w-5xl grid-cols-2 gap-5 sm:grid-cols-3">
        {OPPONENTS.map((o) => {
          const beaten = isBeaten(o.id, progress)
          const rec = progress.record[o.id]
          return (
            <button
              key={o.id}
              onClick={() => onStart(o, length)}
              className="group flex flex-col items-center rounded-sm p-4 text-center transition-transform hover:-translate-y-0.5"
              style={{
                border: `1px solid ${beaten ? 'var(--inlay)' : 'var(--frame)'}`,
                background: 'var(--app-panel)',
              }}
            >
              <div className="relative">
                <img
                  src={portraitFor(o.id)}
                  alt=""
                  width={128}
                  height={128}
                  className="rounded-full"
                  style={{ border: '1px solid var(--inlay)' }}
                />
                {beaten && (
                  <span
                    className="absolute -bottom-1 flex h-6 w-6 items-center justify-center rounded-full text-xs"
                    style={{
                      [fa ? 'left' : 'right']: '-0.25rem',
                      background: 'var(--inlay)',
                      color: 'var(--app-bg)',
                    }}
                    title={fa ? 'برده‌ای' : 'Beaten'}
                  >
                    ✓
                  </span>
                )}
              </div>
              <div className="mt-3 text-base" style={{ color: 'var(--text)' }}>
                {o.name[lang]}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--inlay)' }}>
                {o.style[lang]}
              </div>
              <p
                className="mt-2 text-xs leading-relaxed"
                style={{ color: 'var(--text-dim)', minHeight: '3.2em' }}
              >
                {o.blurb[lang]}
              </p>
              <div className="mt-1 font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                {rec ? `${digits(rec.won, lang)}–${digits(rec.lost, lang)}` : '\u00A0'}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-10 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          {fa ? 'طول مسابقه' : 'Match length'}
        </span>
        {MATCH_LENGTHS.map((n) => (
          <button
            key={n}
            onClick={() => setLength(n)}
            className="rounded-sm px-3 py-1 text-sm transition-colors"
            style={{
              border: `1px solid ${length === n ? 'var(--inlay)' : 'var(--frame)'}`,
              color: length === n ? 'var(--text)' : 'var(--text-dim)',
            }}
          >
            {digits(n, lang)}
          </button>
        ))}
      </div>
    </div>
  )
}
