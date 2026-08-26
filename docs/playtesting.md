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
pnpm shots         # writes .shots/<scene>.png for every scene
```

Then **open the PNGs**. They are images; read them directly. A visual change you
have not viewed is not finished.

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
