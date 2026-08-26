# AI specification

## The interface

`packages/ai` exposes exactly one abstraction. Nothing outside the package knows
which backend is running.

```ts
interface Evaluator {
  /** Every legal move, ranked best-first, with equity and equity loss. */
  rankMoves(pos: Position, dice: Dice, opts?: EvalOpts): Promise<RankedMove[]>
  /** Double / take / pass, with equities for each. */
  cubeDecision(pos: Position, cube: CubeState): Promise<CubeAnalysis>
}

interface RankedMove {
  move: Move
  equity: number      // cubeful
  eqdiff: number      // <= 0, equity lost vs. the best move
  probs: Probs        // [win, winG, winBG, loseG, loseBG]
}
```

Backends:

- **`GnubgEvaluator`** — default. Long-lived `gnubg -q -t -r -p bridge.py`
  child process, JSON over stdio. See `adr/0004`.
- **`NetEvaluator`** — fallback. Small TD-trained net, weights shipped as a
  binary blob, pure TS inference. Used when the sidecar is unavailable.

The bridge must be supervised: restart on crash, time out individual requests,
and fall back to `NetEvaluator` rather than hanging the UI. A dead sidecar
degrades the opponent; it must never freeze the game.

## Difficulty

**Difficulty is never implemented as random blunders.** An expert reads a random
bad move as a broken program, not as an easy opponent.

Instead: evaluate every legal move, then *choose* from the ranked list with a
tolerance for equity loss.

```
weight(move) = exp(eqdiff(move) / τ)        // eqdiff <= 0, so weight <= 1
```

`τ` (tau) is the rung's sloppiness. `τ → 0` always plays the best move; larger
`τ` makes genuinely second- and third-best moves competitive. Every move it
plays is a move some real player would play, which is the whole point.

| Rung | Plies | τ | Cube competence | Feels like |
| --- | --- | --- | --- | --- |
| 1 — تازه‌کار | 0 | 0.140 | ignores cube | knows the rules |
| 2 — مبتدی | 0 | 0.090 | doubles late, takes too much | casual player |
| 3 — باشگاهی | 1 | 0.055 | roughly right | decent club player |
| 4 — قوی | 1 | 0.030 | good | strong club player |
| 5 — استاد | 2 | 0.012 | very good | tournament player |
| 6 — بی‌رحم | 2 | 0.000 | optimal | gnubg at full strength |

Cube competence is a separate axis because it is where weaker humans are
*actually* weak. A rung-2 bot that plays checkers sloppily but doubles perfectly
would feel wrong.

Calibration is empirical, not theoretical: `pnpm selfplay` runs each rung
against rung 6 over enough matches to estimate its PR, and the table above is
adjusted until the rungs are evenly spaced. **The τ values above are initial
guesses and are expected to move.**

## Personalities

A personality re-ranks the candidate list by adding a style bias to each move's
equity, then samples with the rung's τ. Same machinery, different bot.

```
score(move) = equity(move) + Σ θ_k · f_k(position_after_move)
```

Style features `f_k` are computed by `packages/engine` from the resulting
position — prime length, blot count and exposure, opponent checkers trapped
behind our blockade, race lead in pips, advanced anchor held, home board points
made, opponent checkers on the bar.

| Personality | Bias |
| --- | --- |
| **The Blitzer** | + gammon probability, + opponent-on-bar, + home points made, − blot penalty (accepts risk) |
| **The Priming Player** | + prime length, + checkers trapped, − race lead (happy to fall behind) |
| **The Racer** | + race lead, + safe distribution, − contact |
| **The Anchor** | + advanced anchor held, + opponent blots kept in range, − prime length |
| **The Purist** | all `θ = 0` — pure equity, no style |

### The safety clamp

After biasing, discard any move whose true `eqdiff` is worse than `-0.15`
regardless of style score.

This is the guard that keeps personalities *characterful* rather than *bad*. A
priming player who accepts a slightly worse race is interesting; one who throws
the game away to build a prime is a broken opponent. `-0.15` is roughly the
threshold at which a play stops being defensible and starts being a blunder, and
it is a tunable constant with a test asserting no personality exceeds it.

## The ladder

Six opponents, each a (rung, personality) pair with a name, a portrait, and two
lines of character. Beating one unlocks the next. Head-to-head records persist.

Portraits are generated with the `torob-ai-sub-image-generation` skill in a
consistent illustrated style and committed under
`apps/ui/src/assets/portraits/`.

## Not in scope

- Learning from the player's games at runtime. Interesting, and an enormous
  amount of machinery for a benefit we cannot demonstrate. Revisit only if he
  asks for it.
- Opening books. gnubg already plays openings correctly.
- Difficulty that adapts silently mid-match. If the opponent changes strength,
  the player must have chosen it.
