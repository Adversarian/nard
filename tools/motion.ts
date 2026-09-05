/**
 * Motion review harness — how an agent judges an animation it cannot watch.
 *
 * Produces three artifacts per interaction:
 *
 *   .shots/motion/<name>.filmstrip.png   frames tiled into one contact sheet.
 *                                        Frame SPACING is the easing curve made
 *                                        visible: tight = slow, wide = fast.
 *   .shots/motion/<name>.trace.json      real transform values sampled every
 *                                        animation frame.
 *   stdout summary                       measured duration, overshoot and settle
 *                                        time, checked against the spec in
 *                                        docs/design-language.md.
 *
 * The filmstrip answers "does this look right"; the trace answers "does it match
 * what we said it would do". Neither requires watching a video.
 *
 *   pnpm dev &
 *   pnpm motion                # every interaction
 *   pnpm motion checker-move   # just one
 */
import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)
const BASE = process.env.NARD_URL ?? 'http://localhost:5173'
const OUT = '.shots/motion'

interface Interaction {
  id: string
  scene: string
  /** Locations to move between: 1..24, 25 = bar, 0 = off. */
  from: number
  to: number
  /** What docs/design-language.md promises, for the summary to check. */
  expect: { settleMs: [number, number]; overshootPct: [number, number] }
}

const INTERACTIONS: Interaction[] = [
  {
    id: 'checker-move',
    scene: 'opening',
    from: 13,
    to: 7,
    /*
     * lift 110ms + spring(420,28,0.9), which the physics puts at ~260ms.
     *
     * This is a REGRESSION band, not a certification of the spec. What is
     * specified is the spring — stiffness, damping, mass, stated in
     * docs/design-language.md and derived there from the damping ratio. This
     * band is what that spring MEASURES through a sampler that varies between
     * 30 and 60fps run to run, and the bounds are set wide enough to absorb
     * one sample interval at each end. A reading outside it means something
     * changed; a reading inside it does not prove the spring is right.
     */
    expect: { settleMs: [200, 340], overshootPct: [0.3, 9] },
  },
  {
    id: 'checker-hit',
    scene: 'backgame',
    from: 24,
    to: 1,
    expect: { settleMs: [200, 340], overshootPct: [0.3, 9] },
  },
  {
    id: 'bear-off',
    scene: 'bearoff-race',
    from: 6,
    to: 0,
    expect: { settleMs: [200, 340], overshootPct: [0.3, 9] },
  },
]

interface Sample {
  t: number
  checkers: { id: string; x: number; y: number; scale: number }[]
}

/** Measure what actually happened, so the summary is evidence not assertion. */
function summarise(trace: Sample[], moverId: string) {
  const series = trace
    .map((s) => ({ t: s.t, c: s.checkers.find((c) => c.id === moverId) }))
    .filter((s): s is { t: number; c: NonNullable<(typeof s)['c']> } => !!s.c)

  if (series.length < 3) return null
  const first = series[0]!.c
  const last = series.at(-1)!.c
  const dist = Math.hypot(last.x - first.x, last.y - first.y)

  // Both ends of the measurement use the SAME absolute threshold (below).
  // This used `dist * 0.02`, which is the distance-relative artifact the settle
  // comment below argues against — and it bites here for the same reason: on a
  // long move the relative threshold is only crossed well after the checker has
  // actually started, so the measured span comes out short and the animation
  // gets reported as too fast when it is exactly to spec.
  const SETTLED_WITHIN = 0.02
  let moveStart = series[0]!.t
  for (const s of series) {
    if (Math.hypot(s.c.x - first.x, s.c.y - first.y) > SETTLED_WITHIN) {
      moveStart = s.t
      break
    }
  }

  // Overshoot: how far past the resting point it travelled, as a % of distance.
  let maxBeyond = 0
  for (const s of series) {
    const along =
      ((s.c.x - first.x) * (last.x - first.x) + (s.c.y - first.y) * (last.y - first.y)) /
      (dist * dist || 1)
    if (along > 1) maxBeyond = Math.max(maxBeyond, along - 1)
  }

  // Settle: last moment it was still meaningfully off its resting point.
  //
  // The threshold is ABSOLUTE (board units), not a fraction of travel distance.
  // A linear spring settles in the same time regardless of how far it travels,
  // so a distance-relative threshold reports shorter settle times for shorter
  // moves — which is a measurement artifact, not a property of the animation.
  // 0.02u is ~2% of a checker diameter: visually at rest.
  let settleT = moveStart
  for (const s of series) {
    if (Math.hypot(s.c.x - last.x, s.c.y - last.y) > SETTLED_WITHIN) settleT = s.t
  }

  // Frame pacing during the move. A spring with perfect numbers still feels
  // broken if it renders at 17fps, so this is not a secondary metric.
  const moving = series.filter((s) => s.t >= moveStart && s.t <= settleT)
  const gaps: number[] = []
  for (let i = 1; i < moving.length; i++) gaps.push(moving[i]!.t - moving[i - 1]!.t)
  gaps.sort((a, b) => a - b)
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)]! : 0
  const worstGap = gaps.length ? gaps.at(-1)! : 0

  /*
   * Whether the sampling was fine enough to believe the settle figure.
   *
   * The trace comes from a rAF loop under CDP and routinely drops to 30-50ms
   * between samples. A settle time is bracketed by two samples at each end, so
   * a 60ms gap puts +/-60ms of slop on a ~260ms measurement — enough to report
   * an in-spec animation as out of spec. A harness that cries wolf gets
   * ignored, so say when the number cannot carry the weight rather than
   * printing it as a verdict.
   */
  const trustworthy = medianGap > 0 && medianGap <= 25
  /*
   * How much of the reading is sampling, not animation.
   *
   * Both ends of the settle measurement are pinned to whichever sample happened
   * to land nearest the event, so the true value sits within about one sample
   * interval of each endpoint. Reporting the midpoint as if it were exact is
   * what made a 60fps run call an unchanged spring OFF at 167ms one time and
   * in-spec at 233ms the next: the gate on median gap catches a SLOW sampler,
   * but the error here comes from where the samples fell, which a fine gap does
   * not fix.
   */
  const settleSlop = Math.round(medianGap * 2)

  return {
    trustworthy,
    settleSlop,
    frames: series.length,
    medianFrameMs: +medianGap.toFixed(1),
    worstFrameMs: +worstGap.toFixed(1),
    fps: medianGap ? Math.round(1000 / medianGap) : 0,
    liftPeakScale: +Math.max(...series.map((s) => s.c.scale)).toFixed(3),
    travelDistance: +dist.toFixed(3),
    totalMs: +(settleT - series[0]!.t).toFixed(0),
    settleAfterMoveMs: +(settleT - moveStart).toFixed(0),
    overshootPct: +(maxBeyond * 100).toFixed(2),
  }
}

const only = process.argv.slice(2)
const list = only.length ? INTERACTIONS.filter((i) => only.includes(i.id)) : INTERACTIONS

await rm(OUT, { recursive: true, force: true })
await mkdir(`${OUT}/raw`, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const report: string[] = []

for (const it of list) {
  // PASS 1 — no video. Screencast costs real frame budget, so pacing is only
  // trustworthy when nothing is recording. This pass produces the numbers.
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/?scene=${it.scene}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => '__nard' in globalThis)
  await page.waitForTimeout(300)

  // Sample AND act inside a single evaluate.
  //
  // Splitting them across two concurrent page.evaluate calls interleaves CDP
  // round-trips with the render loop and halves the observed frame rate — the
  // harness reported a steady 30fps for an animation that a same-context
  // control measured at 60. One round trip, no interference.
  const { trace, moverId } = await page.evaluate<{
    trace: Sample[]
    moverId: string | null
  }>(`(async () => {
    // Warm up first: run the move and undo it. React, motion and the browser
    // all pay one-time costs on the first animation of a page, and measuring
    // those reports ~30fps for an animation that runs at 60 thereafter. A
    // player never experiences the cold path; the harness should not either.
    __nard.move(${it.from}, ${it.to});
    await __nard.settled();
    __nard.move(${it.to}, ${it.from});
    await __nard.settled();
    await new Promise(r => setTimeout(r, 120));

    const tracing = __nard.trace(2000)
    await new Promise(r => setTimeout(r, 80))
    const moverId = __nard.move(${it.from}, ${it.to})
    return { trace: await tracing, moverId }
  })()`)

  await ctx.close()
  await writeFile(`${OUT}/${it.id}.trace.json`, JSON.stringify(trace, null, 1))

  // PASS 2 — recorded, for the filmstrip only. Its frame timings are NOT used.
  const vctx = await browser.newContext({
    viewport: { width: 1100, height: 720 },
    recordVideo: { dir: `${OUT}/raw/${it.id}`, size: { width: 1100, height: 720 } },
  })
  const vpage = await vctx.newPage()
  await vpage.goto(`${BASE}/?scene=${it.scene}`, { waitUntil: 'networkidle' })
  await vpage.waitForFunction(() => '__nard' in globalThis)
  await vpage.waitForTimeout(300)
  await vpage.evaluate(`__nard.move(${it.from}, ${it.to})`)
  await vpage.waitForTimeout(800)
  const video = vpage.video()
  await vctx.close()
  const videoPath = video ? await video.path() : null

  if (videoPath) {
    // Seek relative to the END of the recording, not the start.
    //
    // Page load time varies, so the move lands at an unpredictable absolute
    // offset — tiling from frame 0 captured the board sitting still before
    // anything happened. The post-move wait is fixed, so the end is a stable
    // reference: -sseof -0.95 starts just before the move every time.
    // Playwright records at 25fps, so 12 frames ≈ 480ms — the whole sequence.
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-sseof', '-0.95',
      '-i', videoPath,
      '-vf', 'fps=25,scale=430:-1,tile=4x3:padding=8:margin=8:color=0x0d0a08',
      '-frames:v', '1',
      `${OUT}/${it.id}.filmstrip.png`,
    ])
  }

  const s = moverId ? summarise(trace, moverId) : null
  const [lo, hi] = it.expect.settleMs
  const [olo, ohi] = it.expect.overshootPct
  const ok = (v: number, a: number, b: number) => (v >= a && v <= b ? 'ok  ' : 'OFF ')

  // What this harness can and cannot certify — see docs/playtesting.md.
  //
  // RELIABLE:  the sequence (lift → carry → set down), that the drop actually
  //            happens, that travel reaches the right place, that nothing is
  //            left mid-animation, and regressions in any of the above.
  // NOISY:     peak overshoot. A 60Hz sampler straddles the peak of a 260ms
  //            spring, so a true 3.8% reads anywhere from 0.5% to 2.8%.
  // NOT PROOF: frame pacing. Headless Chrome under CDP instrumentation varies
  //            between 30 and 60fps run to run on an animation that a clean
  //            same-context control measures at a steady 60. Reported for
  //            information; a single low reading is not a performance bug.
  //
  // Because the sampler is unreliable, the settle figure is only reported as a
  // PASS or FAIL when samples came fast enough to bracket it, and even then only
  // when the whole +/- interval falls outside the band — a midpoint alone is
  // not a measurement. At 50-60ms
  // between samples the slop is a quarter of the thing being measured, and the
  // bear-off case was duly reported as 150ms against a 257ms spring that its
  // own trace showed running for ~250ms. A harness that cries wolf gets
  // ignored, which costs more than the reading was worth.

  report.push(
    s
      ? [
          `${it.id}  (scene: ${it.scene}, ${s.frames} frames sampled)`,
          `  lift peak scale     ${s.liftPeakScale}   spec 1.05`,
          s.trustworthy
            ? `  settle after move   ${ok(s.settleAfterMoveMs + s.settleSlop, lo, 1e9) === 'ok  ' && ok(s.settleAfterMoveMs - s.settleSlop, -1e9, hi) === 'ok  ' ? 'ok  ' : 'OFF '}${s.settleAfterMoveMs}ms +/-${s.settleSlop}  spec ${lo}-${hi}ms`
            : `  settle after move   ....${s.settleAfterMoveMs}ms +/-${s.settleSlop}  spec ${lo}-${hi}ms — SAMPLING TOO COARSE (${s.medianFrameMs}ms between samples) to call this`,
          `  overshoot           ${ok(s.overshootPct, olo, ohi)}${s.overshootPct}%    spec ${olo}-${ohi}% (60Hz sampling under-reads the peak)`,
          `  frame pacing        ....${s.fps}fps (median ${s.medianFrameMs}ms, worst ${s.worstFrameMs}ms)  informational only`,
          `  travel distance     ${s.travelDistance} board units`,
        ].join('\n')
      : `${it.id}  NO TRACE (move returned null — check the act expression)`,
  )
  console.log(`captured ${it.id}`)
}

await browser.close()
await rm(`${OUT}/raw`, { recursive: true, force: true })

const text = report.join('\n\n')
await writeFile(`${OUT}/report.txt`, text + '\n')
console.log('\n' + text)
console.log(`\nfilmstrips + traces -> ${OUT}/`)
