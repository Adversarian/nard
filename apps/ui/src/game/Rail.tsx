import type { GameState } from '@nard/engine'
import type { LogEntry } from './store'
import type { Affordances } from './store'
import type { Opponent } from '../ladder/opponents'
import { digits, notation, STRINGS, type Lang } from '../i18n/strings'
import { Button } from '../chrome/Button'

const portraits = import.meta.glob<string>('../assets/portraits/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})
const portraitFor = (id: string) =>
  Object.entries(portraits).find(([p]) => p.includes(`/${id}.`))?.[1]

/**
 * The rail beside the board.
 *
 * It exists because of the shape of the problem, not to have somewhere to put
 * widgets. The board is 1.5:1 and a desktop window is nearer 1.8:1, so fitting
 * the board by height ALWAYS leaves a column of dead screen — and the app had
 * been leaving it empty while cramming the score into eleven grey pixels in a
 * corner. Moving that column's worth of chrome out of the header and footer and
 * into the gap the board cannot use makes the board BIGGER on a wide window,
 * not smaller, because the footer it replaces was costing height, which is the
 * dimension the board is actually constrained by.
 *
 * What goes in it is what a player looks up between turns and nothing else:
 * who they are playing, the match score, the race, what just happened, and the
 * move they can make now. No progress bars, no encouragement, no tips.
 */
export function Rail({
  lang,
  state,
  log,
  gameNo,
  opponent,
  thinking,
  degraded,
  pips,
  aff,
  isHumanTurn,
  canRoll,
  canDoubleNow,
  facingDouble,
  onRoll,
  onUndo,
  onDouble,
  onTake,
  onPass,
}: {
  lang: Lang
  state: GameState
  log: readonly LogEntry[]
  gameNo: number
  opponent: Opponent
  thinking: boolean
  degraded: boolean
  pips: { player: number; opponent: number }
  aff: Affordances
  isHumanTurn: boolean
  canRoll: boolean
  canDoubleNow: boolean
  facingDouble: boolean
  onRoll: () => void
  onUndo: () => void
  onDouble: () => void
  onTake: () => void
  onPass: () => void
}) {
  const s = STRINGS[lang]
  const n = (v: number) => digits(v, lang)
  const theirTurn = !isHumanTurn && state.phase !== 'game-over' && state.phase !== 'match-over'

  return (
    <aside
      className="flex w-[19rem] shrink-0 flex-col gap-4 py-4 text-sm"
      style={{ color: 'var(--text)' }}
    >
      {/* ---- who you are playing ------------------------------------- */}
      <Panel active={theirTurn}>
        <div className="flex items-center gap-3">
          <img
            src={portraitFor(opponent.id)}
            alt=""
            width={56}
            height={70}
            className="shrink-0 rounded-[2px] object-cover transition-opacity"
            style={{
              border: '1px solid var(--inlay)',
              opacity: theirTurn ? 1 : 0.68,
            }}
          />
          <div className="min-w-0">
            <div className="truncate text-base leading-tight">{opponent.name[lang]}</div>
            <div className="truncate text-xs leading-tight" style={{ color: 'var(--inlay)' }}>
              {opponent.style[lang]}
            </div>
            <div
              className="mt-1.5 truncate text-xs leading-tight"
              style={{ color: 'var(--text-dim)' }}
            >
              {thinking ? (
                <span className="animate-pulse">{s.thinking}</span>
              ) : theirTurn ? (
                s.theirTurn
              ) : (
                s.yourTurn
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* ---- the match ----------------------------------------------- */}
      <Panel>
        <div className="grid grid-cols-3 items-end">
          <Score label={s.you} value={n(state.match.score.light)} lead={state.match.score.light > state.match.score.dark} />
          <div className="pb-1 text-center text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: 'var(--text-dim)' }}>
            {state.match.length > 0 ? n(state.match.length) : '∞'}
          </div>
          <Score label={opponent.name[lang]} value={n(state.match.score.dark)} lead={state.match.score.dark > state.match.score.light} />
        </div>
        {(state.match.crawford || state.cube.value > 1 || degraded) && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {state.match.crawford && <Tag>{s.crawford}</Tag>}
            {state.cube.value > 1 && (
              <Tag>
                {s.cube} {n(state.cube.value)}
              </Tag>
            )}
            {degraded && <Tag warn title={s.reducedEngineHint}>{s.reducedEngine}</Tag>}
          </div>
        )}
      </Panel>

      {/* ---- the race ------------------------------------------------ */}
      <Panel>
        <Race lang={lang} you={pips.player} them={pips.opponent} theirName={opponent.name[lang]} />
      </Panel>

      {/* ---- what just happened -------------------------------------- */}
      {/*
        The log has no panel round it, and IS the flexible element.
        A bordered box reads as much emptier than plain space when it is
        half full — the border promises content that is not there — and a game
        is young for a good while. Without one, a short log is just a few lines
        with room under them.
      */}
      <section className="flex min-h-0 flex-1 flex-col px-3.5">
        <Head>
          {s.game} {n(gameNo)}
        </Head>
        <ol className="mt-2 flex min-h-0 flex-col gap-1 overflow-hidden">
          {log.length === 0 && (
            <li className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {s.noMovesYet}
            </li>
          )}
          {log.slice(0, 14).map((e, i) => (
            <Line key={e.id} entry={e} lang={lang} faded={i > 8} />
          ))}
        </ol>
      </section>

      {/* ---- what you can do ----------------------------------------- */}
      {/*
        A floor, so the rail does not resize as buttons come and go — the board
        beside it twitched on every change of turn without one. It is one row
        tall, not two: reserving room for the tallest possible state left a
        visible hole under the log for most of the game, which is the emptiness
        this rail exists to remove.
      */}
      <div className="flex min-h-[3rem] shrink-0 flex-col justify-end gap-2">
        {facingDouble ? (
          <>
            <div className="text-center text-xs" style={{ color: 'var(--text-dim)' }}>
              {s.offeredYou(n(state.cube.value * 2))}
            </div>
            <div className="flex gap-2">
              <Button primary grow onClick={onTake}>
                {s.take(state.cube.value * 2)}
              </Button>
              <Button grow onClick={onPass}>{s.pass}</Button>
            </div>
          </>
        ) : (
          <>
            {state.phase === 'to-move' && isHumanTurn && !aff.anyPlay && !aff.canUndo && (
              <div className="text-center text-xs" style={{ color: 'var(--text-dim)' }}>
                {s.noPlay}
              </div>
            )}
            <div className="flex gap-2">
              {canRoll && (
                <Button primary grow onClick={onRoll} hint="space">
                  {s.roll}
                </Button>
              )}
              {canDoubleNow && (
                <Button grow onClick={onDouble} hint="d">
                  {s.double}
                </Button>
              )}
              {aff.canUndo && (
                <Button grow onClick={onUndo} hint="u">
                  {s.undo}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

/* -------------------------------------------------------------------------- */

function Panel({
  children,
  active = false,
  className = '',
}: {
  children: React.ReactNode
  active?: boolean
  className?: string
}) {
  return (
    <section
      className={`rounded-[3px] px-3.5 py-3 transition-colors ${className}`}
      style={{
        background: 'var(--app-panel)',
        border: `1px solid ${active ? 'var(--inlay)' : 'var(--app-line)'}`,
      }}
    >
      {children}
    </section>
  )
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[0.65rem] uppercase tracking-[0.18em]"
      style={{ color: 'var(--text-dim)' }}
    >
      {children}
    </div>
  )
}

function Tag({
  children,
  warn = false,
  title,
}: {
  children: React.ReactNode
  warn?: boolean
  title?: string
}) {
  return (
    <span
      {...(title ? { title } : {})}
      className="rounded-[2px] px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider"
      style={{
        border: `1px solid ${warn ? 'var(--warn)' : 'var(--app-line)'}`,
        color: warn ? 'var(--warn)' : 'var(--text-dim)',
      }}
    >
      {children}
    </span>
  )
}

/** One side of the match score. The leader's number is the bright one. */
function Score({ label, value, lead }: { label: string; value: string; lead: boolean }) {
  return (
    <div className="text-center">
      <div
        className="text-[2rem] leading-none font-semibold tabular-nums"
        style={{ color: lead ? 'var(--inlay)' : 'var(--text)' }}
      >
        {value}
      </div>
      <div
        className="mt-1 truncate text-[0.65rem] uppercase tracking-[0.14em]"
        style={{ color: 'var(--text-dim)' }}
      >
        {label}
      </div>
    </div>
  )
}

/**
 * The pip race.
 *
 * Shown as a lead rather than two raw counts, because "who is ahead and by how
 * much" is the question — a player who wants the absolute numbers has them
 * right there, but nobody subtracts them in their head every turn.
 */
function Race({
  lang,
  you,
  them,
  theirName,
}: {
  lang: Lang
  you: number
  them: number
  theirName: string
}) {
  const s = STRINGS[lang]
  const n = (v: number) => digits(v, lang)
  const lead = them - you // positive: you are ahead
  const ahead = lead > 0
  // Clamped, so a blowout does not peg the bar and stop showing change.
  const share = 0.5 + Math.max(-0.42, Math.min(0.42, lead / 120))

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="tabular-nums" style={{ color: ahead ? 'var(--inlay)' : 'var(--text)' }}>
          {n(you)}
        </span>
        <span className="text-[0.65rem] uppercase tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>
          {lead === 0 ? s.level : ahead ? s.youLeadBy(n(lead)) : s.theyLeadBy(n(-lead))}
        </span>
        <span className="tabular-nums" style={{ color: ahead ? 'var(--text)' : 'var(--inlay)' }}>
          {n(them)}
        </span>
      </div>
      <div
        className="relative mt-2 h-[3px] overflow-hidden rounded-full"
        style={{ background: 'var(--app-line)' }}
      >
        <div
          className="absolute inset-y-0 transition-[left,right] duration-500"
          style={{
            left: ahead ? `${(1 - share) * 100}%` : '50%',
            right: ahead ? '50%' : `${share * 100}%`,
            background: 'var(--inlay)',
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[0.65rem]" style={{ color: 'var(--text-dim)' }}>
        <span>{s.you}</span>
        <span className="truncate ps-2">{theirName}</span>
      </div>
    </div>
  )
}

/** One line of the turn log. */
function Line({ entry, lang, faded }: { entry: LogEntry; lang: Lang; faded: boolean }) {
  const s = STRINGS[lang]
  const n = (v: number) => digits(v, lang)
  const light = entry.side === 'light'
  const text =
    entry.kind === 'move'
      ? notation(entry.text, lang)
      : entry.kind === 'no-play'
        ? s.noPlay
        : entry.kind === 'double'
          ? `${s.double} → ${n(Number(entry.text))}`
          : entry.kind === 'take'
            ? s.tookIt
            : s.passed

  return (
    <li
      className="flex items-center gap-2 text-xs transition-opacity"
      style={{ opacity: faded ? 0.4 : 1 }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: light ? 'var(--checker-light)' : 'var(--checker-dark)',
          border: `1px solid ${light ? 'var(--checker-light-lo)' : 'var(--checker-dark-rim)'}`,
        }}
      />
      <span
        className="w-6 shrink-0 tabular-nums"
        style={{ color: 'var(--text-dim)' }}
      >
        {entry.dice ? `${n(entry.dice[0])}${n(entry.dice[1])}` : ''}
      </span>
      <span
        // Notation reads from-point then to-point, so it is LTR even here. In
        // an RTL run the hit marker drifts off the end of the play it belongs
        // to and lands against the next one.
        {...(entry.kind === 'move' ? { dir: 'ltr' as const } : {})}
        className="truncate"
        style={{ color: entry.kind === 'move' ? 'var(--text)' : 'var(--text-dim)' }}
      >
        {text}
      </span>
    </li>
  )
}
