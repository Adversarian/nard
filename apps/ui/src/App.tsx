import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { canDouble, legalMoves, pipCount, positionKey } from '@nard/engine'
import { Board, Cube, Die, RolledDie, FIELD_X, FIELD_Y, GEO } from './board'
import { AnimatedCheckers, Carried } from './board/AnimatedCheckers'
import { Interaction, LastMove } from './board/Interaction'
import { entitiesFrom, topEntityAt, type CheckerEntity } from './board/entities'
import { useDrag } from './board/useDrag'
import { installHarness, installPlayHarness } from './dev/harness'
import { SCENES, sceneById, type Scene } from './dev/scenes'
import { availableHops, destinationsFrom } from './game/draft'
import { useAffordances, useGame } from './game/store'
import { useKeyboard } from './game/useKeyboard'
import type { OpponentConfig } from './game/opponent'
import { Outcome } from './game/Outcome'
import { Review } from './review/Review'
import { findMatch } from './game/archive'
import { Ladder } from './ladder/Ladder'
import { Rail } from './game/Rail'
import { Wordmark } from './chrome/Wordmark'
import { opponentById, opponentKey } from './ladder/opponents'
import { decisionMaker, reconcile, toAbsolute } from './game/view'
import { T } from './i18n'
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
  const t = T(lang)
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

  /**
   * Picking a checker up.
   *
   * `legalFor` is asked afresh on every pointer move rather than closing over
   * `aff.hops`, because the hops on offer depend on what is already drafted
   * this turn — and a drag begun before the draft changed would otherwise keep
   * offering landings that are no longer legal.
   */
  const { drag, dragging, start } = useDrag({
    legalFor: (from, to) =>
      from === selected
        ? aff.destinations.includes(to)
        : destinationsFrom(legalMoves(state), draft, from).some((h) => h.to === to),
    onPick: (from) => store.select(from),
    onDrop: (_from, to) => store.moveTo(to),
  })

  const carried = drag && dragging ? topEntityAt(entities, drag.from) : null

  // The checker under the cursor, when it is one you could actually pick up.
  const [hover, setHover] = useState<number | null>(null)
  const lifted =
    !drag && hover !== null && aff.movable.includes(hover)
      ? (topEntityAt(entities, hover)?.id ?? null)
      : null

  /*
   * The most recent MOVE, marked only when it was the opponent's.
   *
   * Marking your own would light up the board every time you played, which
   * tells you something you already know. And it has to skip past cube actions
   * and turns with no legal play rather than just reading the newest entry:
   * an opponent who moves and then doubles has still moved, and reading only
   * the head of the log meant the mark vanished at exactly the moment the
   * player most wants to see what changed.
   */
  const lastMove = store.log.find((e) => e.kind === 'move')
  const lastPoints = lastMove && lastMove.side !== 'light' ? lastMove.points : []

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
    <div dir={lang === 'fa' ? 'rtl' : 'ltr'} className="room flex h-full flex-col">
      {/*
        Two items, so `justify-between` is honest here. It was three before —
        app name, opponent, score — and the middle one is never actually
        centred under that rule; it lands wherever the outer two leave it, and
        drifted every time the score changed width. Everything that used to sit
        in the middle now lives in the rail, where it has room.
      */}
      <header className="flex shrink-0 items-center justify-between px-6 py-3 2xl:px-10 2xl:py-5">
        <button
          onClick={() => store.toLadder()}
          className="py-1 transition-opacity hover:opacity-75"
          title={t('app.chooseOpponent')}
        >
          <Wordmark />
        </button>
        <Settings />
      </header>

      {/*
        More room as the window grows. Sized for a 1920x1080 screen, where the
        board would otherwise fit its height exactly and sit hard against the
        top and bottom edges of the window — technically the largest it can be,
        and it looks cramped rather than generous. A board wants a margin.
      */}
      <main className="flex min-h-0 flex-1 gap-5 px-5 pb-5 2xl:gap-8 2xl:px-10 2xl:pb-9">
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

        {/*
          `min-w-0` so the board's column can shrink; a flex child defaults to
          its content width and would otherwise push the rail off-screen.

          The board rises into place once, briefly, when a match opens. It is
          short and it does not gate input — you can roll through it — because
          this is a game someone will start five times in an evening and an
          entrance that has to be waited out stops being a pleasure the second
          time. `motion` honours prefers-reduced-motion for this automatically.
        */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.2, 0.8, 0.3, 1] }}
          className="flex min-h-0 min-w-0 flex-1 items-center justify-center"
        >
          <Board home={home} {...(canRoll ? { onFieldClick: () => store.roll() } : {})}>
            {/* Under the checkers, so a marked point reads as the board being
                marked rather than the checkers being tinted. */}
            <LastMove points={lastPoints} />
            <AnimatedCheckers
              entities={entities}
              ghost={carried?.id ?? null}
              lifted={lifted}
            />
            {state.dice &&
              diceFaces.map((v, i) => (
                <RolledDie
                  key={i}
                  x={rightHalfCx + (i - (diceFaces.length - 1) / 2) * 0.86}
                  y={diceY}
                  value={v}
                  size={0.7}
                  index={i}
                  dimmed={i < draft.hops.length}
                />
              ))}
            <Cube x={FIELD_X + 6 * GEO.u + GEO.barW / 2} y={cubeY} value={state.cube.value} />
            <Interaction
              movable={aff.movable}
              hops={aff.hops}
              selected={selected}
              counts={counts}
              dragOver={drag?.over ?? null}
              hover={hover}
              onHover={setHover}
              onDrop={(p) => store.moveTo(p)}
              onStartDrag={start}
            />
            {/* Last, so the carried checker is above the affordances it is
                being dragged onto. */}
            {carried && drag && <Carried side={carried.side} x={drag.x} y={drag.y} />}
          </Board>
        </motion.div>

        <Rail
          lang={lang}
          state={state}
          log={store.log}
          gameNo={store.gameNo}
          opponent={opponentById(store.opponentId)}
          thinking={thinking}
          degraded={degraded}
          pips={pips}
          aff={aff}
          isHumanTurn={isHumanTurn}
          canRoll={canRoll}
          canDoubleNow={canDoubleNow}
          facingDouble={facingDouble}
          onRoll={() => store.roll()}
          onUndo={() => store.undo()}
          onDouble={() => store.double()}
          onTake={() => store.take()}
          onPass={() => store.passCube()}
        />
      </main>
    </div>
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
  const t = T(scene.lang ?? 'en')
  return (
    <div dir={fa ? 'rtl' : 'ltr'} className="room flex h-full flex-col">
      <header className="flex items-center justify-between px-6 py-3 text-sm">
        <Wordmark />
        <span style={{ color: 'var(--text-dim)' }}>{t('match.to', { n: 7 })} · 2–1</span>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center px-6">
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
    <div className="room min-h-full p-8">
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
      log: () =>
        useGame.getState().log.map((e) => ({
          side: e.side,
          kind: e.kind,
          text: e.text,
          points: [...e.points],
        })),
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
