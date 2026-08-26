/**
 * Play complete games through the real UI.
 *
 * Not a unit test — this drives the actual click path (pick up a checker, drop
 * it on a point) via window.__nard, so it exercises turn drafting, the engine
 * boundary, the animation identity reconciler and the render loop together.
 * If a game can be played to completion here, a person can play one.
 *
 *   pnpm dev &
 *   pnpm playtest            # one game
 *   pnpm playtest 5          # five
 */
import { chromium } from '@playwright/test'

const BASE = process.env.NARD_URL ?? 'http://localhost:5173'
const games = Number(process.argv[2] ?? 1)

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const errors: string[] = []
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`)
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => '__nard' in globalThis)

for (let g = 1; g <= games; g++) {
  const result = await page.evaluate<{
    turns: number
    hops: number
    phase: string
    result: unknown
    score: unknown
    stalled?: string
  }>(`(async () => {
    const n = __nard
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    let turns = 0, hops = 0

    for (let guard = 0; guard < 4000; guard++) {
      const s = n.state()
      if (s.phase === 'game-over' || s.phase === 'match-over') {
        return { turns, hops, phase: s.phase, result: s.result, score: s.score }
      }
      if (s.phase === 'to-roll' || s.phase === 'opening-roll') {
        n.roll(); turns++; await sleep(30); continue
      }
      if (s.phase === 'to-move') {
        const h = n.hops()
        if (h.length === 0) { await sleep(120); continue }
        const pick = h[Math.floor(Math.random() * h.length)]
        n.move(pick[0], pick[1]); hops++
        await sleep(25)
        continue
      }
      if (s.phase === 'cube-offered') { n.take(); continue }
      await sleep(40)
    }
    const s = n.state()
    return { turns, hops, phase: s.phase, result: s.result, score: s.score, stalled: JSON.stringify(s).slice(0, 400) }
  })()`)

  const tag = result.stalled ? 'STALLED' : 'ok'
  console.log(
    `game ${g}: ${tag}  ${result.turns} rolls, ${result.hops} checker plays, phase=${result.phase}, result=${JSON.stringify(result.result)}`,
  )
  if (result.stalled) console.log(`  state: ${result.stalled}`)

  if (result.phase === 'game-over') {
    await page.evaluate(`__nard.state()`) // keep the harness fresh
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForFunction(() => '__nard' in globalThis)
  }
}

if (errors.length) {
  console.log(`\n${errors.length} page error(s):`)
  console.log(errors.slice(0, 10).join('\n'))
}
await browser.close()
if (errors.length) process.exit(1)
