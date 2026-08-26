# Architecture

## Shape

A TypeScript monorepo. One language end to end, so any agent can run the whole
thing with `pnpm check` and nothing needs cross-compiling to be tested.

```
                    ┌──────────────┐
                    │   apps/ui    │  React 19 + Vite. The game.
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌──────────────┐  ┌────────────────┐
│ packages/     │  │ packages/    │  │ packages/      │
│   analysis    │─▶│     ai       │─▶│    engine      │
│ PR, equity    │  │ eval, search │  │ rules, cube,   │
│ loss, luck    │  │ personalities│  │ position IDs   │
└───────────────┘  └──────────────┘  └────────────────┘
                                       pure · no I/O
                                       no randomness
```

Dependencies point one way only. `engine` imports nothing of ours. `ui` is
imported by nothing.

`apps/desktop` (Tauri v2) arrives at M4 and is deliberately thin: a window, a
menu bar, file dialogs for import/export, and the app's data directory. All game
logic stays in the packages above so it remains testable in Node and viewable in
a browser.

## Why the engine is pure

`packages/engine` is synchronous, allocation-light, and has no dependencies —
not on the DOM, not on a clock, not on `Math.random`. **Dice are injected.**

This buys four things at once:

- **Provable fairness.** A match is a seed plus a move list. Replay is exact.
- **Testability.** Every rules edge case is a plain unit test.
- **Analysis for free.** Re-running a game with a different decision at move 14
  is just calling the same functions again.
- **Speed.** The AI evaluates millions of positions during rollouts. Anything
  impure in this layer becomes a bottleneck immediately.

Nothing in `engine` may become async, and nothing may reach for entropy. If you
need randomness, take a `Dice` source as a parameter.

## The AI backend: gnubg

The opponent's brain is **GNU Backgammon**, run as a long-lived child process.

```
packages/ai  ──JSON over stdio──▶  gnubg -q -t -r -p bridge.py
                                   (embedded Python 3.12)
```

`gnubg.hint()` returns, for every legal move in a position:

| Field | Use |
| --- | --- |
| `move` | standard notation, e.g. `8/5 6/5` |
| `equity` | cubeful equity |
| `eqdiff` | equity lost vs. the best move — drives difficulty *and* analysis |
| `details.probs` | `[win, win-g, win-bg, lose-g, lose-bg]` — drives personalities |

This is the highest-leverage decision in the project. It gives us world-class
strength, correct cube decisions at match score, rollouts, and the entire
analysis feature, none of which we could match by training our own net in
reasonable time. See `adr/0004-gnubg-as-ai-backend.md`.

**Licence:** gnubg is GPL-3.0 and we invoke it as a *separate process* over a
text protocol. No GPL code enters this tree, and this repo stays MIT. Do not
link, vendor, or copy gnubg source into `packages/`.

**Our own evaluator is optional.** `packages/ai` defines an `Evaluator`
interface; `GnubgEvaluator` is the shipping default and `NetEvaluator` (a small
TD-trained net, trained offline in Python, shipped as a weights blob) is the
fallback for when the sidecar is unavailable, and a future source of a more
human-feeling difficulty ladder. Nothing outside `packages/ai` may know which
backend is in use.

## Performance, and why this stays TypeScript

Because gnubg does the evaluation, the TypeScript side is orchestration and
rendering. Nothing in it is compute-bound:

| Work | Cost |
| --- | --- |
| Legal move generation | microseconds |
| A gnubg hint at 2-ply | tens of ms, in another process |
| Analysing a full match | seconds, batched, off the main thread |
| Rendering the board | GPU-composited transforms |

For the `NetEvaluator` fallback the numbers are: ~16k multiply-adds per
position, so 20–60k evaluations/sec in JS on `Float32Array`. A 0-ply decision is
~20 evals (instant); 1-ply is ~8,400 (~0.3 s). That is enough for a credible
opponent unassisted. Full rollouts are not viable in JS and are not attempted —
they belong to gnubg.

**The escape hatch, so nobody ever proposes a rewrite:** the only code that
could plausibly need native speed is the net's inference inner loop — one
isolated function behind the `Evaluator` interface. If it ever matters, that
function is ported to WASM. The rules engine, analysis, storage and UI stay in
TypeScript permanently. A Rust rewrite of the application is explicitly not on
any roadmap.

## Dependencies

Chosen once, here. Adding a competitor to any of these needs an ADR.

| Job | Library | Note |
| --- | --- | --- |
| UI framework | react 19 | |
| Build/dev server | vite 8 | |
| Styling | tailwindcss 4 | CSS-first config, tokens in `theme.css` |
| Conditional classes | clsx | |
| Component variants | class-variance-authority | only where variants are real |
| Accessible primitives | @base-ui-components/react | dialogs, popovers, menus, sliders |
| Animation | motion | springs, layout, exit. Plain CSS for simple fades. |
| Animated numerals | @number-flow/react | pip counts, equity, PR |
| Charts | recharts | PR over time, luck/skill |
| Toasts | sonner | |
| State | zustand | one store per concern, not one global blob |
| Tests | vitest | |
| Screenshots | @playwright/test | dev-only, see playtesting.md |

**Not used, deliberately:** any GPL-licensed backgammon library
(see `adr/0001`), any charting or component kit not listed above, any CSS-in-JS
runtime, any state library besides zustand.

## Data that persists

Local files only, in the OS app-data directory:

- `matches/*.json` — every match played, as `{seed, commitment, moves, meta}`.
  Small, replayable, and the input to all analysis.
- `profile.json` — PR history, ladder progress, settings, theme.
- `drills.json` — spaced-repetition state for positions he got wrong.

Formats are versioned from day one (`{v: 1, ...}`). A saved match must remain
readable forever; it is the record of games with his son.
