import type { Dice, DiceSource, Die } from './types.js'
import { portableHashFunctions } from './sha256.js'

export interface HashFunctions {
  readonly sha256: (message: Uint8Array) => Uint8Array
  readonly hmacSha256: (
    key: Uint8Array,
    message: Uint8Array,
  ) => Uint8Array
}

function rollMessage(rollNumber: number, block: number): Uint8Array {
  const text = block === 0 ? `roll:${rollNumber}` : `roll:${rollNumber}:${block}`
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index)
  }
  return bytes
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

function dieFromByte(byte: number): Die {
  return ((byte % 6) + 1) as Die
}

/**
 * Deterministic commit-reveal dice from docs/dice-fairness.md.
 *
 * Entropy generation is intentionally outside the engine. Supply the 32-byte
 * seed; the hash seam remains injectable for native adapters and tests.
 */
export class CommitRevealDiceSource implements DiceSource {
  readonly #seed: Uint8Array
  readonly #hashes: HashFunctions

  constructor(
    seed: Uint8Array,
    hashes: HashFunctions = portableHashFunctions,
  ) {
    if (seed.length !== 32) throw new RangeError('dice seed must be exactly 32 bytes')
    this.#seed = new Uint8Array(seed)
    this.#hashes = hashes
  }

  roll(rollNumber: number): Dice {
    if (!Number.isInteger(rollNumber) || rollNumber < 0) {
      throw new RangeError('roll number must be a non-negative integer')
    }

    const dice: Die[] = []

    for (let block = 0; ; block += 1) {
      const stream = this.#hashes.hmacSha256(
        this.#seed,
        rollMessage(rollNumber, block),
      )
      for (const byte of stream) {
        // 252 is the largest multiple of six below 256.
        if (byte >= 252) continue
        dice.push(dieFromByte(byte))
        if (dice.length === 2) return [dice[0]!, dice[1]!]
      }
    }
  }
}

export function diceCommitment(
  seed: Uint8Array,
  hashes: Pick<HashFunctions, 'sha256'> = portableHashFunctions,
): Uint8Array {
  if (seed.length !== 32) throw new RangeError('dice seed must be exactly 32 bytes')
  return new Uint8Array(hashes.sha256(seed))
}

export function verifyDiceCommitment(
  seed: Uint8Array,
  commitment: Uint8Array,
  hashes: Pick<HashFunctions, 'sha256'> = portableHashFunctions,
): boolean {
  return bytesEqual(diceCommitment(seed, hashes), commitment)
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
