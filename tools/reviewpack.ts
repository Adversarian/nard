/**
 * Capture the whole interface, once, into `.shots/review/`.
 *
 * For handing to a reviewer — human or otherwise — who needs to see every
 * screen the game has in the states a player actually meets them in, at the
 * sizes it actually ships at, in both languages and all three boards. Assembled
 * in one place because a review of a stale screenshot is worse than no review.
 *
 *   pnpm dev &
 *   pnpm reviewpack
 */
import { chromium, type Page } from '@playwright/test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { BASE, HUMAN_TO_MOVE, PLAYERS_TURN, startMatch, until } from './harness.js'

const OUT = '.shots/review'
await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const index: string[] = []

async function shot(page: Page, name: string, note: string, full = false) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  index.push(`${name}.png — ${note}`)
  console.log('  ', name)
}

async function settings(page: Page, o: Record<string, unknown>) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(`localStorage.setItem('nard.settings', ${JSON.stringify(JSON.stringify(o))})`)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
}

/** Play a few real turns so the chrome has something in it. */
async function warmUp(page: Page, turns: number) {
  for (let t = 0; t < turns; t += 1) {
    if (!(await until(page, PLAYERS_TURN, 120))) break
    const phase = await page.evaluate<string>('__nard.state().phase')
    if (phase === 'cube-offered') { await page.evaluate('__nard.take()'); continue }
    if (phase !== 'to-move') await page.evaluate('__nard.roll()')
    await page.waitForTimeout(80)
    for (let h = 0; h < 4; h += 1) {
      const n = await page.evaluate<[number, number] | null>('__nard.hops()[0] ?? null')
      if (!n) break
      await page.evaluate(`__nard.move(${n[0]}, ${n[1]})`)
      await page.waitForTimeout(60)
    }
  }
  await until(page, HUMAN_TO_MOVE, 120)
}

/* ---- the play view, at the sizes it ships at ----------------------------- */
for (const [w, h, name, note] of [
  [1920, 1080, 'play-fhd', 'the play view at 1920x1080'],
  [1600, 1000, 'play-default', "the play view at the shell's default window, 1600x1000"],
  [960, 640, 'play-min', 'the play view at the smallest allowed window, 960x640'],
] as const) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await startMatch(page, { fast: true })
  await warmUp(page, 8)
  if ((await page.evaluate<string>('__nard.state().phase')) !== 'to-move') {
    await page.evaluate('__nard.roll()')
  }
  await page.waitForTimeout(600)
  await shot(page, name, note)
  // and with a checker picked up, so the landing marks are visible
  if (name === 'play-fhd') {
    const from = await page.evaluate<number | null>('__nard.hops()[0]?.[0] ?? null')
    if (from !== null) {
      const box = await page.locator(`[data-point="${from}"]`).first().boundingBox()
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(500)
      await shot(page, 'play-picked', 'a checker picked up: landing marks, die numerals, hit ring')
    }
  }
  await page.close()
}

/* ---- Persian ------------------------------------------------------------- */
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  await startMatch(page, { fast: true, lang: 'fa' })
  await warmUp(page, 6)
  await page.waitForTimeout(500)
  await shot(page, 'play-persian', 'the play view in Persian — chrome mirrors, the board does not')
  await page.close()
}

/* ---- the other two boards ------------------------------------------------ */
for (const theme of ['tournament', 'kaghaz'] as const) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  await startMatch(page, { fast: true, theme })
  await warmUp(page, 5)
  await page.waitForTimeout(500)
  await shot(page, `play-${theme}`, `the ${theme} board`)
  await page.close()
}

/* ---- the ladder, and settings ------------------------------------------- */
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  await settings(page, { theme: 'khatam', lang: 'en', home: 'right', volume: 0 })
  await shot(page, 'ladder', 'choosing an opponent — the first screen a player sees', true)
  await settings(page, { theme: 'khatam', lang: 'fa', home: 'right', volume: 0 })
  await shot(page, 'ladder-persian', 'the same in Persian', true)
  await settings(page, { theme: 'khatam', lang: 'en', home: 'right', volume: 0 })
  await page.evaluate('__nard.start("mehrdad", 7)')
  await page.waitForTimeout(400)
  await page.locator('[aria-label="Settings"]').click()
  await page.waitForTimeout(400)
  await shot(page, 'settings', 'the settings popover')
  await page.close()
}

/* ---- board states that are hard to reach by playing ---------------------- */
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  for (const [scene, note] of [
    ['crowded-point', 'seven checkers on one point — stack compression and the count chip'],
    ['both-on-bar', 'both players on the bar'],
    ['bearoff-race', 'bearing off — the tray in use'],
    ['cube-64', 'the doubling cube at its maximum'],
  ] as const) {
    await page.goto(`${BASE}/?scene=${scene}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await shot(page, `board-${scene}`, note)
  }
  await page.close()
}

await writeFile(`${OUT}/index.txt`, index.join('\n') + '\n')
await browser.close()
console.log(`\n${index.length} images -> ${OUT}/`)
