import { createHash, createHmac } from 'node:crypto'

import type { HashFunctions } from './dice.js'

/**
 * Node adapter for the synchronous hash seam used by CommitRevealDiceSource.
 * It deliberately exposes hashing only; seed generation remains a host concern.
 */
export const nodeCryptoHashFunctions: HashFunctions = {
  sha256(message) {
    return new Uint8Array(createHash('sha256').update(message).digest())
  },
  hmacSha256(key, message) {
    return new Uint8Array(createHmac('sha256', key).update(message).digest())
  },
}
