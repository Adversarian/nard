# ADR 0001 — Write our own rules engine

**Status:** accepted · 2026-08-26

## Context

Several JavaScript/TypeScript backgammon libraries exist. The most complete,
`@nodots/backgammon-core`, covers board, moves, dice, cube, GNU position IDs and
PR calculation — close to what we need.

## Decision

Write `packages/engine` ourselves.

## Why

1. **Licence.** `@nodots/backgammon-core` is GPL-3.0. Importing it into this
   MIT repo would relicense the project. Unlike gnubg (a separate process, see
   ADR 0004), a library import is linking.
2. **It is the product, not a utility.** Analysis, replay, the fairness
   guarantee, personalities and variants all reach into the rules layer. A
   third-party engine would be modified within a month.
3. **Purity requirements.** We need injected dice, zero allocation on hot paths,
   and exact replay. These are architectural properties, not features that can
   be added to someone else's engine.
4. **It is a bounded problem.** Backgammon rules are fully specified and
   testable, and gnubg gives us an oracle to differential-test against.

## Consequences

- We own every rules bug. Mitigated by differential-testing move generation
  against gnubg over random positions (`tools/difftest.ts`).
- Reuse still applies everywhere else — see `architecture.md` §Dependencies.
