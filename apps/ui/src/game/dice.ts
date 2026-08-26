/**
 * Interim dice source.
 *
 * `roll(n)` is a pure function of `n`, so matches stay replayable — that is the
 * property the engine and the analysis layer depend on. The seed comes from
 * `crypto.getRandomValues`, which IS synchronous in browsers (only
 * `crypto.subtle` is Promise-only).
 *
 * This is NOT yet the commit–reveal scheme in docs/dice-fairness.md. It is fair
 * and replayable but not *verifiable*, because the player has no commitment to
 * check against. Swapping the derivation below for HMAC-SHA256 is the whole of
 * the M3 change; the shape is already right. See the open question recorded in
 * dice-fairness.md about getting a synchronous hash in the browser.
 */

import type { Dice, Die, DiceSource } from '@nard/engine'

function mix32(a: number, b: number): number {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/** Rejection sampling, so 1..6 are equally likely rather than modulo-skewed. */
function dieFrom(seed: number, counter: number): { die: Die; next: number } {
  let c = counter
  for (;;) {
    const v = mix32(seed, c++)
    const byte = v & 0xff
    if (byte < 252) return { die: ((byte % 6) + 1) as Die, next: c }
  }
}

export class SeededDiceSource implements DiceSource {
  readonly seed: number

  constructor(seed?: number) {
    if (seed !== undefined) {
      this.seed = seed >>> 0
    } else {
      const buf = new Uint32Array(1)
      globalThis.crypto.getRandomValues(buf)
      this.seed = buf[0]!
    }
  }

  roll(rollNumber: number): Dice {
    const a = dieFrom(this.seed, rollNumber * 64)
    const b = dieFrom(this.seed, a.next)
    return [a.die, b.die]
  }
}
