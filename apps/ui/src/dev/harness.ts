/**
 * Development control surface: `window.__nard`.
 *
 * Lets a script drive the game deterministically — no pixel-hunting, no
 * guessing at click targets. This is what makes it possible for an agent to
 * actually play the game and to measure its animations (see tools/motion.ts and
 * docs/playtesting.md).
 *
 * Dev-only. Tree-shaken out of production builds via `import.meta.env.DEV`.
 */

import type { CheckerEntity, Loc } from '../board/entities'

export interface NardHarness {
  /** Every checker and where it currently is. */
  state(): { id: string; side: string; loc: Loc }[]
  /** Move the top checker from one location to another. Returns its id. */
  move(from: Loc | number, to: Loc | number): string | null
  /** True while any checker is mid-animation. */
  animating(): boolean
  /** Resolve once nothing is animating. */
  settled(timeoutMs?: number): Promise<void>
  /** Sample transforms at every animation frame until settled. */
  trace(ms?: number): Promise<TraceSample[]>
}

export interface TraceSample {
  t: number
  checkers: { id: string; x: number; y: number; scale: number }[]
}

const asLoc = (v: Loc | number): Loc =>
  typeof v === 'number'
    ? v === 25
      ? { kind: 'bar' }
      : v === 0
        ? { kind: 'off' }
        : { kind: 'point', point: v }
    : v

function sameLoc(a: Loc, b: Loc): boolean {
  if (a.kind !== b.kind) return false
  return a.kind !== 'point' || a.point === (b as { point: number }).point
}

const NUM = /-?[\d.]+/

/**
 * Read positions from the INLINE style string, not getComputedStyle.
 *
 * getComputedStyle forces a style recalculation, and doing that once per checker
 * per frame made the sampler itself the bottleneck — it reported ~30fps for an
 * animation that was actually running fine. Motion writes inline styles, so the
 * string is already there and reading it is free.
 */
function readTransforms(): TraceSample['checkers'] {
  const out: TraceSample['checkers'] = []
  const els = document.querySelectorAll<SVGGElement>('[data-checker]')
  for (const el of els) {
    const s = el.style.transform
    if (!s) continue
    const tx = s.match(/translateX\((-?[\d.]+)/)
    const ty = s.match(/translateY\((-?[\d.]+)/)
    const sc = s.match(/scale\((-?[\d.]+)/)
    out.push({
      id: el.dataset.checker!,
      x: tx ? +tx[1]! : 0,
      y: ty ? +ty[1]! : 0,
      scale: sc ? +sc[1]! : 1,
    })
  }
  return out
}

void NUM

export function installHarness(
  entities: CheckerEntity[],
  commit: (next: CheckerEntity[]) => void,
): void {
  const anyMoving = () => document.querySelector('[data-checker][data-moving]') !== null

  const harness: NardHarness = {
    state: () => entities.map((e) => ({ id: e.id, side: e.side, loc: e.loc })),

    move(from, to) {
      const f = asLoc(from)
      const t = asLoc(to)
      const candidates = entities.filter((e) => sameLoc(e.loc, f))
      const mover = candidates.at(-1)
      if (!mover) return null
      // The mover goes to the END of the list, not back into its old slot.
      // layout() stacks in list order, so leaving it in place would insert the
      // checker at the BOTTOM of its destination stack and shove the checkers
      // already there upward — a checker borne off would appear underneath the
      // ones borne off before it. Arriving checkers land on top, everywhere.
      commit([...entities.filter((e) => e.id !== mover.id), { ...mover, loc: t }])
      return mover.id
    },

    animating: anyMoving,

    async settled(timeoutMs = 4000) {
      const deadline = performance.now() + timeoutMs
      // Two clear frames, so we don't resolve in the gap between sequence steps.
      let clear = 0
      while (performance.now() < deadline) {
        await new Promise(requestAnimationFrame)
        clear = anyMoving() ? 0 : clear + 1
        if (clear >= 2) return
      }
      throw new Error('settled() timed out')
    },

    trace(ms = 2000) {
      // Register the NEXT frame before doing any work in this one.
      //
      // The obvious `while (…) await new Promise(requestAnimationFrame)` loop
      // does its sampling before re-registering, so it misses every other frame
      // and reports a rock-solid 60fps animation as 30fps. That sent me hunting
      // a performance problem that did not exist. Keep the registration first.
      return new Promise<TraceSample[]>((resolve) => {
        const samples: TraceSample[] = []
        const t0 = performance.now()
        let sawMotion = false
        let clear = 0
        let done = false

        const step = (now: number) => {
          if (!done) requestAnimationFrame(step)

          samples.push({ t: +(now - t0).toFixed(2), checkers: readTransforms() })
          if (anyMoving()) {
            sawMotion = true
            clear = 0
          } else {
            clear++
          }
          if ((sawMotion && clear >= 4) || now - t0 >= ms) {
            done = true
            resolve(samples)
          }
        }
        requestAnimationFrame(step)
      })
    },
  }

  ;(globalThis as unknown as { __nard: NardHarness }).__nard = harness
}
