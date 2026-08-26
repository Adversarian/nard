import type { HashFunctions } from './dice.js'

const BLOCK_BYTES = 64
const DIGEST_BYTES = 32

const INITIAL_STATE = Uint32Array.from([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

const ROUND_CONSTANTS = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

function padded(message: Uint8Array): Uint8Array {
  const paddingBytes =
    (BLOCK_BYTES - ((message.length + 9) % BLOCK_BYTES)) % BLOCK_BYTES
  const result = new Uint8Array(message.length + 1 + paddingBytes + 8)
  result.set(message)
  result[message.length] = 0x80

  const bitLengthHigh = Math.floor(message.length / 0x20000000)
  const bitLengthLow = (message.length << 3) >>> 0
  const view = new DataView(result.buffer)
  view.setUint32(result.length - 8, bitLengthHigh, false)
  view.setUint32(result.length - 4, bitLengthLow, false)
  return result
}

function concatenate(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.length + right.length)
  result.set(left)
  result.set(right, left.length)
  return result
}

/** Synchronous, dependency-free SHA-256 for deterministic dice in every host. */
export function sha256(message: Uint8Array): Uint8Array {
  const bytes = padded(message)
  const state = new Uint32Array(INITIAL_STATE)
  const schedule = new Uint32Array(64)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  for (let offset = 0; offset < bytes.length; offset += BLOCK_BYTES) {
    for (let word = 0; word < 16; word += 1) {
      schedule[word] = view.getUint32(offset + word * 4, false)
    }
    for (let word = 16; word < 64; word += 1) {
      const previous15 = schedule[word - 15]!
      const previous2 = schedule[word - 2]!
      const sigma0 =
        rotateRight(previous15, 7) ^
        rotateRight(previous15, 18) ^
        (previous15 >>> 3)
      const sigma1 =
        rotateRight(previous2, 17) ^
        rotateRight(previous2, 19) ^
        (previous2 >>> 10)
      schedule[word] =
        (schedule[word - 16]! +
          sigma0 +
          schedule[word - 7]! +
          sigma1) >>>
        0
    }

    let a = state[0]!
    let b = state[1]!
    let c = state[2]!
    let d = state[3]!
    let e = state[4]!
    let f = state[5]!
    let g = state[6]!
    let h = state[7]!

    for (let round = 0; round < 64; round += 1) {
      const bigSigma1 =
        rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 =
        (h +
          bigSigma1 +
          choice +
          ROUND_CONSTANTS[round]! +
          schedule[round]!) >>>
        0
      const bigSigma0 =
        rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (bigSigma0 + majority) >>> 0

      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }

    state[0] = (state[0]! + a) >>> 0
    state[1] = (state[1]! + b) >>> 0
    state[2] = (state[2]! + c) >>> 0
    state[3] = (state[3]! + d) >>> 0
    state[4] = (state[4]! + e) >>> 0
    state[5] = (state[5]! + f) >>> 0
    state[6] = (state[6]! + g) >>> 0
    state[7] = (state[7]! + h) >>> 0
  }

  const digest = new Uint8Array(DIGEST_BYTES)
  const digestView = new DataView(digest.buffer)
  for (let word = 0; word < state.length; word += 1) {
    digestView.setUint32(word * 4, state[word]!, false)
  }
  return digest
}

/** RFC 2104 HMAC using the synchronous SHA-256 implementation above. */
export function hmacSha256(
  key: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  const normalizedKey = key.length > BLOCK_BYTES ? sha256(key) : key
  const innerPad = new Uint8Array(BLOCK_BYTES)
  const outerPad = new Uint8Array(BLOCK_BYTES)

  for (let index = 0; index < BLOCK_BYTES; index += 1) {
    const byte = normalizedKey[index] ?? 0
    innerPad[index] = byte ^ 0x36
    outerPad[index] = byte ^ 0x5c
  }

  return sha256(concatenate(outerPad, sha256(concatenate(innerPad, message))))
}

/** Browser- and Node-identical synchronous hashing for commit-reveal dice. */
export const portableHashFunctions: HashFunctions = {
  sha256,
  hmacSha256,
}
