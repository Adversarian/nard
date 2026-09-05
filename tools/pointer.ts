/**
 * Drive the board with REAL mouse events.
 *
 * Every other harness in this repo talks to `__nard` and never touches the DOM,
 * so all of them passed for weeks against a board on which drag-and-drop was
 * not implemented at all — the player's first complaint. This one presses,
 * moves and releases an actual pointer, which is the only way that class of bug
 * shows up.
 *
 *   pnpm dev &
 *   pnpm pointer
 */
import { chromium, type Page } from '@playwright/test'
import { HUMAN_TO_MOVE, PLAYERS_TURN, startMatch, until } from './harness.js'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

/*
 * React logs rather than throws for a whole class of real bugs — duplicate
 * keys, bad nesting, state updates on unmounted components. Nothing in this
 * repo was reading the console, so a duplicate key in the board's <defs>, which
 * React warns may cause it to OMIT an element, sat there unnoticed. Collect
 * them and fail the run.
 */
const consoleErrors: string[] = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(`uncaught: ${e.message}`))

let failures = 0
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}`)
  if (!ok) failures += 1
}

/** Centre of a point's hit target, in page coordinates. */
async function centreOf(page: Page, point: number) {
  const box = await page.locator(`[data-point="${point}"]`).first().boundingBox()
  if (!box) throw new Error(`no hit target for point ${point}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const state = () => page.evaluate<{ pts: number[]; phase: string }>('__nard.state()')
const hops = () => page.evaluate<[number, number][]>('__nard.hops()')

await startMatch(page, { fast: true })

/** Get to a state where the player actually has checkers to move. */
async function readyToMove() {
  for (let i = 0; i < 30; i += 1) {
    if (await until(page, HUMAN_TO_MOVE, 30)) return true
    if (!(await until(page, PLAYERS_TURN, 60))) return false
    const phase = (await state()).phase
    if (phase === 'to-roll' || phase === 'opening-roll') await page.evaluate('__nard.roll()')
    await page.waitForTimeout(150)
  }
  return false
}

if (!(await readyToMove())) throw new Error('never reached a movable position')
await page.waitForTimeout(250)

/* ---- a real drag moves a checker ----------------------------------------- */
{
  const [hop] = await hops()
  if (!hop) throw new Error('no legal hop to drag')
  const [from, to] = hop
  const before = (await state()).pts[from]!

  const a = await centreOf(page, from)
  const b = await centreOf(page, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  // In steps: the hook only treats a press as a drag once it has travelled,
  // and a single jump to the target is indistinguishable from a click.
  await page.mouse.move(b.x, b.y, { steps: 12 })
  await page.waitForTimeout(60)
  await page.mouse.up()
  await page.waitForTimeout(400)

  const after = (await state()).pts[from]!
  check(Math.abs(after) === Math.abs(before) - 1, `drag ${from}->${to} left the source point`)
  check((await state()).pts[to] !== 0, `drag ${from}->${to} landed on the destination`)
}

/* ---- a drag released on nothing puts the checker back -------------------- */
{
  await readyToMove()
  const [hop] = await hops()
  if (hop) {
    const [from] = hop
    const before = [...(await state()).pts]
    const a = await centreOf(page, from)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(a.x, a.y - 240, { steps: 10 }) // off the board entirely
    await page.mouse.up()
    await page.waitForTimeout(300)
    const after = (await state()).pts
    check(
      before.every((v, i) => v === after[i]),
      'a drag released off the board changes nothing',
    )
  }
}

/* ---- click-to-move still works ------------------------------------------ */
{
  await readyToMove()
  const [hop] = await hops()
  if (hop) {
    const [from, to] = hop
    const before = (await state()).pts[from]!
    const a = await centreOf(page, from)
    const b = await centreOf(page, to)
    await page.mouse.click(a.x, a.y)
    await page.waitForTimeout(120)
    await page.mouse.click(b.x, b.y)
    await page.waitForTimeout(400)
    const after = (await state()).pts[from]!
    check(Math.abs(after) === Math.abs(before) - 1, `click ${from} then ${to} moves the checker`)
  }
}

/* ---- the same drag on a MIRRORED board ----------------------------------- */
/*
 * `home: 'left'` mirrors the entire case, and the drag hook converts pointer
 * coordinates with `getScreenCTM()` taken from the element that was pressed —
 * which sits INSIDE that mirror. Taking it from the <svg> root instead would
 * work perfectly on the default board and drop every checker on the horizontal
 * reflection of the point aimed at, which is the kind of bug that ships.
 */
{
  await startMatch(page, { fast: true, home: 'left' })
  if (await readyToMove()) {
    await page.waitForTimeout(250)
    const [hop] = await hops()
    if (hop) {
      const [from, to] = hop
      const before = (await state()).pts[from]!
      const a = await centreOf(page, from)
      const b = await centreOf(page, to)
      await page.mouse.move(a.x, a.y)
      await page.mouse.down()
      await page.mouse.move(b.x, b.y, { steps: 12 })
      await page.waitForTimeout(60)
      await page.mouse.up()
      await page.waitForTimeout(400)
      const after = (await state()).pts[from]!
      check(
        Math.abs(after) === Math.abs(before) - 1,
        `drag ${from}->${to} works with the home board on the left`,
      )
    }
  }
}

check(consoleErrors.length === 0, 'no console errors during play')
for (const e of [...new Set(consoleErrors)].slice(0, 5)) console.log(`       ${e.slice(0, 160)}`)

await browser.close()
console.log(failures === 0 ? '\nall pointer checks passed' : `\n${failures} pointer check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
