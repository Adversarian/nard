/**
 * Shared setup for the browser-driven harnesses.
 *
 * The app opens on the opponent ladder, so every harness has to start a match
 * before there is a board to test. That was duplicated in each tool and drifted
 * the moment the entry screen changed — `pnpm sound` quietly measured an empty
 * ladder and reported no sounds at all. One place now.
 */
import type { Page } from '@playwright/test'

export const BASE = process.env.NARD_URL ?? 'http://localhost:5173'

export interface StartOptions {
  opponent?: string
  matchLength?: number
  /** Skip the opponent's deliberate pacing. On for automated runs. */
  fast?: boolean
  theme?: string
  lang?: string
  volume?: number
  /** Which side the player's home board sits on. Mirrors the whole case. */
  home?: 'left' | 'right'
}

/** Load the app, apply settings, and start a match. Leaves a live board. */
export async function startMatch(page: Page, opts: StartOptions = {}): Promise<void> {
  const {
    opponent = 'mehrdad',
    matchLength = 7,
    fast = true,
    theme = 'khatam',
    lang = 'en',
    volume = 0,
    home = 'right',
  } = opts

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(
    `localStorage.setItem('nard.settings', ${JSON.stringify(
      JSON.stringify({ theme, lang, home, volume }),
    )})`,
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => '__nard' in globalThis)
  await page.evaluate(`__nard.fast(${fast})`)
  await page.evaluate(`__nard.start(${JSON.stringify(opponent)}, ${matchLength})`)
  /*
   * Wait for the board to actually exist, rather than for a fixed 200ms.
   *
   * The harness reads the zustand store, which holds a perfectly playable game
   * even while the LADDER is on screen — so when `start` did not take, a
   * driver would go on to play an entire match against a board nobody was
   * looking at, and the screenshot at the end of it was of the ladder. Nothing
   * failed; the output was just quietly wrong.
   */
  await page.waitForSelector('svg[aria-label="Backgammon board"]', { timeout: 10_000 })
}

/** Poll a predicate inside the page. Returns false on timeout rather than throwing. */
export async function until(page: Page, expr: string, tries = 200): Promise<boolean> {
  return page.evaluate<boolean>(`(async () => {
    for (let i = 0; i < ${tries}; i++) {
      if (${expr}) return true
      await new Promise(r => setTimeout(r, 100))
    }
    return false
  })()`)
}

/** True when it is the player's turn and nothing is animating. */
export const PLAYERS_TURN =
  "(() => { const s = __nard.state(); return s.onRoll === 'light' && !__nard.thinking() })()"

/**
 * True when the player has dice down and checkers to move.
 *
 * `PLAYERS_TURN` is not enough for anything that touches the DOM. It is true
 * during the opening roll too, and if that roll goes to the opponent the store
 * still reports legal hops — the OPPONENT's — while the board shows no hit
 * targets at all, because the UI only offers them to the side actually on roll.
 * A driver that trusted `__nard.hops()` there went looking for a point that
 * was never rendered.
 */
export const HUMAN_TO_MOVE =
  "(() => { const s = __nard.state(); return s.phase === 'to-move' && s.onRoll === 'light' && !__nard.thinking() })()"
