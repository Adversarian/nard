# Analysis specification

The feature he doesn't know he wants yet. Everything here is computed from a
saved match `{seed, commitment, decisions}` by replaying it against the
evaluator, so it works retroactively on every game ever played.

## Per-decision output

For each checker play and each cube decision:

| Quantity | Definition |
| --- | --- |
| **equity** | cubeful equity of the move played |
| **best** | the highest-equity legal move |
| **error** | `equity(played) − equity(best)` — always ≤ 0 |
| **luck** | `equity(position after roll) − mean equity over all 21 rolls` |

Errors are classified by magnitude, using the conventional thresholds so the
numbers mean the same thing they mean everywhere else in backgammon:

| Band | Error |
| --- | --- |
| Good | `> −0.020` |
| Doubtful | `−0.020` to `−0.040` |
| Error | `−0.040` to `−0.080` |
| **Blunder** | `< −0.080` |

## Performance rating (PR)

The headline number. Mean equity loss per decision, scaled by 500 so it lands on
the familiar scale where world class is ~2 and a strong club player is ~7.

```
PR = 500 × (total equity lost) / (number of non-forced decisions)
```

Forced moves (one legal option) are excluded — they are not decisions and
including them deflates the rating.

PR is reported per game, per match, and as a rolling figure over the last 20
matches. **The rolling chart is the retention feature**: a number that goes down
over months is the reason to keep playing.

Checker-play PR and cube PR are reported separately. They are different skills
and improve at different rates.

## Error attribution

Blunders are tagged so patterns surface:

- **Phase** — opening / middle game / bear-in / bear-off / race
- **Theme** — hitting, priming, anchoring, safety vs. boldness, cube timing,
  bear-off technique
- **Direction** — too passive or too aggressive, from the sign of the style
  features (`ai-spec.md`) of the played move vs. the best one

This produces the sentence that makes the feature worth having: *"Across your
last 20 matches, your most expensive habit is playing too safe when behind in
the race — 34 occurrences, 2.1 PR."*

## Match review

After a match: a move list with an equity band per decision, a luck-vs-skill
summary, and the blunder list. Clicking a blunder loads the position with the
played move and the best move side by side, showing both resulting positions and
the equity gap.

The review must load instantly. Analysis runs in a worker as the match plays,
not on demand at the end.

## Drills

Blunders become drill positions in `drills.json`, scheduled by spaced
repetition (SM-2 is sufficient; do not build something cleverer). A drill shows
the position and the roll, he plays a move, and it is scored against the
evaluator immediately.

Drawn from his *own* games. Generic puzzle packs are not interesting to someone
at his level.

## Honesty rules

- The evaluator's verdict is reported with its search depth. A 0-ply "best move"
  presented as truth will eventually be wrong in a position he understands
  better than the bot, and that costs the feature its credibility.
- Where a decision is close (`|error| < 0.005`), say "equivalent", not "error".
- Rollout on demand for positions he disputes, and show the confidence interval.
  If he thinks the bot is wrong, he should be able to make it think harder.
