/**
 * How long the opponent's turn takes to watch.
 *
 * The player has to be able to FOLLOW it: the dice land, they sit still long
 * enough to read, and then the checkers move one per beat. Those pauses are
 * deliberate values in game/opponent.ts, and they are invisible to every other
 * check here — `pnpm playtest` runs with `fast` on, which zeroes all of them,
 * so the pacing could drift to nothing and the whole suite would stay green.
 *
 * Measured by watching the STORE from inside the page, not the sound log.
 * Sounds fire when a travel animation ENDS, and the player's own checkers are
 * still in the air when the opponent rolls — so a sound-based reading timed the
 * player's checker landing against the opponent's dice and reported 306ms for a
 * pause of well over a second. Timing from inside the page also keeps CDP
 * round-trips out of the numbers.
 *
 *   pnpm dev &
 *   pnpm pacing
 */
import { chromium } from '@playwright/test'
import { HUMAN_TO_MOVE, PLAYERS_TURN, startMatch, until } from './harness.js'

interface Turn {
  /** Dice appearing → the opponent's first checker leaving its point. */
  read: number
  /** Between one checker and the next, within the turn. */
  hops: number[]
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

let failures = 0
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}`)
  if (!ok) failures += 1
}

await startMatch(page, { fast: false })

/** Get to a state where the PLAYER has checkers to move. */
async function readyToMove() {
  for (let i = 0; i < 40; i += 1) {
    if (await until(page, HUMAN_TO_MOVE, 30)) return true
    if (!(await until(page, PLAYERS_TURN, 120))) return false
    const phase = await page.evaluate<string>('__nard.state().phase')
    if (phase === 'to-roll' || phase === 'opening-roll') await page.evaluate('__nard.roll()')
    else if (phase === 'cube-offered') await page.evaluate('__nard.take()')
    else if (phase === 'game-over' || phase === 'match-over') return false
    await page.waitForTimeout(200)
  }
  return false
}

/**
 * Watch one opponent turn from inside the page, at animation frame resolution.
 * Returns null if the opponent doubled or had no legal play.
 */
const WATCH = `(async () => {
  const s = () => __nard.state()
  const wait = async (p, ms) => {
    const end = performance.now() + ms
    while (performance.now() < end) {
      if (p()) return true
      await new Promise(r => requestAnimationFrame(r))
    }
    return false
  }
  if (!(await wait(() => s().onRoll === 'dark', 15000))) return null
  if (!(await wait(() => s().onRoll === 'dark' && s().dice, 15000))) return null
  const t0 = performance.now()
  const stamps = []
  let seen = 0
  // The LAST hop of a turn commits it, which empties the draft — so counting
  // only draft growth misses the final checker entirely, and a two-checker turn
  // yields one stamp and no gaps at all. The handover to the player IS that
  // last checker, so stamp it too.
  await wait(() => {
    if (s().onRoll !== 'dark') { stamps.push(performance.now()); return true }
    const n = s().drafted.length
    if (n > seen) { seen = n; stamps.push(performance.now()) }
    return false
  }, 15000)
  if (stamps.length === 0) return null
  const hops = []
  for (let i = 1; i < stamps.length; i++) hops.push(stamps[i] - stamps[i-1])
  return { read: stamps[0] - t0, hops }
})()`

const turns: Turn[] = []
for (let t = 0; t < 6; t += 1) {
  if (!(await readyToMove())) break
  const watching = page.evaluate<Turn | null>(WATCH)
  for (let h = 0; h < 4; h += 1) {
    const n = await page.evaluate<[number, number] | null>('__nard.hops()[0] ?? null')
    if (!n) break
    await page.evaluate(`__nard.move(${n[0]}, ${n[1]})`)
  }
  const got = await watching
  if (got) turns.push(got)
}

const median = (xs: number[]) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : 0

const read = Math.round(median(turns.map((x) => x.read)))
const hopList = turns.flatMap((x) => x.hops)
const hop = Math.round(median(hopList))
console.log(`\n  roll -> first checker   ${read}ms   (${turns.length} turns)`)
console.log(`  checker -> checker      ${hop}ms   (${hopList.length} gaps)`)

// Generous bands. The point is to catch the pacing being LOST — someone zeroing
// a sleep, or `fast` leaking into normal play — not to pin an exact feel.
check(turns.length >= 2, `measured at least two opponent turns (${turns.length})`)
check(read >= 900, `the dice are readable before the first checker moves (${read}ms, want >=900)`)
check(read <= 3000, `the opponent does not dawdle (${read}ms, want <=3000)`)
check(hop >= 250, `checkers move one per beat, not all at once (${hop}ms, want >=250)`)

await browser.close()
console.log(failures === 0 ? '\nall pacing checks passed' : `\n${failures} pacing check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
