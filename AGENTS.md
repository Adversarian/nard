# AGENTS.md

Instructions for AI coding agents working in this repository. Read this before
touching anything. `CLAUDE.md` is a symlink to this file — there is one source of
truth, and this is it.

---

## 1. What this is

**nard** (نرد) is a desktop backgammon game with a configurable AI opponent.

It is being built as a gift for one specific person: a genuinely strong,
lifelong backgammon player. That single fact drives almost every decision in
this repo, so internalise it:

- **He will detect a fake opponent within three rolls.** An AI that plays
  random bad moves reads as broken, not as "easy". Weakness must be *coherent*.
- **He will assume the dice cheat.** Every backgammon player does. Fairness has
  to be provable, not asserted.
- **He agreed to play it on the condition that it looks good.** Visual quality
  is a functional requirement, not decoration. A correct game that looks cheap
  has failed.
- **He is not a beginner.** No tutorials, no hand-holding, no confetti, no
  "Great move!" popups. Respect the player.

If a change makes the game more correct but less credible to an expert, it is
not obviously a win. Say so in the PR.

## 2. Golden rules

1. **Specs before code.** Behaviour lives in `docs/`. If you are about to
   implement something not described there, either it belongs in a spec first,
   or you are out of scope. Update the spec in the same PR as the code.
2. **The engine is pure.** `packages/engine` has no I/O, no randomness of its
   own, no clock, no DOM. Dice are injected. This is what makes the game
   testable, replayable, and provably fair. Do not break it.
3. **Do not invent visual design.** `docs/design-language.md` is binding —
   tokens, spacing, motion, colour. If it does not cover your case, extend that
   doc in the same PR rather than freestyling in a component.
4. **Reuse before writing.** Check `docs/architecture.md` §Dependencies for the
   libraries already chosen for a job. Do not add a competing library without an
   ADR.
5. **Licence hygiene.** This repo is MIT. Do not add GPL/AGPL *libraries* to
   anything that ships. `gnubg` is GPL and IS shipped — but as a separate
   process invoked over a text protocol, which is aggregation, not linking. Never
   link, vendor, or copy its source into `packages/`. See
   `docs/adr/0004-gnubg-as-ai-backend.md`.
6. **Never commit on `main`.** Branch, PR, merge.

## 3. Repo map

```
packages/engine      Rules, board, move generation, cube, position IDs.
                     Pure, synchronous, dependency-free. The foundation.
packages/ai          Position evaluation (neural net), search, the difficulty
                     ladder, and playstyle personalities. Depends on engine.
packages/analysis    Equity loss, performance rating (PR), luck/skill
                     decomposition, blunder detection. Depends on engine + ai.
apps/ui              Vite + React app. THE GAME. Runs standalone in a browser
                     during development, and is wrapped by Tauri to ship.
apps/desktop         Tauri v2 shell. Thin. Added at milestone M4.
tools/               Headless harnesses: screenshots, self-play, benchmarks.
docs/                Durable specs. The real source of truth.
docs/adr/            Architecture Decision Records — why things are the way
                     they are. Append-only; supersede, don't rewrite.
```

Dependency direction is strictly one-way:
`engine <- ai <- analysis <- ui`. Never import upward. Never import `ui` from
anything.

## 4. Commands

```bash
pnpm install           # once
pnpm dev               # UI dev server on http://localhost:5173
pnpm test              # vitest, all packages
pnpm typecheck         # tsc -b across the workspace
pnpm check             # typecheck + test — run before every commit
pnpm shots             # capture the board scenes to .shots/ (see §6)
pnpm live              # capture the PLAY view mid-match, with chrome (see §6)
pnpm screens           # capture the ladder, the outcome and the review
pnpm motion            # measure animations against the spec (see §6)
pnpm pointer           # drive the board with REAL mouse events (see §6)
pnpm pacing            # measure how long the opponent's turn takes to watch
pnpm playtest          # play complete games through the real UI
pnpm difftest          # engine move generation vs. gnubg
pnpm selfplay          # headless AI-vs-AI benchmark
```

**`pnpm typecheck` runs `tsc -b --force` on purpose.** Incremental builds can
report a clean tree while a real type error sits in a file they decided not to
rebuild — that happened here, and a broken `main` was merged behind a green
local check. The forced build costs a couple of seconds on a workspace this
size. Do not "optimise" it back.

## 5. Board representation — read this before touching the engine

This is the single most common source of bugs in backgammon code. The engine
uses a **perspective-relative** board: everything is always described from the
point of view of *the player on roll*.

```
pts: Int8Array(26)

  pts[1..24]   signed checker count on each point.
                 positive = player on roll
                 negative = opponent
  pts[25]      player on roll's checkers on the bar (positive)
  pts[0]       opponent's checkers on the bar (negative)
```

- The player on roll **always moves from high points toward low**: point 24 is
  furthest from home, point 1 is the ace point.
- A checker on point `p` moving die `d` lands on `p - d`. Uniformly. No special
  cases.
- Entering from the bar is just `25 - d` (die 1 enters on point 24).
- Bearing off is just `p - d <= 0`.
- Switching sides is one mirror: `pts'[i] = -pts[25 - i]`, and swap the borne-off
  counts. The bar slots (0 and 25) mirror into each other for free.

**Consequence:** move generation is written once, for one side. If you find
yourself writing `if (player === WHITE)` inside the engine, you have made a
mistake — go back and mirror instead.

The absolute/display numbering used by the UI and by GNU position IDs is a
*presentation* concern and is converted at the boundary, never inside the engine.

## 6. How to see the game

You are expected to look at your own work. Do not ship visual changes you have
not viewed.

The UI is a normal web app in development, so:

```bash
pnpm dev &                    # serve on :5173
pnpm shots                    # screenshots every gallery scene to .shots/
```

Then read the PNGs in `.shots/` directly — they are images, open them.

Any board state is addressable by URL, so you never have to play a game to
reach a position you want to look at:

```
http://localhost:5173/?scene=opening
http://localhost:5173/?pos=<positionId>&dice=6,5&cube=2
http://localhost:5173/gallery          # every canonical scene on one page
```

Canonical scenes live in `apps/ui/src/dev/scenes.ts`. **Add a scene whenever you
build UI for a state that is hard to reach by playing** (bear-off race, backgame,
cube at 64, both players on the bar, gammon win). A state with no scene will not
get looked at, and will therefore be broken.

**Scenes are not enough on their own.** They are board fixtures with no game
state behind them — no score, no opponent, no turn log — so the entire chrome
around the board is empty in every one of them and cannot be judged from them at
all. `pnpm live` plays a few real turns and captures the play view as a player
sees it; `pnpm screens` covers the ladder, the end-of-game panel and the review.
Look at those too before claiming a visual change is done.

For interactive playtesting — actually clicking through a game — drive the same
dev server with the `agent-browser` skill.

### Drive the DOM, not just the store

`pnpm playtest`, `pnpm sound` and the rest talk to `__nard`, which reads the
zustand store directly. That is fast and deterministic, and it means **none of
them touch the interface at all** — every one of them passed for weeks against a
board on which drag-and-drop had never been implemented, because nothing had
ever pressed a mouse button.

`pnpm pointer` presses, moves and releases a real pointer, and fails on any
console error. Anything that changes how a player physically manipulates the
board belongs there.

`pnpm pacing` is the same blind spot in the time dimension. Every other harness
runs with `fast` on, which zeroes the opponent's deliberate pauses — so the
pacing could drift to nothing and the whole suite would stay green. It watches
the store at frame resolution and reports how long the dice sit still before the
first checker moves.

## 7. Testing

Behavioural and contained, not exhaustive. A test that cannot fail if the
behaviour regresses is not worth its lines. A test file several times the size of
the code it covers means something is wrong.

What genuinely earns tests here:

- **Move generation legality**, especially the ugly cases: forced use of both
  dice, the must-use-the-larger-die rule when only one is playable, doubles,
  bearing off with a checker on a higher point, entering from the bar onto a
  point held by exactly one opponent checker.
- **Mirror invariance**: mirroring a position and its move must produce the
  mirrored result. This one test catches an entire class of perspective bugs.
- **Position ID round-tripping** against known GNU Backgammon IDs.
- **Cube decisions at match score** — the take points differ from money play and
  it is easy to get Crawford wrong.
- **Determinism**: the same seed must reproduce the same match, exactly. The
  fairness guarantee depends on it.

Do not write tests that assert the neural net's output values. Test its
*properties* instead (a won position evaluates above a lost one).

## 8. Definition of done

A change is done when:

- [ ] `pnpm check` passes
- [ ] Any behaviour change is reflected in the relevant `docs/` spec
- [ ] Visual changes have been **looked at** via `pnpm shots`, and a scene exists
      for any new state
- [ ] Decisions that constrain the future got an ADR in `docs/adr/`
- [ ] No new dependency without justification in the PR description

## 9. Engineering values specific to this repo

**When you change what a value means, enumerate its readers first.** Adding an
enum case, letting a field be null, widening a type, or removing a guard —
the damage from these never appears in the diff, it appears in untouched code
that reads the changed thing. Grep for the symbol and list the call sites in the
PR description before writing the change. This applies with particular force to
the engine, where a subtly wrong `GameState` propagates into analysis, the AI's
training data, and saved matches.

**Defensive code has to earn its place.** Guards, retries and fences are right
when the thing they protect against is real and the consequence is serious. They
are wrong when the risk is theoretical, because every guard is read and reasoned
around forever. Ask: how likely, how bad, and what does it cost permanently.
Writing down an accepted small risk is often better engineering than defending
against it.

**A review finding being real does not make its proposed fix proportionate.**
Apply the same test to the remedy.

## 10. Things not to build

Explicitly out of scope. Do not add these, and push back if asked to:

- Chat, emotes, or an online lobby with strangers
- Coins, gems, energy, daily rewards, streaks, loot
- Achievements for showing up
- Ads or telemetry of any kind. The app phones home to nobody.
- Accounts. There is no server. Everything is local.
