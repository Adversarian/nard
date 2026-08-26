import { useEffect, useMemo, useState } from 'react'
import { canDouble, legalMoves, pipCount, positionKey } from '@nard/engine'
import { Board, Cube, Die, RolledDie, FIELD_X, FIELD_Y, GEO } from './board'
import { AnimatedCheckers } from './board/AnimatedCheckers'
import { Interaction } from './board/Interaction'
import { entitiesFrom, type CheckerEntity } from './board/entities'
import { installHarness, installPlayHarness } from './dev/harness'
import { SCENES, sceneById, type Scene } from './dev/scenes'
import { availableHops } from './game/draft'
import { useAffordances, useGame } from './game/store'
import { useKeyboard } from './game/useKeyboard'
import type { OpponentConfig } from './game/opponent'
import { Outcome } from './game/Outcome'
import { Review } from './review/Review'
import { findMatch } from './game/archive'
import { Ladder } from './ladder/Ladder'
import { opponentById } from './ladder/opponents'
import { decisionMaker, reconcile, toAbsolute } from './game/view'
import { digits, STRINGS } from './i18n/strings'
import { Settings } from './settings/Settings'
import { useSettings } from './settings/store'
import { SOUNDS } from './sound/manifest'
import { sound } from './sound/player'

export function App() {
  const params = new URLSearchParams(location.search)
  const scene = params.get('scene')
  const theme = useSettings((s) => s.theme)
  const lang = useSettings((s) => s.lang)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr'
  }, [lang])

  if (location.pathname.startsWith('/gallery')) return <Gallery theme={theme} />
  if (scene) return <SceneView scene={sceneById(scene)} />
  return <Game />
}

/* -------------------------------------------------------------------------- */
/*  The game                                                                   */
/* -------------------------------------------------------------------------- */

/** Ladder first — you choose who you are playing before anything else. */
function Game() {
  const view = useGame((s) => s.view)
  const progress = useGame((s) => s.progress)
  const startMatch = useGame((s) => s.startMatch)
  const lang = useSettings((s) => s.lang)

  useDevHarness()
  const lastMatchId = useGame((s) => s.lastMatchId)
  const opponentId = useGame((s) => s.opponentId)
  const toLadder = useGame((s) => s.toLadder)

  if (view === 'review') {
    const saved = lastMatchId ? findMatch(lastMatchId) : null
    if (saved) {
      return (
        <Review
          saved={saved}
          matchId={lastMatchId!}
          lang={lang}
          opponentId={opponentId}
          onClose={toLadder}
        />
      )
    }
  }
  if (view === 'ladder') {
    return <Ladder lang={lang} progress={progress} onStart={startMatch} />
  }
  return <PlayView />
}

function PlayView() {
  const lang = useSettings((st) => st.lang)
  const home = useSettings((st) => st.home)
  const s = STRINGS[lang]
  const n = (v: number) => digits(v, lang)
  const store = useGame()
  const { state, draft, selected, thinking, degraded } = store
  const aff = useAffordances()
  // Not `onRoll === 'light'` — see decisionMaker(): during a cube offer the
  // responder is the player who did NOT double.
  const isHumanTurn = decisionMaker(state) === 'light'

  // Hand over to the opponent whenever it is their move. The driver guards
  // against re-entry, so firing on every relevant state change is safe.
  useEffect(() => {
    if (state.phase === 'game-over' || state.phase === 'match-over') return
    if (decisionMaker(state) === store.opponent.side) {
      void store.runOpponent()
    }
  }, [state.phase, state.onRoll, store])

  // Mid-turn the player sees their draft; otherwise the committed position.
  const abs = useMemo(
    () => toAbsolute(draft.hops.length > 0 ? draft.position : state.position, state.onRoll),
    [draft, state.position, state.onRoll],
  )
  const absKey = positionKey(abs)

  const [entities, setEntities] = useState<CheckerEntity[]>(() =>
    entitiesFrom(abs.pts, abs.off, abs.oppOff),
  )
  useEffect(() => {
    setEntities((prev) => reconcile(prev, abs))
    // absKey is the identity of the board; abs itself is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absKey])

  const counts = useMemo(() => {
    const c: Record<number, number> = {}
    for (let p = 1; p <= 24; p++) c[p] = Math.abs(abs.pts[p] ?? 0)
    return c
  }, [abs])

  const hits = useMemo(
    () => aff.destinations.filter((p) => p > 0 && (abs.pts[p] ?? 0) === -1),
    [aff.destinations, abs],
  )

  const pips = pipCount(abs)
  const rightHalfCx = FIELD_X + 6 * GEO.u + GEO.barW + 3 * GEO.u
  const diceY = FIELD_Y + GEO.innerH * 0.5
  const cubeY =
    state.cube.owner === 'light'
      ? FIELD_Y + GEO.innerH - 0.55
      : state.cube.owner === 'dark'
        ? FIELD_Y + 0.55
        : FIELD_Y + GEO.innerH / 2

  // Doubles are four moves, so show four dice — and dim each as it is used, so
  // a player mid-turn can see what is left without counting checkers.
  const diceFaces = state.dice
    ? state.dice[0] === state.dice[1]
      ? [state.dice[0], state.dice[0], state.dice[0], state.dice[0]]
      : [state.dice[0], state.dice[1]]
    : []

  const canRoll =
    isHumanTurn && (state.phase === 'to-roll' || state.phase === 'opening-roll')
  const canDoubleNow = canRoll && canDouble(state)

  useKeyboard({
    ...(canRoll ? { roll: () => store.roll() } : {}),
    ...(aff.canUndo ? { undo: () => store.undo() } : {}),
    ...(canDoubleNow ? { double: () => store.double() } : {}),
    escape: () => store.toLadder(),
  })
  const facingDouble = state.phase === 'cube-offered' && isHumanTurn

  return (
    <div
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      className="flex h-full flex-col"
      style={{ background: 'var(--app-bg)' }}
    >
      <header className="flex items-center justify-between px-6 py-3 text-sm">
        <button
          onClick={() => store.toLadder()}
          className={`transition-opacity hover:opacity-100 ${
            lang === 'fa' ? 'text-base' : 'tracking-[0.3em] uppercase'
          }`}
          style={{ color: 'var(--text-dim)' }}
          title={lang === 'fa' ? 'انتخاب حریف' : 'Choose opponent'}
        >
          {s.appName}
        </button>
        <span className="text-sm" style={{ color: 'var(--inlay)' }}>
          {opponentById(store.opponentId).name[lang]}
        </span>
        <span className="flex items-center gap-4" style={{ color: 'var(--text-dim)' }}>
          {degraded && <span title={s.reducedEngineHint}>⚠ {s.reducedEngine}</span>}
          <span>
            {state.match.length > 0 ? s.matchTo(state.match.length) : s.moneyGame} ·{' '}
            {n(state.match.score.light)}–{n(state.match.score.dark)}
            {state.match.crawford ? ` · ${s.crawford}` : ''}
          </span>
          <Settings />
        </span>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6">
        {(state.phase === 'game-over' || state.phase === 'match-over') && (
          <Outcome
            state={state}
            lang={lang}
            opponentId={store.opponentId}
            onNext={() => store.nextGame()}
            onLadder={() => store.toLadder()}
            {...(store.lastMatchId ? { onReview: () => store.toReview() } : {})}
          />
        )}
        <Board
          home={home}
          {...(canRoll ? { onFieldClick: () => store.roll() } : {})}
        >
          <AnimatedCheckers entities={entities} />
          {state.dice && (
            <>
              {diceFaces.map((v, i) => (
                <RolledDie
                  key={i}
                  x={rightHalfCx + (i - (diceFaces.length - 1) / 2) * 0.95}
                  y={diceY}
                  value={v}
                  size={0.82}
                  dimmed={i < draft.hops.length}
                />
              ))}
            </>
          )}
          <Cube x={FIELD_X + 6 * GEO.u + GEO.barW / 2} y={cubeY} value={state.cube.value} />
          <Interaction
            movable={aff.movable}
            destinations={aff.destinations}
            selected={selected}
            hits={hits}
            counts={counts}
            onPick={(p) => store.select(aff.movable.includes(p) ? p : null)}
            onDrop={(p) => store.moveTo(p)}
          />
        </Board>
      </main>

      <footer className="flex items-center justify-center gap-8 px-6 py-4 text-sm">
        <Pip label={s.opponent} value={n(pips.opponent)} />
        <div className="flex items-center gap-3">
          {canRoll && <Action onClick={() => store.roll()}>{s.roll}</Action>}
          {thinking && (
            <span className="animate-pulse" style={{ color: 'var(--text-dim)' }}>
              {s.thinking}
            </span>
          )}
          {aff.canUndo && <Action onClick={() => store.undo()}>{s.undo}</Action>}
          {state.phase === 'to-move' && !aff.anyPlay && !aff.canUndo && (
            <span style={{ color: 'var(--text-dim)' }}>{s.noPlay}</span>
          )}
          {facingDouble && (
            <>
              <Action onClick={() => store.take()}>{s.take(state.cube.value * 2)}</Action>
              <Action onClick={() => store.passCube()}>{s.pass}</Action>
            </>
          )}
          {canDoubleNow && <Action onClick={() => store.double()}>{s.double}</Action>}

        </div>
        <Pip label={s.you} value={n(pips.player)} />
      </footer>
    </div>
  )
}

function Action({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-sm px-3 py-1.5 text-sm transition-colors"
      style={{ border: '1px solid var(--inlay)', color: 'var(--text)' }}
    >
      {children}
    </button>
  )
}

function Pip({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-2" style={{ color: 'var(--text-dim)' }}>
      <span className="text-xs uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-base" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Dev fixtures — see docs/playtesting.md                                     */
/* -------------------------------------------------------------------------- */

function BoardWithPieces({ scene }: { scene: Scene }) {
  const [entities, setEntities] = useState<CheckerEntity[]>(() =>
    entitiesFrom(scene.pts, scene.off, scene.oppOff),
  )
  useEffect(() => {
    if (import.meta.env.DEV) installHarness(entities, setEntities)
  }, [entities])

  const rightHalfCx = FIELD_X + 6 * GEO.u + GEO.barW + 3 * GEO.u
  const diceY = FIELD_Y + GEO.innerH * 0.5
  const cube = scene.cube
  const cubeY =
    cube?.owner === 'light'
      ? FIELD_Y + GEO.innerH - 0.55
      : cube?.owner === 'dark'
        ? FIELD_Y + 0.55
        : FIELD_Y + GEO.innerH / 2

  return (
    <Board>
      <AnimatedCheckers entities={entities} />
      {scene.dice && (
        <>
          <Die x={rightHalfCx - 0.62} y={diceY} value={scene.dice[0]} size={0.82} />
          <Die x={rightHalfCx + 0.62} y={diceY} value={scene.dice[1]} size={0.82} />
        </>
      )}
      {cube && <Cube x={FIELD_X + 6 * GEO.u + GEO.barW / 2} y={cubeY} value={cube.value} />}
    </Board>
  )
}

function SceneView({ scene }: { scene: Scene }) {
  const fa = scene.lang === 'fa'
  return (
    <div dir={fa ? 'rtl' : 'ltr'} className="flex h-full flex-col" style={{ background: 'var(--app-bg)' }}>
      <header className="flex items-center justify-between px-6 py-3 text-sm">
        <span className="tracking-[0.3em] uppercase" style={{ color: 'var(--text-dim)' }}>
          {fa ? 'نرد' : 'nard'}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>{fa ? 'مسابقه تا ۷ امتیاز' : 'Match to 7'} · 2–1</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <BoardWithPieces scene={scene} />
      </main>
      <footer className="flex justify-center px-6 py-4 font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        {scene.id} — {scene.probes}
      </footer>
    </div>
  )
}

function Gallery({ theme }: { theme: string }) {
  return (
    <div className="min-h-full p-8" style={{ background: 'var(--app-bg)' }}>
      <h1 className="mb-6 text-sm tracking-[0.3em] uppercase" style={{ color: 'var(--text-dim)' }}>
        nard · gallery · {theme}
      </h1>
      <div className="grid grid-cols-2 gap-8">
        {SCENES.map((s) => (
          <figure key={s.id} className="m-0">
            <BoardWithPieces scene={s} />
            <figcaption className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
              <span className="font-mono">{s.id}</span> — {s.probes}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Dev harness                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Mounted for the whole app, not just the board, so a script can start a match
 * from the ladder. See docs/playtesting.md.
 */
function useDevHarness(): void {
  // Installed ONCE, reading live store state on every call.
  //
  // Closing over React's `state` here instead made every harness method report
  // the board as it looked when the effect last ran, so a driver script saw a
  // frozen game and played 4000 moves into a position that never changed.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const live = () => {
      const s = useGame.getState()
      const position = s.draft.hops.length > 0 ? s.draft.position : s.state.position
      return { s, abs: toAbsolute(position, s.state.onRoll) }
    }
    installPlayHarness({
      state: () => {
        const { s, abs } = live()
        return {
          phase: s.state.phase,
          onRoll: s.state.onRoll,
          dice: s.state.dice,
          cube: s.state.cube,
          score: s.state.match.score,
          result: s.state.result,
          drafted: s.draft.hops.map((h) => `${h.from}/${h.to}`),
          pts: [...abs.pts],
          off: abs.off,
          oppOff: abs.oppOff,
        }
      },
      legal: () => legalMoves(useGame.getState().state).map((m) => m.notation),
      hops: () => {
        const s = useGame.getState()
        if (s.state.phase !== 'to-move') return []
        return availableHops(legalMoves(s.state), s.draft).map(
          (h) => [h.from, h.to] as [number, number],
        )
      },
      roll: () => useGame.getState().roll(),
      move: (from, to) => {
        useGame.getState().select(from)
        useGame.getState().moveTo(to)
      },
      undo: () => useGame.getState().undo(),
      double: () => useGame.getState().double(),
      take: () => useGame.getState().take(),
      pass: () => useGame.getState().passCube(),
      opponent: (rung, personality) =>
        useGame.getState().setOpponent({
          ...(rung !== undefined ? { rung } : {}),
          ...(personality !== undefined
            ? { personality: personality as OpponentConfig['personality'] }
            : {}),
        }),
      thinking: () => useGame.getState().thinking || useGame.getState().busy,
      fast: (on) => useGame.getState().setFast(on),
      start: (opponentId = 'mehrdad', matchLength = 7) =>
        useGame.getState().startMatch(opponentById(opponentId), matchLength),
      sound: () => sound.log.map((r) => ({ ...r })),
      playSound: (event) => sound.play(event as Parameters<typeof sound.play>[0]),
      soundBanks: () =>
        Object.fromEntries(
          Object.entries(SOUNDS).map(([k, v]) => [k, v.length]),
        ) as Record<string, number>,
    })
  }, [])

  // Browsers refuse to start audio without a gesture, so the first interaction
  // unlocks it. Once, then the listener removes itself.
  useEffect(() => {
    const unlock = () => void sound.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

}
