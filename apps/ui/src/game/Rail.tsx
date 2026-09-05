import type { GameState } from '@nard/engine'
import type { Affordances, LogEntry } from './store'
import { opponentKey, type Opponent } from '../ladder/opponents'
import { digits, T, type Lang } from '../i18n'
import { Button } from '../chrome/Button'
import { Notation } from '../chrome/Notation'

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
 * It exists because of the shape of the problem. The board is 1.5:1 and a
 * desktop window is nearer 1.8:1, so fitting the board by height ALWAYS leaves
 * a column of dead screen — and the app had been leaving it empty while
 * cramming the score into eleven grey pixels in a corner. Moving that column's
 * worth of chrome out of the header and footer and into the gap the board
 * cannot use makes the board BIGGER on a wide window, not smaller, because the
 * footer it replaces was costing height, which is the dimension the board is
 * actually constrained by.
 *
 * SECTIONS, NOT BOXES. Everything here was in bordered panels first, and four
 * stacked outlines read as a form to be filled in rather than as a set of
 * readings to be glanced at. Hairline rules and spacing separate them now: the
 * information is identical and the page is quieter, which is most of what
 * "classy" means in a layout.
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
  const t = T(lang)
  const n = (v: number) => digits(v, lang)
  const theirTurn = !isHumanTurn && state.phase !== 'game-over' && state.phase !== 'match-over'

  return (
    <aside
      className="flex w-[19rem] shrink-0 flex-col text-sm"
      style={{ color: 'var(--text)' }}
    >
      {/* ---- who you are playing ------------------------------------- */}
      <div className="flex items-center gap-3.5 pb-5">
        <img
          src={portraitFor(opponent.id)}
          alt=""
          width={60}
          height={75}
          className="shrink-0 rounded-[2px] object-cover transition-opacity"
          style={{ border: '1px solid var(--inlay)', opacity: theirTurn ? 1 : 0.7 }}
        />
        <div className="min-w-0">
          <div className="truncate text-base leading-tight">{t(opponentKey(opponent.id, 'name'))}</div>
          <div className="truncate text-xs leading-tight" style={{ color: 'var(--inlay)' }}>
            {t(opponentKey(opponent.id, 'style'))}
          </div>
          <div
            className="mt-2 flex items-center gap-1.5 text-label leading-tight"
            style={{ color: 'var(--text-dim)' }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors"
              style={{ background: theirTurn ? 'var(--inlay)' : 'var(--app-line)' }}
            />
            {thinking ? (
              <span className="animate-pulse">{t('play.thinking')}</span>
            ) : (
              t(theirTurn ? 'play.theirTurn' : 'play.yourTurn')
            )}
          </div>
        </div>
      </div>

      <Rule />

      {/* ---- the match ----------------------------------------------- */}
      <div className="py-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <Score label={t('common.you')} value={n(state.match.score.light)} lead={state.match.score.light > state.match.score.dark} />
          <div className="px-3 text-center">
            <div className="text-label uppercase tracking-[0.16em]" style={{ color: 'var(--text-dim)' }}>
              {t('match.playTo')}
            </div>
            <div className="mt-0.5 text-base tabular-nums" style={{ color: 'var(--text-dim)' }}>
              {state.match.length > 0 ? n(state.match.length) : '∞'}
            </div>
          </div>
          <Score label={t(opponentKey(opponent.id, 'name'))} value={n(state.match.score.dark)} lead={state.match.score.dark > state.match.score.light} />
        </div>
        {(state.match.crawford || state.cube.value > 1 || degraded) && (
          <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
            {state.match.crawford && <Tag>{t('match.crawford')}</Tag>}
            {state.cube.value > 1 && (
              <Tag>
                {t('play.cube')} {n(state.cube.value)}
              </Tag>
            )}
            {degraded && (
              <Tag warn title={t('play.reducedEngineHint')}>
                {t('play.reducedEngine')}
              </Tag>
            )}
          </div>
        )}
      </div>

      <Rule />

      {/* ---- the race ------------------------------------------------ */}
      <div className="py-5">
        <Race lang={lang} you={pips.player} them={pips.opponent} theirName={t(opponentKey(opponent.id, 'name'))} />
      </div>

      <Rule />

      {/* ---- what just happened -------------------------------------- */}
      <section className="flex min-h-0 flex-1 flex-col pt-5">
        <Head>
          {t('match.game')} {n(gameNo)}
        </Head>
        {log.length === 0 ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-dim)' }}>
            {t('play.noMovesYet')}
          </p>
        ) : (
          /*
            Faded at the bottom rather than cut.
            The list is as tall as the window leaves it, so on a short window
            the last row it can fit gets sliced through the middle of the type,
            which reads as a rendering fault. The fade has to be TALLER than a
            row — it was one row deep, so the slice happened at the very end of
            the ramp where the text was still almost fully opaque, and the
            clipping was plainly visible.
          */
          <ol
            className="mt-3 flex min-h-0 flex-col gap-2.5 overflow-hidden pb-8"
            style={{
              maskImage: 'linear-gradient(to bottom, #000 calc(100% - 4.5rem), transparent)',
            }}
          >
            {log.slice(0, 26).map((e) => (
              <Line key={e.id} entry={e} lang={lang} />
            ))}
          </ol>
        )}
      </section>

      {/* ---- what you can do ----------------------------------------- */}
      {/* A rule above the actions, so the rail has a bottom edge. Without it
          the space between a short turn log and the buttons reads as a hole in
          the layout rather than as the margin it is. */}
      <div className="shrink-0 pt-4">
        <Rule />
      </div>
      <div className="flex min-h-[3.25rem] shrink-0 flex-col justify-end gap-2 pt-4">
        {facingDouble ? (
          <>
            <div className="text-center text-xs" style={{ color: 'var(--text-dim)' }}>
              {t('play.doubledTo', { n: state.cube.value * 2 })}
            </div>
            <div className="flex gap-2">
              <Button primary grow onClick={onTake}>
                {t('play.take', { n: state.cube.value * 2 })}
              </Button>
              <Button grow onClick={onPass}>
                {t('play.pass')}
              </Button>
            </div>
          </>
        ) : (
          <>
            {state.phase === 'to-move' && isHumanTurn && !aff.anyPlay && !aff.canUndo && (
              <div className="text-center text-xs" style={{ color: 'var(--text-dim)' }}>
                {t('play.noPlay')}
              </div>
            )}
            <div className="flex gap-2">
              {canRoll && (
                <Button primary grow onClick={onRoll} hint="space">
                  {t('play.roll')}
                </Button>
              )}
              {canDoubleNow && (
                <Button grow onClick={onDouble} hint="d">
                  {t('play.double')}
                </Button>
              )}
              {aff.canUndo && (
                <Button grow onClick={onUndo} hint="u">
                  {t('play.undo')}
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

/** A hairline. What used to be four borders is now three of these. */
function Rule() {
  return <hr className="border-0" style={{ borderTop: '1px solid var(--app-line)' }} />
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-label uppercase tracking-[0.2em]"
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
      className="rounded-[2px] px-1.5 py-0.5 text-label uppercase tracking-wider"
      style={{
        border: `1px solid ${warn ? 'var(--warn)' : 'var(--app-line)'}`,
        color: warn ? 'var(--warn)' : 'var(--text-dim)',
      }}
    >
      {children}
    </span>
  )
}

/**
 * One side of the match score.
 *
 * Light weight and wide tracking rather than semibold. A large number set bold
 * shouts; the same number set light reads as engraved, and there is nothing on
 * this rail that needs shouting.
 */
function Score({ label, value, lead }: { label: string; value: string; lead: boolean }) {
  return (
    <div className="text-center">
      <div
        className="text-[2.6rem] leading-none tabular-nums"
        style={{ color: lead ? 'var(--inlay)' : 'var(--text)', fontWeight: 300 }}
      >
        {value}
      </div>
      <div
        className="mt-1.5 truncate text-label uppercase tracking-[0.16em]"
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
  const t = T(lang)
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
        <span
          className="text-label uppercase tracking-[0.16em]"
          style={{ color: 'var(--text-dim)' }}
        >
          {lead === 0
            ? t('race.level')
            : ahead
              ? t('race.youLead', { n: lead })
              : t('race.theyLead', { n: -lead })}
        </span>
        <span className="tabular-nums" style={{ color: ahead ? 'var(--text)' : 'var(--inlay)' }}>
          {n(them)}
        </span>
      </div>
      <div
        className="relative mt-2.5 h-[2px] overflow-hidden rounded-full"
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
      <div
        className="mt-2 flex justify-between text-label uppercase tracking-[0.14em]"
        style={{ color: 'var(--text-dim)' }}
      >
        <span>{t('common.you')}</span>
        <span className="truncate ps-2">{theirName}</span>
      </div>
    </div>
  )
}

/**
 * The dice, small, drawn.
 *
 * Deliberately NOT the board's `Die`: that one reaches into `BoardDefs` for
 * photographed bone, a cast shadow and a drilled-pip gradient, and pulling all
 * of that into fourteen list rows would put seventy image elements on the page
 * to render something fourteen pixels across. At this size a rounded square
 * with dots on it is all that survives anyway.
 *
 * A pair of pips also beats "53" as text, which is the reading a player has to
 * do twice: once to see it is two numbers and not fifty-three, and again to
 * work out which is which.
 */
const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
}

function MiniDice({ dice }: { dice: readonly [number, number] }) {
  const d = 11 // one die, in px
  const gap = 3
  return (
    <svg
      width={d * 2 + gap}
      height={d}
      viewBox={`0 0 ${d * 2 + gap} ${d}`}
      className="mt-[4px] shrink-0"
      aria-hidden
    >
      {dice.map((v, i) => (
        <g key={i} transform={`translate(${i * (d + gap)} 0)`}>
          <rect
            width={d}
            height={d}
            rx={d * 0.22}
            fill="var(--checker-light)"
            opacity="0.85"
          />
          {(PIPS[v] ?? []).map(([dx, dy], k) => (
            <circle
              key={k}
              cx={d / 2 + dx * d * 0.26}
              cy={d / 2 + dy * d * 0.26}
              r={d * 0.1}
              fill="var(--app-bg)"
            />
          ))}
        </g>
      ))}
    </svg>
  )
}

/** One line of the turn log. */
function Line({ entry, lang }: { entry: LogEntry; lang: Lang }) {
  const t = T(lang)
  const light = entry.side === 'light'

  return (
    <li className="flex items-start gap-2.5 text-xs">
      <span
        className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
        style={{
          background: light ? 'var(--checker-light)' : 'var(--checker-dark)',
          border: `1px solid ${light ? 'var(--checker-light-lo)' : 'var(--checker-dark-rim)'}`,
        }}
      />
      {entry.dice ? <MiniDice dice={entry.dice} /> : <span className="w-[25px] shrink-0" />}

      {entry.kind === 'move' ? (
        <Notation text={entry.text} lang={lang} />
      ) : (
        <span style={{ color: 'var(--text-dim)' }}>
          {entry.kind === 'no-play'
            ? t('play.noPlay')
            : entry.kind === 'double'
              ? `${t('play.double')} → ${digits(Number(entry.text), lang)}`
              : t(entry.kind === 'take' ? 'log.took' : 'log.passed')}
        </span>
      )}
    </li>
  )
}
