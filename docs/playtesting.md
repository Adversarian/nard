# Playtesting

Agents working on this repo are expected to look at what they built. This
document is how.

## Why the UI is a web app

`apps/ui` runs in a plain browser during development (`adr/0003`). This is
deliberate: it means any agent can start it, screenshot it, and click through it
without building or launching a desktop binary.

## Seeing it

```bash
pnpm dev &         # http://localhost:5173
pnpm shots         # .shots/<scene>.png — board fixtures
pnpm live          # .shots/live-*.png — the play view, a few real turns in
pnpm screens       # .shots/{ladder,outcome,review}-*.png
```

Then **open the PNGs**. They are images; read them directly. A visual change you
have not viewed is not finished.

**`pnpm shots` alone will mislead you.** Scenes are board fixtures with no game
behind them, so the score, the opponent, the turn log and the action buttons are
empty in every single one — which meant the entire interface around the board
went a long time without anyone looking at it. `pnpm live` plays several real
turns first and captures the view a player actually sits in front of; add
`--pick` to leave a checker selected so the landing marks are in the frame, and
`--lang=fa` / `--theme=` to check the other renderings.

## Clicking it

```bash
pnpm pointer       # presses, drags and releases a REAL mouse
pnpm pacing        # times the opponent's turn at normal speed
pnpm live --headed # a real GPU-rasterised browser, not headless
```

Everything else here — `pnpm playtest`, `pnpm sound`, `pnpm live` — drives the
game through `__nard`, which reads the store directly and never touches the
interface. That is fast and reproducible and it has one enormous blind spot:
**the whole suite passed against a board on which drag-and-drop did not exist**,
because nothing in it had ever pressed a mouse button. The first person to open
the app found it in a minute.

`pnpm pointer` drags a checker to a legal point, drags one off the board to check
it goes back, clicks source-then-destination, and fails on any console error.
Anything that changes how a player physically handles the board goes there.

`pnpm pacing` covers the same blind spot in time. Everything else runs `fast`,
which zeroes the opponent's deliberate pauses, so a driver can play a thousand
turns without ever exercising the timing a person actually sits through. Two
traps found while writing it, both worth knowing: **sound timestamps are the
wrong clock** — a placement sound fires when the travel animation ENDS, and the
player's own checkers are still in the air when the opponent rolls, so timing
one against the other reported 306ms for a pause of well over a second. And
**a turn's last hop commits it**, which empties the draft, so counting draft
growth alone misses the final checker and a two-checker turn yields no gaps at
all.

**Headless Chrome cannot see SVG filter bugs.** It rasterises filters on the
CPU and gets them right; the accelerated path does not always agree. A
drop-shadow over the board smeared a ghost of its own edge onto the table in a
real browser and rendered perfectly in every headless capture here, at every
window size, through several rounds of review. `pnpm live --headed` runs a real
browser (it needs a display); use it for anything touching a filter, and add
`--scale=1` since the artefact only showed at a device pixel ratio of 1.

One trap it is now hardened against, worth knowing before writing another
driver: **`__nard` answers even when the board is not on screen.** The store
holds a playable game while the ladder is showing, so a driver whose match
failed to start will happily play a hundred turns against nothing and screenshot
the ladder at the end of it. `startMatch` now waits for the board element rather
than a fixed delay. Likewise `__nard.hops()` reports the hops of whoever is on
roll — including the opponent — while the board offers hit targets only to the
human; wait on `HUMAN_TO_MOVE`, not `PLAYERS_TURN`.

## Addressable states

The problem with playtesting a board game is reaching interesting states. So
every state is reachable by URL, no play required:

```
/?scene=<name>                       a named canonical scene
/?pos=<positionId>&dice=6,5&cube=2   an arbitrary position
/gallery                             every scene at once, for a fast eyeball
```

Scenes live in `apps/ui/src/dev/scenes.ts`. The canonical set covers the states
that are hard to reach and easy to get wrong:

| Scene | Why |
| --- | --- |
| `opening` | the baseline; if this is wrong everything is |
| `crowded-point` | 7 checkers on one point — tests stack compression |
| `both-on-bar` | both bars occupied |
| `bearoff-race` | no contact, both bearing off |
| `backgame` | opponent holds two anchors in our home board |
| `cube-64` | cube at maximum, owned |
| `crawford` | Crawford game, cube disabled |
| `gammon-win` | game-over overlay, gammon |
| `blunder-review` | analysis drawer open with a blunder selected |
| `long-persian` | Persian UI with the longest strings, for overflow |

**Add a scene whenever you build UI for a state that is hard to reach by
playing.** A state with no scene will not be looked at, and will therefore break.

## Playing it

For interactive testing — actually clicking through a game — drive the dev
server with the `agent-browser` skill. Use it to check what screenshots cannot:
that dragging a checker feels right, that an illegal drop snaps back, that
animations are interruptible, that the board is usable with the keyboard.

## Seeing motion

You cannot watch an animation. You can still hold it to a spec, with three
techniques that between them are better than watching:

```bash
pnpm dev &
pnpm motion              # every interaction
pnpm motion checker-move # one of them
```

**1. Filmstrips.** `.shots/motion/<id>.filmstrip.png` tiles the frames of the
animation into one contact sheet. Frame *spacing* is the easing curve made
visible — tight spacing is slow, wide spacing is fast — so an eased move and a
linear one look obviously different on the sheet. Open the PNG.

**2. Numeric traces.** `.shots/motion/<id>.trace.json` holds the real transform
of every checker at every animation frame. The report derives measured lift
scale, travel distance, settle time and overshoot from it and checks them
against `design-language.md`.

**3. A control, whenever a number looks bad.** Instrumentation perturbs what it
measures. Before treating a bad reading as a bug, reproduce it a second way.
This is not pedantry — during development the harness reported a rock-solid
60fps animation as 30fps *three different times*, for three different reasons
(a sampler that forced style recalc, a loop that missed every other frame, and
CDP round-trips interleaving with the render loop). Each looked exactly like a
performance problem in the app.

### What the harness can and cannot certify

- **Reliable:** the sequence is right, the checker is actually set down at the
  end, travel lands in the right place, nothing is left stuck mid-animation, and
  any regression in the above. It has already caught four real bugs.
- **Noisy:** peak overshoot. 60Hz sampling straddles the peak of a 260ms spring,
  so a true 3.8% reads between 0.5% and 2.8%. Treat a *zero* reading as a bug and
  a small one as fine.
- **Not proof:** frame pacing, under instrumentation. Reported for information.

**Feel is still not measured.** Whether a move feels *good* is a human
judgement. Say so in the PR rather than implying the harness checked it.

## Playing it

```bash
pnpm playtest      # play one complete game through the real UI
pnpm playtest 5    # five
```

This drives the actual click path — pick a checker up, drop it on a point — via
`window.__nard`, so it exercises turn drafting, the engine boundary, the
animation identity reconciler and the render loop together. If a game completes
here, a person can play one.

It is worth more than its size suggests. It found a bug that no amount of
reading would have: a hop's `hit` flag is only correct for the hop ORDER the
engine recorded, so playing the same two checkers onto one blot in the opposite
order made the engine reject a legal move. That needs a specific board state to
appear at all, which is exactly the kind of defect unit tests do not reach.

`window.__nard` in a running dev server exposes `state()`, `legal()`, `hops()`,
`roll()`, `move(from, to)`, `undo()`, `double()`, `take()`, `pass()`,
`settled()` and `trace()`. Use it rather than clicking at coordinates.

## Headless testing

```bash
pnpm test          # unit + integration, vitest
pnpm selfplay      # AI vs AI, N matches, reports PR per rung
pnpm difftest      # engine move generation vs. gnubg over random positions
```

`selfplay` is how the difficulty ladder gets calibrated (`ai-spec.md`), and
`difftest` is how we find rules bugs. Neither needs a browser.

## Reviewing your own visual work

Screenshots tell you about layout, colour and state. They do not tell you about
motion, latency, or feel — for those, drive the browser or say plainly in the PR
that you did not check them. Do not claim a feel-based property you did not
observe.
