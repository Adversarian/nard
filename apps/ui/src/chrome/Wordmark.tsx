/**
 * The app's name, as one fixed lockup.
 *
 * Persian first, always, in both interface languages. The game is نرد; the
 * Latin spelling is a transliteration of it, not a separate name, and a
 * wordmark that reorders itself when the player changes language is not a
 * wordmark. `dir="ltr"` pins the order so the RTL interface does not flip it.
 *
 * This replaces a header that held nothing but the word "nard" in dim grey
 * letterspaced caps — which is what "the UI feels empty" looks like at the top
 * of the window.
 *
 * The two words are hard-coded rather than pulled from the bundles, and that is
 * the one deliberate exception to "all copy lives in en.json / fa.json". This
 * is a LOGO: both halves show in both languages, neither is translated, and it
 * is laid out as a fixed lockup. Putting it in the bundles would invite someone
 * to translate half of it.
 */
export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const big = size === 'lg'
  return (
    <span dir="ltr" className="inline-flex items-center gap-2.5 select-none">
      <span
        className={big ? 'text-3xl' : 'text-lg'}
        style={{ color: 'var(--inlay)', lineHeight: 1 }}
      >
        نرد
      </span>
      <span
        className="w-px self-stretch"
        style={{ background: 'var(--app-line)' }}
        aria-hidden
      />
      <span
        className={`uppercase ${big ? 'text-xs tracking-[0.45em]' : 'text-label tracking-[0.38em]'}`}
        style={{ color: 'var(--text-dim)', lineHeight: 1 }}
      >
        nard
      </span>
    </span>
  )
}
