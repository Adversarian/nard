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
