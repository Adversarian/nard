/**
 * Sound review harness — how an agent checks audio it cannot hear.
 *
 * The same discipline as tools/motion.ts: do not claim a perceptual property you
 * have not observed; verify a structural one instead. See docs/sound-spec.md.
 *
 *   pnpm dev &
 *   pnpm sound
 */
import { chromium } from '@playwright/test'

const BASE = process.env.NARD_URL ?? 'http://localhost:5173'

const browser = await chromium.launch({
  channel: 'chrome',
  // Otherwise the AudioContext stays suspended and nothing plays at all.
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => '__nard' in globalThis)
await page.evaluate('__nard.fast(true)')
await page.mouse.click(20, 20) // unlock audio
await page.waitForTimeout(600)

const checks: [string, boolean, string][] = []
const check = (name: string, ok: boolean, detail = '') => checks.push([name, ok, detail])

// 1. Every event has samples, and repeated events have real variation.
const banks = await page.evaluate<Record<string, number>>('__nard.soundBanks()')
const missing = Object.entries(banks).filter(([, n]) => n === 0).map(([k]) => k)
check('every event has samples', missing.length === 0, missing.join(', '))
const thin = Object.entries(banks)
  .filter(([k, n]) => ['place', 'hit', 'off', 'dice'].includes(k) && n < 3)
  .map(([k, n]) => `${k}=${n}`)
check('repeated events have >=3 variants', thin.length === 0, thin.join(', ') || JSON.stringify(banks))

// 2. A checker move produces exactly one 'place', at CONTACT.
const move = await page.evaluate<{ fired: { event: string; dt: number }[] }>(`(async () => {
  const n = __nard
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  n.fast(false)
  while (n.state().phase !== 'to-move' || n.state().onRoll !== 'light') {
    const s = n.state()
    if (s.onRoll === 'light' && (s.phase === 'to-roll' || s.phase === 'opening-roll')) n.roll()
    await sleep(80)
  }
  // The turn flips when the opponent's move COMMITS, but its last checker is
  // still in flight and its contact sound lands ~370ms later. Measuring before
  // that settles attributes the opponent's click to our move.
  await n.settled()
  await sleep(120)
  const before = n.sound().length
  const t0 = performance.now()
  const h = n.hops()
  n.move(h[0][0], h[0][1])
  await sleep(1200)
  return { fired: n.sound().slice(before).map(r => ({ event: r.event, dt: +(r.t - t0).toFixed(0) })) }
})()`)

const places = move.fired.filter((f) => f.event === 'place')
check('a checker move plays exactly one place', places.length === 1, JSON.stringify(move.fired))
// lift 110ms + travel settle ~260ms => contact around 370ms. Pick-up would be ~0.
const dt = places[0]?.dt ?? -1
check(
  'it fires at contact, not pick-up',
  dt > 200 && dt < 900,
  `fired at ${dt}ms (pick-up would be ~0, contact ~370)`,
)

// 3. Consecutive repeats use different samples.
const variants = await page.evaluate<number[]>(`(() => {
  const seen = []
  for (let i = 0; i < 40; i++) {
    const before = __nard.sound().length
    // Play through the public surface so this exercises the real picker.
    __nard.playSound('place')
    const rec = __nard.sound()[before]
    if (rec) seen.push(rec.variant)
  }
  return seen
})()`)
if (variants.length >= 4) {
  let repeats = 0
  for (let i = 1; i < variants.length; i++) if (variants[i] === variants[i - 1]) repeats++
  check('no sample repeats back to back', repeats === 0, `${repeats} immediate repeats`)
} else {
  check('no sample repeats back to back', false, 'variant log empty — hook missing?')
}

// 4. Nothing plays while the window is hidden.
const hidden = await page.evaluate<number>(`(async () => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
  const before = __nard.sound().length
  const h = __nard.hops()
  if (h.length) __nard.move(h[0][0], h[0][1])
  await new Promise(r => setTimeout(r, 900))
  const after = __nard.sound().length
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  return after - before
})()`)
check('silent while the window is hidden', hidden === 0, `${hidden} sound(s) played`)

await browser.close()

let failed = 0
for (const [name, ok, detail] of checks) {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  — ${detail}` : ''}`)
}
console.log(
  '\nNot checked: whether any of it sounds right. That is a human judgement;\n' +
  'see docs/sound-spec.md.',
)
process.exit(failed > 0 ? 1 : 0)
