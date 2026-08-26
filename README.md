<div align="center">

# nard · نرد

**A backgammon game with a configurable AI opponent.**

</div>

Built for one specific person: a lifelong, genuinely strong backgammon player who
agreed to play it on the condition that it looks good. That constraint runs
through every decision here.

---

## What it is

A desktop backgammon game where you choose an opponent rather than a difficulty
level. Six of them, each with a way of playing — one attacks, one runs for home,
one builds a wall and waits behind it all evening. Underneath, each is a
(strength, style) pair driving **GNU Backgammon**, which plays at a level a
strong club player will respect.

- **The opponent is real.** GNU Backgammon runs as a sidecar process and
  evaluates every legal move. At full strength it plays all eight opening rolls
  to book.
- **Weakness is coherent.** Easier opponents do not blunder at random — they are
  sampled from the ranked move list by how much equity a play gives up, so an
  easy opponent plays the genuine third-best move, which is a move a real player
  would make.
- **The dice are provably fair.** Commit–reveal: the seed's hash is published
  before the first roll and revealed after the last, so the program cannot have
  chosen a roll to suit the position — and you can check it yourself.
- **Persian and English**, with the terms used at a real board (تاس، مارس،
  دوبل), Persian numerals, and a board that deliberately does *not* mirror when
  the language does.

## Where it stands

| | |
| --- | --- |
| Rules engine | done — zero disagreements with GNU Backgammon over 10,000 random positions |
| Opponent, difficulty, personalities | done |
| Board, motion, sound, three themes | done |
| Cube and match play | done |
| Analysis: equity loss, PR, blunder review | in progress |
| Windows packaging | in progress |

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

GNU Backgammon is expected at `~/opt/gnubg`. Without it the game still runs on a
weaker built-in evaluator and says so in the header.

```bash
pnpm check        # typecheck + tests
pnpm playtest     # play complete games through the real UI
pnpm difftest     # engine move generation vs. GNU Backgammon
pnpm selfplay     # AI vs AI, reports PR per difficulty rung
pnpm shots        # screenshot every canonical board state
pnpm motion       # measure animations against the spec
pnpm sound        # verify audio fires at the right moments
```

Playing: click the board to roll, or press space. Click a checker, then its
destination. `U` undoes a part-played turn, `D` doubles, `Esc` returns to the
opponent list.

## How this repo is built

The specs in [`docs/`](docs/) are the primary artifact and the code is derived
from them. [`AGENTS.md`](AGENTS.md) is the entry point for anyone — human or
otherwise — working on it, and [`docs/adr/`](docs/adr/) records the decisions
that constrain everything else.

Two conventions worth knowing before reading the code:

- **The engine is perspective-relative.** Positions are always described from
  the point of view of the player on roll, so move generation is written once
  and side-switching is a mirror. See `AGENTS.md` §5 — this is the single
  biggest source of bugs in backgammon code.
- **Visual work gets looked at.** Every board state is addressable by URL and
  screenshotted by `pnpm shots`; animations are measured by `pnpm motion`
  against stated numbers rather than eyeballed. See
  [`docs/playtesting.md`](docs/playtesting.md).

## Licence

MIT — see [LICENSE](LICENSE).

GNU Backgammon is GPL-3.0 and is invoked as a **separate process**, which is
aggregation rather than linking; no GPL code is present in this repository.
Sounds are CC0 and portraits are generated; both carry provenance files
alongside the assets. The Vazirmatn typeface is under the SIL Open Font License.
