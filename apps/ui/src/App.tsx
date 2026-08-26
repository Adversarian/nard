import { useEffect, useState } from 'react'
import { Board, Cube, Die, FIELD_X, FIELD_Y, GEO } from './board'
import { AnimatedCheckers } from './board/AnimatedCheckers'
import { entitiesFrom, type CheckerEntity } from './board/entities'
import { installHarness } from './dev/harness'
import { SCENES, sceneById, type Scene } from './dev/scenes'

type Theme = 'khatam' | 'tournament' | 'kaghaz'

export function App() {
  const params = new URLSearchParams(location.search)
  const theme = (params.get('theme') as Theme) ?? 'khatam'
  const gallery = location.pathname.startsWith('/gallery')
  const scene = sceneById(params.get('scene'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  if (gallery) return <Gallery theme={theme} />
  return <SceneView scene={scene} />
}

/** Pip count for the on-roll player, from their own perspective. */
function pips(pts: readonly number[], own: boolean): number {
  let total = 0
  for (let p = 1; p <= 24; p++) {
    const n = pts[p] ?? 0
    if (own && n > 0) total += n * p
    if (!own && n < 0) total += -n * (25 - p)
  }
  total += (pts[25] ?? 0) * 25
  if (!own) total += Math.abs(pts[0] ?? 0) * 25
  return total
}

function BoardWithPieces({ scene }: { scene: Scene }) {
  const lang = scene.lang ?? 'en'
  const [entities, setEntities] = useState<CheckerEntity[]>(() =>
    entitiesFrom(scene.pts, scene.off, scene.oppOff),
  )

  // Dev-only control surface, so scripts (and agents) can drive the board
  // deterministically instead of hunting for click targets.
  useEffect(() => {
    if (import.meta.env.DEV) installHarness(entities, setEntities)
  }, [entities])
  // Dice are thrown into the right-hand half, on the roller's side of the bar.
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
      <title>{lang === 'fa' ? 'تخته نرد' : 'Backgammon board'}</title>
    </Board>
  )
}

function SceneView({ scene }: { scene: Scene }) {
  const fa = scene.lang === 'fa'
  const own = pips(scene.pts, true)
  const opp = pips(scene.pts, false)

  return (
    <div
      dir={fa ? 'rtl' : 'ltr'}
      className="flex h-full flex-col"
      style={{ background: 'var(--app-bg)' }}
    >
      <header className="flex items-center justify-between px-6 py-3 text-sm">
        <span className="tracking-[0.3em] uppercase" style={{ color: 'var(--text-dim)' }}>
          {fa ? 'نرد' : 'nard'}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>
          {fa ? 'مسابقه تا ۷ امتیاز' : 'Match to 7'} · 2–1
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <BoardWithPieces scene={scene} />
      </main>

      <footer
        className="flex items-center justify-center gap-10 px-6 py-4 text-sm"
        style={{ color: 'var(--text-dim)' }}
      >
        <Pip label={fa ? 'حریف' : 'Opponent'} value={opp} />
        <span className="font-mono text-xs opacity-60">{scene.title}</span>
        <Pip label={fa ? 'شما' : 'You'} value={own} />
      </footer>
    </div>
  )
}

function Pip({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-xs uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-base" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </span>
  )
}

/** Every scene at once, for a fast eyeball. See docs/playtesting.md. */
function Gallery({ theme }: { theme: Theme }) {
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
