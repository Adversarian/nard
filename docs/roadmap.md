# Roadmap

Milestones in order. Each has an exit criterion that can be checked, not a
feeling of doneness. Do not start a milestone before the previous one exits.

## M0 — Foundations ✅

Repo, workspace, durable docs, ADRs, shared type contract, screenshot harness.

## M1 — A board you can play on

Engine: full rules, legal move generation, hitting, bearing off, game end.
UI: the board renders, checkers move, dice roll, a complete game is playable
against a random-mover.

**Exit:** a human can play a full game to completion, and `difftest` shows zero
move-generation disagreements with gnubg over 10,000 random positions.

## M2 — A real opponent

gnubg sidecar and bridge, `Evaluator` interface, the six-rung difficulty ladder,
and the reusable personality policies. Portraits, named ladder presentation and
progression remain in M6.

**Exit:** `pnpm selfplay` reports monotonically improving PR across rungs 1→6,
and rung 6 plays gnubg-strength.

## M3 — The cube and match play

Doubling cube, match play to N, Crawford, cube decisions from the evaluator.

**Exit:** a 7-point match completes correctly, Crawford fires exactly once, and
cube decisions at score match gnubg's.

## M4 — It looks and ships like a real thing

Full visual treatment per `design-language.md`, all three themes, Persian/RTL,
motion, and **sound** (`sound-spec.md`). Tauri shell, gnubg sidecar packaged,
bearoff DB generated.

**Exit:** it installs and runs on the target machine with no toolchain present,
every scene in the gallery looks right in all three themes and both languages,
`pnpm motion` reports every interaction in spec, and `pnpm sound` reports every
event firing once, at contact, with sample variation.

## M5 — Analysis

Per-decision equity loss, PR scoring and history, luck/skill split, blunder
review, drills. Dice verification UI.

**Exit:** playing a match then opening Review shows correct per-move errors, a
PR consistent with gnubg's own analysis of the same match, and a verifiable seed.

## M6 — Ladder presentation, progression, variants

The six named opponents, portraits, progression and head-to-head records using
the M2 personality policies. Mahbooseh and Gul Bara variants. Asynchronous play
with his son.

**Exit:** he beats the ladder, and tells someone about it.

## Deliberately last

Variants and the ladder come after analysis because analysis is the thing that
makes him come back, and everything before M5 is table stakes. If the project
stalls, it should stall having shipped M1–M5, not having shipped a beautiful
board with six personalities and nothing to learn from.
