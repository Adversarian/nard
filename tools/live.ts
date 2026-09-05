/**
 * Capture the live play view, mid-match, so the chrome around the board can be
 * looked at in the state it is actually used in.
 *
 * `pnpm shots` renders scene fixtures, which deliberately have no game state —
 * no score, no turn log, no opponent — so the rail is empty in every one of
 * them and the layout cannot be judged from them at all.
 *
 *   pnpm dev &
 *   pnpm live                      # a few turns in, English
 *   pnpm live --lang=fa --turns=8
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { PLAYERS_TURN, startMatch, until } from './harness.js'

const arg = (name: string, fallback: string) =>
  process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const lang = arg('lang', 'en')
const theme = arg('theme', 'khatam')
const turns = Number(arg('turns', '6'))
const name = arg('out', `live-${theme}-${lang}`)
// Defaults to the desktop shell's own window size, not a big monitor — the
// layout that matters is the one the app actually opens at.
const scale = Number(arg('scale', '2'))
const width = Number(arg('w', '1180'))
const height = Number(arg('h', '760'))

await mkdir('.shots', { recursive: true })
/*
 * `--headed` runs a real, GPU-rasterised browser instead of the headless one.
 *
 * Use it for anything involving SVG filters. Headless Chrome renders them on
 * the CPU and gets them right; the accelerated path does not always agree, and
 * a drop-shadow over the board smeared a ghost of its own edge onto the table
 * that was invisible in every headless capture this repo takes. Needs a
 * display (DISPLAY set).
 */
const browser = await chromium.launch({
  channel: 'chrome',
  headless: !process.argv.includes('--headed'),
})
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: scale,
})

await startMatch(page, { lang, theme, opponent: 'mehrdad', matchLength: 7 })

// Play a handful of real turns so the log, the score and the race have
// something in them. Always the first legal play — this is a screenshot, not
// a benchmark.
for (let t = 0; t < turns; t++) {
  if (!(await until(page, PLAYERS_TURN))) break
  const phase = await page.evaluate<string>('__nard.state().phase')
  if (phase === 'to-roll' || phase === 'opening-roll') await page.evaluate('__nard.roll()')
  await page.waitForTimeout(120)
  for (let hop = 0; hop < 4; hop++) {
    const next = await page.evaluate<[number, number] | null>('__nard.hops()[0] ?? null')
    if (!next) break
    await page.evaluate(`__nard.move(${next[0]}, ${next[1]})`)
    await page.waitForTimeout(90)
  }
  await page.waitForTimeout(200)
}

// Stop on the player's turn, with the dice down, so the affordances show.
await until(page, PLAYERS_TURN)
if ((await page.evaluate<string>('__nard.state().phase')) !== 'to-move') {
  await page.evaluate('__nard.roll()')
}
// Optionally leave a checker picked up, so the landing marks are in the shot.
// Without it every capture shows the board with no affordances on it at all,
// which is not the state a player spends their time looking at.
if (process.argv.includes('--pick')) {
  const from = await page.evaluate<number | null>('__nard.hops()[0]?.[0] ?? null')
  if (from !== null) {
    const box = await page.locator(`[data-point="${from}"]`).first().boundingBox()
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }
}
await page.waitForTimeout(700)

await page.screenshot({ path: `.shots/${name}.png` })
console.log(`captured .shots/${name}.png`)
await browser.close()
