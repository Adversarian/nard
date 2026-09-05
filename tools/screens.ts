/**
 * Capture the screens that are not the board: the opponent ladder, the
 * end-of-game overlay, and the review.
 *
 * `pnpm shots` covers board states and `pnpm live` covers the play view, so
 * without this the three screens a player actually starts and ends every
 * session on were the only ones nobody ever looked at.
 *
 *   pnpm dev &
 *   pnpm screens [--lang=fa] [--theme=kaghaz]
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { BASE, PLAYERS_TURN, startMatch, until } from './harness.js'

const arg = (name: string, fallback: string) =>
  process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const lang = arg('lang', 'en')
const theme = arg('theme', 'khatam')
const tag = `${theme}-${lang}`

await mkdir('.shots', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})

/* ---- the ladder --------------------------------------------------------- */
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.evaluate(
  `localStorage.setItem('nard.settings', ${JSON.stringify(
    JSON.stringify({ theme, lang, home: 'right', volume: 0 }),
  )})`,
)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: `.shots/ladder-${tag}.png`, fullPage: true })
console.log(`captured ladder-${tag}`)

/* ---- an end-of-game overlay --------------------------------------------- */
// A one-point match, played to the end at speed, so the overlay is real rather
// than a fixture that can drift from what the game actually produces.
await startMatch(page, { lang, theme, opponent: 'davoud', matchLength: 1, fast: true })

/*
 * Wait for anything the PLAYER has to answer, not just their turn to move.
 *
 * `PLAYERS_TURN` is `onRoll === 'light'`, and during a cube offer `onRoll`
 * stays with the DOUBLER — so when the opponent doubled, that predicate went
 * false and stayed false, the wait timed out, and the loop gave up in the
 * middle of the game. Same trap as decisionMaker() in the app itself.
 */
const ACTIONABLE = `(() => {
  const s = __nard.state()
  if (s.phase === 'game-over' || s.phase === 'match-over') return true
  if (__nard.thinking()) return false
  if (s.phase === 'cube-offered') return true
  return s.onRoll === 'light'
})()`

for (let t = 0; t < 400; t++) {
  if (!(await until(page, ACTIONABLE, 100))) break
  const phase = await page.evaluate<string>('__nard.state().phase')
  if (phase === 'game-over' || phase === 'match-over') break
  if (phase === 'cube-offered') {
    await page.evaluate('__nard.take()')
    continue
  }
  if (phase !== 'to-move') await page.evaluate('__nard.roll()')
  for (let h = 0; h < 4; h++) {
    const n = await page.evaluate<[number, number] | null>('__nard.hops()[0] ?? null')
    if (!n) break
    await page.evaluate(`__nard.move(${n[0]}, ${n[1]})`)
  }
  await page.waitForTimeout(20)
}
await page.waitForTimeout(700)
await page.screenshot({ path: `.shots/outcome-${tag}.png` })
console.log(`captured outcome-${tag}`)

/* ---- the review --------------------------------------------------------- */
const reviewable = await page.evaluate<boolean>(
  "!!document.body.textContent && !!document.querySelector('button')",
)
if (reviewable) {
  const buttons = await page.locator('button').allInnerTexts()
  const idx = buttons.findIndex((t) => /review|بازبینی|تحلیل/i.test(t))
  if (idx >= 0) {
    await page.locator('button').nth(idx).click()
    // Analysis re-evaluates every position in the match through the engine —
    // a couple of thousand of them — so this is a real wait, not a paint delay.
    // Capture the loading card first, then the finished report.
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `.shots/review-loading-${tag}.png` })
    await page
      .locator('text=/PR/')
      .first()
      .waitFor({ timeout: 240_000 })
      .catch(() => console.log('analysis did not finish in time'))
    await page.waitForTimeout(600)
    await page.screenshot({ path: `.shots/review-${tag}.png`, fullPage: true })
    console.log(`captured review-${tag}`)
  } else {
    console.log(`no review button found (buttons: ${JSON.stringify(buttons)})`)
  }
}

await browser.close()
