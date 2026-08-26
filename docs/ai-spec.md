# AI specification

## The interface

`packages/ai` exposes exactly one abstraction. Nothing outside the package knows
which backend is running.

```ts
interface Evaluator {
  /** Every legal move, ranked best-first, with equity and equity loss. */
  rankMoves(pos: Position, dice: Dice, opts?: EvalOpts): Promise<RankedMove[]>
  /** Double / take / pass, with equities for each. */
  cubeDecision(pos: Position, cube: CubeState, opts?: EvalOpts): Promise<CubeAnalysis>
  /** Release the backend process or other resources. */
  dispose(): Promise<void>
}

interface RankedMove {
  move: Move
  equity: number      // cubeful
  eqdiff: number      // <= 0, equity lost vs. the best move
  probs: Probs        // [win, winG, winBG, loseG, loseBG]
}
```

`EvalOpts.context` optionally carries `{cube, match, onRoll}`. Gameplay callers
may omit it and retain the previous money-play behaviour. Analysis supplies it:
the bridge applies the resulting GNU Match ID for checker hints and passes the
score, Crawford/Jacoby state and cube owner to `cfevaluate`. Without this
context, a cubeful equity at match score is not the equity of the recorded
decision.

Consumers obtain this abstraction through `createEvaluator()`. Backend classes,
process options and fallback implementation details are not exported from the
package entrypoint.

Backends:

- **`GnubgEvaluator`** — default. Long-lived `gnubg -q -t -r -p bridge.py`
  child process, JSON over stdio. See `adr/0004`.
- **`NetEvaluator`** — fallback. Pure TypeScript, deterministic fixed-weight
  evaluation. The M2 weights are deliberately modest bootstrap weights, not a
  claim of gnubg-level strength; a later TD-trained weights blob can replace
  them without changing the interface.

The bridge must be supervised: restart on crash, time out individual requests,
and fall back to `NetEvaluator` rather than hanging the UI. A dead sidecar
degrades the opponent; it must never freeze the game.

The stdio protocol is one JSON object per line. Requests carry an integer `id`,
a `method` (`rank_moves` or `cube_decision`) and method parameters. Responses
echo the `id` and contain either `{ok: true, result}` or
`{ok: false, error}`. Requests are serialised because gnubg's Python API mutates
one global board. A failed or timed-out request is not retried invisibly: it
falls back immediately, the child is discarded, and the following request
starts a fresh child.

For checker play, the bridge sets gnubg's move filters to keep every legal move
at the requested ply. Mixed-depth candidate lists are not valid input to the
difficulty sampler. Calls without `EvalOpts.context` use money play with Jacoby
off; match analysis always supplies context.

GNU Backgammon 1.07.001's embedded Python `hint()` reports checker plays but
raises for cube actions. Cube decisions therefore use the supported
`cfevaluate()` API, whose output contains the optimal, no-double, double/take
and double/pass equities plus the recommendation. `cubeDecision` is called only
when the cube is centred or owned by the player represented by `pos`; absolute
player identity is intentionally outside the perspective-relative evaluator
boundary.

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

| Rung | Plies | measured τ | Measured checker PR | Cube competence | Feels like |
| --- | --- | ---: | ---: | --- | --- |
| 1 — تازه‌کار | 0 | 0.150 | 15.46 | ignores cube | knows the rules |
| 2 — مبتدی | 0 | 0.080 | 12.31 | doubles late, takes too much | casual player |
| 3 — باشگاهی | 1 | 0.065 | 9.94 | roughly right | decent club player |
| 4 — قوی | 1 | 0.040 | 6.69 | good | strong club player |
| 5 — استاد | 2 | 0.022 | 2.81 | very good | tournament player |
| 6 — بی‌رحم | 2 | 0.000 | 0.00 | optimal | gnubg at full strength |

Cube competence is a separate axis because it is where weaker humans are
*actually* weak. A rung-2 bot that plays checkers sloppily but doubles perfectly
would feel wrong.

Calibration is empirical, not theoretical: `pnpm selfplay` plays two games for
each rung against rung 6, alternating the challenger's colour. Every
non-forced position enters one shared corpus. The harness evaluates that
position once at 0, 1 and 2 ply, then computes each rung's expected equity loss
from its sampling weights. Scoring every rung on the same positions removes
dice and game-path noise from the comparison while the corpus itself still
comes from the actual policies playing complete games.

The table is the 2026-08-26 measurement with seed `0x4e415244`: 12 games and
523 shared non-forced decisions. PR is relative to the same 2-ply gnubg
reference, so rung 6 is `0.00` by construction rather than an assertion that a
2-ply player has zero rollout PR. The initial τ values were
`[0.140, 0.090, 0.055, 0.030, 0.012, 0.000]`; calibration changed them to
`[0.150, 0.080, 0.065, 0.040, 0.022, 0.000]`. The measured adjacent gaps are
`3.15`, `2.37`, `3.25`, `3.88`, and `2.81` PR.

Cube errors use the same principle as checker errors: tolerate close decisions,
do not manufacture arbitrary ones. Rung 1 never offers and always takes. For
rungs 2–6, the tolerated equity gap is respectively `0.18`, `0.09`, `0.045`,
`0.015`, and `0.000`. A bot delays a double while the gain is within its
tolerance and takes while taking is within that tolerance of passing.

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

Feature definitions are perspective-relative and deterministic:

- `primeLength` is the longest consecutive run of made points, capped at six.
- `blotExposure` sums, per blot, the fraction of the 36 ordered next rolls for
  which the opponent has at least one legal move that hits it.
- `trapped` is the largest number of opposing checkers behind any consecutive
  blockade of at least two made points.
- `raceLead` is opponent pips minus our pips, so positive means we are ahead.
- `anchor` uses the opponent's home-board numbering: our 24-point anchor is 1,
  our 19-point anchor is 6, and no anchor is 0.

| Personality | Bias |
| --- | --- |
| **The Blitzer** | + gammon probability, + opponent-on-bar, + home points made, − blot penalty (accepts risk) |
| **The Priming Player** | + prime length, + checkers trapped, − race lead (happy to fall behind) |
| **The Racer** | + race lead, + safe distribution, − contact |
| **The Anchor** | + advanced anchor held, + opponent blots kept in range, − prime length |
| **The Purist** | all `θ = 0` — pure equity, no style |

The exact M2 coefficients below are in equity units. They are intentionally
small: personality breaks close calls rather than overruling play quality.
The earlier prose descriptions mentioned contact and opponent blots in range,
but `styleFeatures()` does not expose those as independent values. M2 therefore
uses the available deterministic proxies shown in the coefficient table rather
than inventing another board-feature implementation inside `packages/ai`.

| Personality | `gammon` | `primeLength` | `blots` | `blotExposure` | `trapped` | `raceLead` | `anchor` | `homePoints` | `oppOnBar` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Blitzer | +0.050 | 0 | 0 | +0.008 | 0 | 0 | 0 | +0.008 | +0.012 |
| Priming Player | 0 | +0.012 | 0 | 0 | +0.006 | −0.0004 | 0 | 0 | 0 |
| Racer | 0 | 0 | −0.004 | −0.012 | −0.004 | +0.0008 | −0.004 | 0 | −0.006 |
| Anchor | 0 | −0.006 | 0 | 0 | 0 | −0.0003 | +0.014 | 0 | 0 |
| Purist | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

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

Portraits are generated with `gpt-image-2` in a
consistent illustrated style and committed under
`apps/ui/src/assets/portraits/`.

## Not in scope

- Learning from the player's games at runtime. Interesting, and an enormous
  amount of machinery for a benefit we cannot demonstrate. Revisit only if he
  asks for it.
- Opening books. gnubg already plays openings correctly.
- Difficulty that adapts silently mid-match. If the opponent changes strength,
  the player must have chosen it.


## Verified behaviour, and what the numbers do not say

Checked independently after implementation, not taken on trust:

- **Rung 6 plays all eight opening rolls to book** (`8/5 6/5` on 31, `13/7 8/7`
  on 61, `24/18 18/13` on 65, and so on). This — not the PR table — is the real
  evidence that the opponent is strong.
- **Difficulty produces genuinely different play.** On a middle-game position
  with close alternatives, rung 1 played nine distinct moves and chose the best
  only 20% of the time; rung 3 chose it 39%; rung 6 always. Every choice stayed
  inside the safety clamp, so weak play is plausible play rather than blunder.
- **Killing gnubg mid-game degrades rather than hangs.** The request in flight
  falls back, `onBackendError` fires with a clear message, and the next request
  restarts the child.
- **Cube decisions are sound.** A won position returns `too-good`/`pass`; the
  opening correctly declines to double, because doubling there surrenders cube
  ownership for nothing.

Two caveats on the calibration table:

1. **Rung 6's PR of 0.00 is tautological.** PR is measured as expected equity
   loss against a 2-ply gnubg reference, and rung 6 always takes that
   reference's top move. It says the rung agrees with the yardstick, not that
   the yardstick is world class. Absolute strength would need rollouts.
2. **523 decisions over 12 games is a modest sample.** The *spacing* between
   rungs is the useful output; individual PR figures carry real noise. Re-run
   with a larger corpus before quoting them as fact.

## Open: the fallback is silent

If the gnubg sidecar dies, play continues on the fixed-weight fallback, which is
deliberately modest — it picked `13/7 7/6` on an opening 61 where gnubg plays
`13/7 8/7`. Correct behaviour, but from the other side of the board it looks
like the opponent suddenly started playing badly, and an expert will notice.

The game must not stop, but it must not lie either. The UI needs a quiet,
non-modal indicator that the strong engine is unavailable — and analysis
produced while degraded has to be marked, or it will be wrong in exactly the
positions he disputes. Scheduled with the rest of the sensory/UI work at M4.
