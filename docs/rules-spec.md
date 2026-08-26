# Rules specification

What `packages/engine` implements. Read `AGENTS.md` §5 for the board
representation first — this document assumes it.

## Standard game

- 15 checkers each, standard starting position (`24/2, 13/5, 8/3, 6/5` in
  on-roll coordinates).
- Opening roll: both players roll one die; higher plays that combination. Ties
  re-roll. (Automatic doubles on a tie are **off** by default, configurable.)
- A roll of doubles plays four moves of that number.

### Legal move generation

The rules that are easy to get wrong, and which every one of these gets a test:

1. **A player must use as many dice as legally possible.** Generate the complete
   set of move sequences and keep only those of maximal length.
2. **If exactly one die can be played, the larger must be played** when either
   would be legal alone.
3. **Checkers on the bar must enter first.** No other move is legal while
   `pts[25] > 0`.
4. **A point held by two or more opposing checkers is blocked.** A point with
   exactly one is a blot and may be hit — the blot goes to the bar.
5. **Bearing off requires all fifteen checkers in the home board** (points 1–6).
6. **Bearing off with a larger die than needed** is legal only when no checker
   sits on a higher point than the one being borne off.
7. Re-entering after a hit resets bear-off eligibility; this falls out of (3)
   and (5) automatically and needs no special case.

Implementation: depth-first over dice permutations, collecting terminal
sequences, then filter by maximal length and the larger-die rule. Deduplicate by
resulting position — `13/7 8/7` and `8/7 13/7` are the same move and must be
offered once.

### Ending

- **Single** — opponent has borne off at least one checker.
- **Gammon (مارس)** — opponent has borne off none. Doubles the stake.
- **Backgammon** — opponent has borne off none *and* still has a checker in the
  winner's home board or on the bar. Triples the stake.

## Doubling cube

- Starts centred at 1, owned by neither player.
- A player on roll, before rolling, may double. The opponent takes (cube moves to
  them at 2×) or passes (loses the current stake).
- Only the cube owner may double thereafter.
- Maximum 64 in the UI; the engine does not cap.

### Match play

- Matches are to an odd number of points (default 7). Configurable 1/3/5/7/11.
- **Crawford rule** on by default: the game after either player reaches
  match-point-minus-one is played without the cube. Exactly one Crawford game
  per match.
- **Post-Crawford**: cube is live again; automatic doubles never apply.
- **Jacoby rule** applies to money play only (gammons and backgammons count as
  single unless the cube has been turned). Off in match play.
- **Beavers** and **raccoons**: money play only, off by default.

Match equity comes from gnubg's MET; the engine does not embed its own table.

## Position and match identifiers

The engine implements GNU Backgammon's `Position ID` (14 chars, base64 of a
77-bit key) and `Match ID` (12 chars) formats, and round-trips them.

This is not optional polish. It is how we talk to gnubg, how positions are
imported from books and other programs, and how a position gets shared.
Round-tripping against known-good IDs is a required test.

## Variants

Scheduled at M5, behind a variant selector. The engine exposes rule hooks rather
than branching inside move generation.

| Variant | Difference |
| --- | --- |
| **Nackgammon** | Different start: two checkers on the 23- and 24-points |
| **Hypergammon** | Three checkers each, on the 24-, 23- and 22-points |
| **Mahbooseh / Plakoto** | Checkers are pinned rather than hit; no bar |
| **Gul Bara / Fevga** | No hitting at all; both players move the same direction |

Mahbooseh and Gul Bara are the two he is most likely to have grown up with, and
should be prioritised over Nackgammon if effort has to be cut.

## Determinism

Given a seed and a list of decisions, replaying a match must produce a
bit-identical result. The engine takes a `DiceSource`; it never calls
`Math.random()`. See `dice-fairness.md`.
