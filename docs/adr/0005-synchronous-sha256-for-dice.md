# ADR 0005 — Ship synchronous SHA-256 for commit–reveal dice

**Status:** accepted · 2026-08-26

## Context

`DiceSource.roll(n)` is deliberately synchronous and must remain a pure
function of `n`. Node can satisfy the existing `HashFunctions` seam with
`node:crypto`, but browser Web Crypto exposes SHA-256 and HMAC only through
Promises.

Two options were considered:

1. derive rolls asynchronously in batches and serve them from a buffer; or
2. carry a small synchronous SHA-256/HMAC-SHA-256 implementation in the engine.

The first option avoids implementing a cryptographic primitive, but the buffer
becomes another state machine whose readiness, refill and exhaustion have to be
coordinated with match setup. Precomputing an entire match avoids refill state
but requires choosing an arbitrary maximum roll count. Either form weakens the
useful statement that any roll is obtained directly from `(seed, n)`.

## Measurement

Measured on 2026-08-26 with Node 24.11.1, 10,000 rolls from one 32-byte seed.
After two warm-up runs, the table reports the median and range of five runs:

| implementation | median | observed range |
| --- | ---: | ---: |
| dependency-free synchronous TypeScript | 95.96 ms | 74.74–102.73 ms |
| Node `crypto` adapter | 18.32 ms | 17.22–34.55 ms |
| Web Crypto HMAC, all 10,000 Promises submitted together | 85.53 ms | 58.89–106.89 ms |

The Web Crypto number is an API-shape comparison on this development machine,
not a WebView2 benchmark. The relevant result is the scale: the synchronous
implementation derives far more rolls per millisecond than a match can consume,
so batching buys no user-visible performance.

## Decision

Ship a dependency-free synchronous SHA-256 and HMAC-SHA-256 implementation in
`packages/engine`.

`CommitRevealDiceSource` uses it by default. The existing `HashFunctions` seam
remains injectable so Node can use its native adapter and tests can exercise
rejection sampling.

The first HMAC block for roll `n` is exactly:

```text
HMAC-SHA256(seed, "roll:" || n)
```

Bytes 252–255 are rejected. In the vanishingly unlikely event that the first
32-byte block contains fewer than two accepted bytes, subsequent blocks use
`"roll:" || n || ":" || block`, starting at block 1. This makes roll
derivation total without adding mutable state and gives external verifiers an
exact algorithm.

## Why carrying crypto is acceptable here

- This primitive proves deterministic dice derivation; it does not protect
  passwords, authentication tokens or secret application data.
- SHA-256 is compact and fully specified.
- SHA-256 is checked against published digest vectors, and HMAC-SHA-256 against
  RFC 4231 cases including a key longer than the block size.
- The Node adapter remains an independent implementation, so cross-runtime
  equality is cheap to test.

## Consequences

- `roll(n)` remains synchronous, allocation-bounded and a pure function of
  `(seed, n)` in Node, browsers and Tauri WebViews.
- The engine remains dependency-free.
- We own this small primitive and must keep the published-vector tests. Any
  optimisation has to preserve those vectors and the byte-for-byte roll stream.
- Platform code still owns seed generation through its CSPRNG; the engine never
  reaches for entropy.
