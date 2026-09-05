import { digits, STRINGS, type Lang } from '../i18n/strings'

/**
 * Split a turn's notation into its individual plays.
 *
 * The engine emits standard shorthand — "8/5 6/5", "bar/20* 6/5", "1/off" —
 * which is the right interchange format and the wrong thing to put in front of
 * a person. The slash is doing the work of an arrow and the asterisk the work
 * of the word "hit"; neither is legible to anyone who has not been told.
 */
export function plays(notation: string) {
  return notation
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const hit = token.endsWith('*')
      const body = hit ? token.slice(0, -1) : token
      const [from = '', to = ''] = body.split('/')
      return { from, to, hit }
    })
}

/**
 * A turn, written for a reader.
 *
 * Shared by the turn log and the match review rather than duplicated: they show
 * the same thing and had drifted apart, with the rail reading `13→10` while the
 * review beside it still said `13/10`. Notation is always `dir="ltr"` — it
 * reads from-point then to-point, and in an RTL run the hit marker drifts off
 * the end of the play it belongs to and lands against the next one.
 */
export function Notation({
  text,
  lang,
  tone,
}: {
  text: string
  lang: Lang
  /** `good` marks the engine's preferred play in the review. */
  tone?: 'good'
}) {
  const s = STRINGS[lang]
  const term = (v: string) =>
    v === 'bar' ? s.barPoint : v === 'off' ? s.offTray : digits(Number(v), lang)

  return (
    <span
      dir="ltr"
      className="inline-flex flex-wrap gap-x-2.5 gap-y-1"
      style={tone === 'good' ? { color: 'var(--good)' } : undefined}
    >
      {plays(text).map((m, i) => (
        <span key={i} className="whitespace-nowrap tabular-nums">
          {term(m.from)}
          <span style={{ color: 'var(--text-dim)' }}>→</span>
          {term(m.to)}
          {m.hit && (
            <span className="ms-0.5" style={{ color: 'var(--bad)' }} title={s.hit}>
              ✕
            </span>
          )}
        </span>
      ))}
    </span>
  )
}
