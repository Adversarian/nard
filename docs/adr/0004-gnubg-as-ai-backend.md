# ADR 0004 — GNU Backgammon is the AI and analysis backend

**Status:** accepted · 2026-08-26 (supersedes an earlier draft that used gnubg
only as a development-time oracle)

## Context

The opponent must satisfy an expert player, and the analysis feature must
produce verdicts he will trust. Training our own network to that standard is a
multi-month effort with an uncertain outcome; a mediocre net producing confident
"best move" claims is worse than no analysis at all.

gnubg was initially scoped as a dev-only oracle over licence concerns. On
inspection those concerns do not apply: the app is not being publicly
distributed, and even if it were, invoking a program as a separate process over
a text protocol is aggregation, not linking.

## Decision

Ship gnubg as a sidecar process. It is the default `Evaluator` and the source of
all analysis numbers.

Verified working (Ubuntu package 1.07.001, unprivileged, no GUI):

```
gnubg -q -t -r -P <datadir> -D <datadir> -p bridge.py
```

with embedded **Python 3.12**. `gnubg.hint()` returns every legal move with
`move`, `equity`, `eqdiff`, and `details.probs`.

## Why

One decision delivers: world-class play, correct cube decisions at match score,
rollouts, equity-loss analysis, PR scoring, and luck/skill decomposition.

It also makes *weakness* believable, which was the hardest open problem.
Difficulty becomes "sample from the ranked candidate list weighted by `eqdiff`"
— a weak setting plays the genuine third-best move, not a random blunder.

## Consequences

- **Licence discipline.** gnubg is GPL-3.0. It is invoked as a separate process.
  Never link, vendor, or copy its source into `packages/`. This repo stays MIT.
- **Packaging.** A per-platform binary must be bundled as a Tauri sidecar (M4).
- **Process supervision.** The bridge must survive crashes, restart cleanly, and
  the UI must degrade to `NetEvaluator` rather than break if the sidecar dies.
- **Bearoff database — unresolved.** The distro package omits the two-sided
  bearoff database. Generating it works (`makebearoff -t 6x6 -f gnubg_ts0.bd`
  produces a valid 6.8 MB file, header `gnubg-TS-06-06-1`, 853,776 entries), but
  gnubg 1.07.001 still reports it "could not be found" with the file present in
  `share/gnubg`, in `lib/gnubg`, and in the working directory, whether or not
  `-P`/`-D` point at it. The one-sided database appears to be found by a path we
  are not controlling either. Time-boxed and parked: bearoff play falls back to
  the one-sided database and the neural net, which is good but not gnubg's
  ceiling — and bearoff technique is precisely what a strong player scrutinises.
  Worth an hour with the gnubg source before M4, not before.
- Our own `NetEvaluator` is no longer critical path. It stays in scope as a
  fallback and as a possible future source of a more human-feeling ladder.
