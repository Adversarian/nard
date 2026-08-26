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

`apps/desktop` is the deliberately thin Tauri v2 shipping shell: a window, a
menu bar, the app's data directory, and supervision of the bundled gnubg
process. The web app calls those capabilities through `apps/ui/src/platform`;
it does not resolve native paths or import Tauri APIs elsewhere. All game logic
stays in the packages above so it remains testable in Node and viewable in a
browser.

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
packages/ai  ──JSON over stdio──▶  gnubg -q -t -r --python=<bridge.py>
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
interface; `GnubgEvaluator` is the shipping default and `NetEvaluator` is the
pure-TypeScript fallback for when the sidecar is unavailable. Its M2
fixed-weight evaluation is deliberately modest: it keeps the game responsive
and coherent during a sidecar failure, but is not presented as gnubg-strength.
A later TD-trained weights blob can replace it behind the same interface.
Nothing outside `packages/ai` may know which backend is in use.

## Performance, and why this stays TypeScript

Because gnubg does the evaluation, the TypeScript side is orchestration and
rendering. Nothing in it is compute-bound:

| Work | Cost |
| --- | --- |
| Legal move generation | microseconds |
| A gnubg hint at 2-ply | tens of ms, in another process |
| Analysing a full match | seconds, batched, off the main thread |
| Rendering the board | GPU-composited transforms |

The M2 `NetEvaluator` evaluates legal results with fixed positional features.
It is fast enough for the failure path; it does not attempt multi-ply search or
rollouts. If a trained network later makes native inference worthwhile, its
inner loop remains one isolated function behind `Evaluator` and can move to
WASM without changing the rules engine, analysis, storage or UI. A Rust rewrite
of the application is explicitly not on any roadmap.

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

- `matches/*.json` — every match played, as
  `{v: 1, seed, commitment, decisions, meta}`. Decisions are the engine
  transitions (`roll`, `move`, forced pass, cube actions and game boundary);
  rolls contain no dice because `(seed, rollNumber)` derives them exactly.
  Checker moves store the GNU Position ID of the resulting position rather
  than depending on notation remaining canonical forever. `meta` contains the
  initial match/rules setup, timestamps supplied by the host, and optional
  player names. Small, replayable, and the input to all analysis.
- `profile.json` — PR history, ladder progress, settings, theme.
- `drills.json` — spaced-repetition state for positions he got wrong.

Formats are versioned from day one (`{v: 1, ...}`). A saved match must remain
readable forever; it is the record of games with his son.

The desktop shell creates the app-data root and `matches/` directory, then
provides the resolved `matches`, `profile.json`, and `drills.json` paths through
the platform seam. Browser development has no native paths and keeps using its
existing browser storage until the M5 persistence readers and writers land.
