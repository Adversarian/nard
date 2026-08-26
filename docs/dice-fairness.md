# Dice fairness

Every backgammon player believes the computer cheats. This is not a bug to
explain away — it is a design constraint. The goal is not to *assert* fairness
but to make it checkable, once, after which he stops wondering.

## The protocol

Commit–reveal. Before a match begins:

1. Generate a 32-byte random `seed` (from the OS CSPRNG).
2. Compute `commitment = SHA-256(seed)` and show it to the player.
3. Play the entire match. Roll `n` is derived deterministically:

   ```
   stream = HMAC-SHA256(key = seed, message = "roll:" || n)
   ```

   with rejection sampling to avoid modulo bias on 1–6.
4. On match end, reveal `seed`. The player (or the built-in verifier) checks
   `SHA-256(seed) == commitment` and replays every roll.

Because the commitment is published **before the first roll** and every roll is
a pure function of `(seed, n)`, the program provably cannot have chosen a roll
based on the position. That is the whole claim, and it is verifiable without
trusting us.

## What this requires of the engine

The engine takes a `DiceSource` and never calls `Math.random()`. A saved match
is `{ seed, commitment, decisions }` — a few kilobytes that replays exactly.
This is also what makes analysis and the drill mode possible, so the fairness
guarantee and the analysis feature are the same piece of architecture.

## In the interface

- The commitment is shown discreetly in the match header, truncated, expandable.
- At match end: **"Dice verified ✓"** with the seed, the commitment, and a
  "Verify" button that re-derives all rolls in front of him.
- An **export** writes `{seed, commitment, rolls}` to a file so he can check it
  with any SHA-256 tool, not just ours. This matters: verification the app does
  itself proves nothing to a sceptic.

## The luck meter

Separately from fairness, the analysis engine reports **luck** per roll — the
equity swing between the roll he got and the average over all 21 rolls in that
position (`analysis-spec.md`).

This is what actually settles the argument, because it answers the real
question. "You lost by 3 points; you were −0.42 in luck and outplayed your
opponent by 1.8 PR" is a satisfying answer to a bad session. Cumulative luck is
shown per game and per match.

## Deliberately not doing

- **No "fair dice" toggle.** Offering one implies the other setting exists.
- **No dice manipulation at any difficulty.** Difficulty comes from move
  selection (`ai-spec.md`), never from the dice. If this is ever violated the
  fairness guarantee is a lie and the feature is worse than useless.
