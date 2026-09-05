/**
 * The app's one button.
 *
 * `primary` is solid brass with dark text; everything else is an outline. One
 * loud button per state and the rest quiet — a row of identical outlined
 * buttons makes the player read all of them to find the one they want, which
 * is what the rail and the end-of-game panel each had before, independently.
 *
 * `hint` prints the key that does the same thing. Latin key names stay Latin in
 * the Persian interface: the keys on the keyboard are labelled that way, and
 * transliterating them would name a key that does not exist.
 */
export function Button({
  children,
  onClick,
  primary = false,
  hint,
  grow = false,
  autoFocus = false,
}: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  hint?: string
  /** Fill the row it is in. Used in the rail, where the row is the width. */
  grow?: boolean
  autoFocus?: boolean
}) {
  return (
    <button
      onClick={onClick}
      autoFocus={autoFocus}
      className={`flex items-center justify-center gap-2 rounded-[3px] px-4 py-2.5 text-sm transition-all hover:brightness-110 active:translate-y-px ${
        grow ? 'flex-1' : ''
      }`}
      style={
        primary
          ? { background: 'var(--inlay)', color: 'var(--app-bg)', border: '1px solid var(--inlay)' }
          : { border: '1px solid var(--app-line)', color: 'var(--text)' }
      }
    >
      {children}
      {hint && (
        <kbd
          className="rounded-[2px] px-1 text-[0.6rem] uppercase opacity-55"
          style={{ border: `1px solid ${primary ? 'var(--app-bg)' : 'var(--app-line)'}` }}
        >
          {hint}
        </kbd>
      )}
    </button>
  )
}

/**
 * Settings.
 *
 * Sliders rather than a gear. The ⚙ glyph renders differently on every platform
 * and looked like a smudge at this size; a drawn gear small enough to sit in
 * the header loses its teeth and comes out as a sun. Two rows with a knob on
 * each reads correctly at 17px and is unambiguous.
 */
export function SettingsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8h13M3 16h6M21 8h-2M21 16h-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="17.5" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="11.5" cy="16" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}
