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
| **luck** | `best-play equity(position after roll) − expected equity over all rolls` |

The 21 unique rolls are probability weighted: doubles have weight 1 and
non-doubles weight 2, for 36 total outcomes. Opening rolls are the 30 ordered
non-ties because the dice belong to different players. Luck is attached to the
roll event and to its following checker decision; cube decisions have
`luck: null`. A roll with no legal play still contributes to match luck even
though it creates no checker decision.

Errors are classified by magnitude, using the conventional thresholds so the
numbers mean the same thing they mean everywhere else in backgammon:

| Band | Error |
| --- | --- |
| Good | `> −0.020` |
| Doubtful | `≤ −0.020` and `> −0.040` |
| Error | `≤ −0.040` and `> −0.080` |
| **Blunder** | `≤ −0.080` |

## Performance rating (PR)

The headline number. Mean equity loss per decision in **milli-EMG**, the scale
GNU Backgammon and Extreme Gammon both report, so a figure here means what it
means everywhere else in backgammon — world class about 2-3, a strong club
player around 7.

```
PR = 1000 × (total equity lost) / (number of non-forced decisions)
```

An earlier draft of this document said 500 while also claiming world class is
~2. Those are inconsistent by a factor of two, and the implementation faithfully
reproduced the error. Caught by exporting a match to GNU Backgammon and
comparing: our total equity lost matched its `Error total EMG` exactly, while
our PR came out at half its `Error rate mEMG`. **The equity was right and only
the scale was wrong**, which is precisely the kind of mistake that survives
unit tests and gets caught by checking against something external.

Forced moves (one legal option) are excluded — they are not decisions and
including them deflates the rating.

PR is reported per player, per game, per match, and as a rolling figure over
the last 20 matches. Rolling PR aggregates equity loss and decision counts; it
does not average already-rounded PR figures. **The rolling chart is the
retention feature**: a number that goes down over months is the reason to keep
playing.

Checker-play PR and cube PR are reported separately. They are different skills
and improve at different rates.

For cube PR, the conventional GNU denominator is used: every actual
double/take/pass, plus no-double decisions where the relevant equities are
within `0.16` or the position is too good. All cube errors still contribute to
equity lost. Counting every trivial no-double would make cube PR look better
merely because a match had more quiet pre-roll positions.

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

The equity error is evaluator output; the labels are deterministic heuristics,
not additional evaluator claims:

- the first six checker plays are `opening`;
- `bear-off` starts after the first checker is borne off, `bear-in` when all
  checkers are home, and `race` when the sides have no contact;
- theme chooses the largest relevant difference in hits, prime length, anchor
  or blot exposure, with cube and bear-off special cases;
- direction compares a documented risk score built from the existing style
  features. If played and best have the same score, direction is `unclear`
  rather than fabricating certainty.

## Match review

After a match: a move list with an equity band per decision, a luck-vs-skill
summary, and the blunder list. Clicking a blunder loads the position with the
played move and the best move side by side, showing both resulting positions and
the equity gap.

The review must load instantly. Analysis runs in a worker as the match plays,
not on demand at the end. The analysis package has no top-level effects and
reports logical work units through `onProgress`; it never logs.

## Drills

Blunders become drill positions in `drills.json`, scheduled by spaced
repetition (SM-2 is sufficient; do not build something cleverer). A drill shows
the position and the roll, he plays a move, and it is scored against the
evaluator immediately.

Drawn from his *own* games. Generic puzzle packs are not interesting to someone
at his level.

`drills.json` stores source match/decision IDs, position and Match IDs, dice,
played/best resulting Position IDs, attribution, and the conventional SM-2
fields: repetitions, interval in days, ease factor, due time and last review
time. Reviews use qualities 0–5, intervals 1 then 6 days, and the standard 1.3
ease-factor floor.

## Saved match v1

The durable input is:

```ts
{
  v: 1,
  seed: string,        // 32-byte lower-case hex
  commitment: string,  // SHA-256(seed), lower-case hex
  decisions: (
    | {kind: 'roll'}
    | {kind: 'move', positionId: string}
    | {kind: 'pass-turn'}
    | {kind: 'double' | 'take' | 'drop' | 'next-game'}
  )[],
  meta: {
    startedAt: string,
    completedAt?: string,
    match: {length, score, crawfordUsed, jacoby},
    rules: {variant: 'standard', automaticDoubles},
    players?: {light?: {name}, dark?: {name}}
  }
}
```

Recording stores every engine transition, including forced transitions, because
`replayTo(index)` means exactly "state after transition index". Analysis later
decides which transitions count as decisions. Unknown additive fields are
preserved by load/save so a v1 file is not damaged by a newer reader.

## Honesty rules

- The evaluator's verdict is reported with its search depth. A 0-ply "best move"
  presented as truth will eventually be wrong in a position he understands
  better than the bot, and that costs the feature its credibility.
- Where a decision is close (`|error| < 0.005`), say "equivalent", not "error".
- Rollout on demand for positions he disputes, and show the confidence interval.
  If he thinks the bot is wrong, he should be able to make it think harder.

The current `Evaluator` supports deterministic evaluation through 2-ply, not
rollouts or confidence intervals. The analysis result keeps exact Position and
Match IDs so a future rollout method can address the disputed decision without
changing the saved-match format; rollout execution is not represented as
implemented until the evaluator exposes it.


## Verified against GNU Backgammon

The whole point of PR is that it means the same thing here as it does anywhere
else, so it is checked against gnubg rather than against our own expectations.
`pnpm analyse <match> --export-mat=<file>` writes a match gnubg can import; run
`analyse match` and `show statistics match` there and compare.

On the fixture in `packages/analysis/test/fixtures/gnubg-comparison-v1.json`, at
identical 2-ply settings:

| | nard | gnubg |
| --- | ---: | ---: |
| Light, error total EMG | 5.1939 | 5.194 |
| Dark, error total EMG | 5.5928 | 5.593 |
| Light, error rate | 185.49 | 185.5 |
| Dark, error rate | 199.74 | 199.7 |

**Redo this comparison after any change to the analysis engine.** It is the only
check that catches an error the unit tests agree with.

## Known discrepancy: luck totals

Skill matches exactly; **luck does not**.

| | nard | gnubg |
| --- | ---: | ---: |
| Light | −1.2751 | −1.191 |
| Dark | −0.0465 | −0.328 |

Light is about 7% out and Dark is out by a factor of seven, though both are
small in absolute terms. This has not been tuned away.

**Ruled out:** evaluation depth. Forcing gnubg's luck analysis to 2 ply, to match
ours, produces identical figures to its default — so the two are not simply
looking at different depths.

**Most likely remaining cause**, untested: we compute the mean explicitly, by
evaluating the best play for each of the 21 distinct rolls and weighting by
probability. gnubg appears to take the pre-roll position's equity directly.
Those are the same quantity in theory — a pre-roll equity *is* the expectation
over rolls — but a neural network is not self-consistent, so its direct
evaluation of a position will not exactly equal the average of its evaluations
of that position's 21 successors. If so our figure is arguably the more correct
one, and the way to confirm it is to compute both and see which our own
evaluator's pre-roll equity agrees with.

**Consequence, and it is not cosmetic.** Luck is what backs the reassurance in
`dice-fairness.md` — "you were −0.4 in luck and outplayed him" is only worth
saying if the number is right. Until this is resolved the UI must not present
luck as an authoritative figure, and any screen that shows it says it is
approximate. Skill, error bands and PR are unaffected and can be shown plainly.
