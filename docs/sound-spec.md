# Sound

Sound is not decoration here. Backgammon has a *sound* — the clack of a checker
onto a wooden point, dice tumbling in a leather cup — and a player who has heard
it his whole life will notice its absence before he notices anything we got
right. It is part of the "looks good" condition.

## Principles

- **Sourced from CC0 libraries, not synthesised and not recorded.** Synthesised
  impacts do not survive being heard sixty times a game. The assets are in
  `apps/ui/src/assets/sound/`, with every file's origin in `PROVENANCE.md`
  alongside them.
- **CC0 only.** This repository is MIT and public. CC-BY drags an attribution
  obligation into a shipped binary; CC-BY-NC is outright incompatible. If a
  sound is not CC0, it does not go in — no exceptions, however good it sounds.
- **Variation, or it becomes a rattle.** Every repeated sound has 4–6 samples
  chosen at random, with ±8% pitch and ±2dB gain jitter. A single checker sample
  played identically 60 times a game is worse than silence.
- **Sound follows the event, not the animation frame.** The checker click fires
  on *contact* — the end of the travel spring, not the start of the sequence.
- **Silent when the window is not focused.** Always.
- **One volume control**, defaulting to on. No per-category mixer; that is a
  settings screen nobody wants.

## The set

| Event | Character |
| --- | --- |
| Checker placed | Short wooden click. The core sound; gets the most variants. |
| Checker hit | Click plus a slightly sharper knock — a checker being displaced. |
| Checker to bar | Duller, no point resonance. |
| Borne off | Softer, checker onto a stack of checkers rather than onto wood. |
| Dice thrown | Tumble and settle, ~380ms, matched to the dice animation. |
| Doubling cube turned | Heavier, single, weighty. Rare, so it can be distinctive. |
| Game won | One restrained note. Not a fanfare — see AGENTS.md §10. |

Nothing else makes a sound. No hovers, no clicks on buttons, no menu sounds.

## Implementation

Web Audio, one `AudioContext`, samples decoded once at startup and held in
memory (they are a few hundred KB in total). Not `<audio>` elements — the
latency is unacceptable and overlapping playback is unreliable.

The audio layer sits behind a small `Sound` interface in `apps/ui/src/sound/`
with a single `play(event, opts?)` entry point. Components emit *events*, they
do not reach for samples.

Assets live in `apps/ui/src/assets/sound/` as Ogg Vorbis, roughly 5–15KB each,
23 files totalling ~200KB. `manifest.ts` maps events to variants by filename
convention (`place-0.ogg`, `place-1.ogg`, …), so adding a variant is dropping in
a file.

### What is in there, and why

| Event | Variants | Material |
| --- | --- | --- |
| Checker placed | 5 | wood impact — the board is wood, and this is the sound heard most |
| Checker hit | 4 | disc on disc |
| Checker to bar | 4 | duller wood, no point resonance |
| Borne off | 4 | onto a stack of checkers, not onto the board |
| Dice thrown | 3 | |
| Cube turned | 2 | heavier wood; rare, so it can be distinctive |
| Game won | 1 | |

Hits and bear-offs use chip samples rather than wood ones on purpose: a checker
landing on a stack of checkers does not sound like a checker landing on a point,
and the physics matters more than the material here.

## How this gets verified without hearing it

The same approach as motion (`docs/playtesting.md`): do not claim a perceptual
property you have not observed — measure a structural one instead.

`pnpm sound` drives the game through scripted interactions with the audio layer
instrumented, and reports a log of `(t, event, sample, gain, pitch)`. That
verifies the things that are actually verifiable:

- the checker click fires at **contact**, not at pick-up — i.e. its timestamp
  matches the measured travel settle time from `pnpm motion`, not the start
- consecutive repeats of the same event use **different samples**
- nothing plays while the window is blurred
- no event fires twice for one logical action
- every event in the table above has samples registered, and none are missing

What it cannot verify is whether the checker *sounds like wood*. That is a human
judgement, and the PR should say so rather than implying it was checked.

## Scheduling

Sound lands at **M4**, with the rest of the sensory layer. It is deliberately
not earlier: sounds tuned against placeholder animation timings have to be
retimed once the animation is final.
