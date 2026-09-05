# Design language

**This document is binding.** Components consume tokens from here; they do not
invent colour, spacing, or timing. If a case isn't covered, extend this file in
the same PR rather than hard-coding a value in a component.

## The idea

**Bone, ebony, brass.** The board is a piece of *khatam* (خاتم‌کاری) — Persian
marquetry, the craft used on real Iranian backgammon boards: fine geometric
inlay of bone, dark wood and brass.

The discipline that keeps it from becoming kitsch:

- **The playing field is calm. The frame carries the craft.** All the inlay
  detail lives in the border band around the play area. The field itself is
  quiet so the checkers read instantly.
- **The board is the only ornamented object on screen.** App chrome is
  near-black and recedes. No competing texture anywhere else.
- **One light source, upper-left.** Every shadow in the app agrees with it.
- **Brass is an accent, never a fill.** Hairlines, the cube, the pip counter.

Anti-goals: gradients-as-decoration, glow, neon, heavy glassmorphism, drop
shadows on text, cartoon bevels, anything that reads as a mobile game.

## Colour tokens

Defined in `apps/ui/src/styles/theme.css` as CSS custom properties. Three
themes; **Khatam** is the default.

**Every surface token comes in three parts — base, `-hi`, `-lo`.** A flat fill
cannot describe a lit object, and the board has exactly one light (see below):
`-hi` is the face turned toward it, `-lo` the face turned away. A colour that
exists only as a base is a colour that will read as cardboard.

### Khatam (default, dark)

| Token | Value | Use |
| --- | --- | --- |
| `--app-bg` | `#0A0806` | app background |
| `--app-glow` | `#2B1E13` | the pool of light the board sits in (`.room`) |
| `--app-panel` | `#17110C` | rail panels, drawers, overlays |
| `--app-line` | `#2E2318` | **every border in the chrome** |
| `--frame` | `#4A3520` | wooden board frame |
| `--frame-hi` / `--frame-lo` | `#866440` / `#1D140C` | its lit and shadowed faces |
| `--inlay` | `#C9A227` | brass: hairlines, the cube, primary buttons |
| `--field` | `#1D160F` | board surface between points |
| `--point-a` / `--point-a-lo` | `#B4482D` / `#6B2818` | jujube red points, base and tip |
| `--point-b` / `--point-b-lo` | `#3C8F77` / `#1E5546` | cypress green points, base and tip |
| `--point-hi` | `#F2E5C6` | the lit lip where a point meets the frame |
| `--point-seam` | `#E8D9B4` | the marquetry join line round each point |
| `--khatam-ground` / `-bone` / `-brass` | `#191108` / `#D9C9A4` / `#8A6D28` | the inlay band |
| `--checker-light` / `-edge` / `-lo` | `#F5ECD7` / `#C4AE87` / `#8A7554` | bone checkers, lit → shadowed |
| `--checker-dark` / `-hi` / `-lo` | `#1D1713` / `#6D5738` / `#0B0806` | ebony checkers, lit → shadowed |
| `--checker-dark-rim` | `#C9A227` | **brass line — load-bearing, see below** |
| `--shadow` | `#180D04` | every cast shadow. **Warm, never `#000`** |
| `--pip-deep` / `--pip-lit` | `#241A12` / `#7A6242` | the walls of a drilled die pip |
| `--text` / `--text-dim` | `#F0E5D0` / `#A4917A` | |
| `--good` / `--warn` / `--bad` | `#7FA066` / `#D4952F` / `#C9542B` | best move / error / blunder and hits |

**The two point colours must sit within a few lightness points of each other.**
Hue can be as far apart as you like — red against green is the traditional
Iranian board — but lightness cannot. The cypress green was `#2F5148`, thirteen
lightness points under the jujube red and within two percent of the field it sat
on, and it simply disappeared: the board read as red points on an empty ground.
When retuning these, check them **at the tip**, where the sheen is darkest, not
at the base.

**Checker-to-field contrast must be several times point-to-point contrast.**
The points are texture; the checkers are the figures on it. If the points shout,
the checkers cannot.

**The brass line on ebony checkers is a legibility device, not decoration.**
On a point an ebony checker has plenty of contrast, but on the bar and on the
bare field it sits on ground close to its own value, and the line is what holds
it there. It is deliberately ONE thin line: carrying the brass across the rim
gradient as well turned every dark checker into a bottle cap. Check the bar
before weakening it.

**Chrome borders are always `--app-line`, never `--frame`.** `--frame` is
timber; using it on a panel puts a piece of the board's material somewhere the
board is not.

### Tournament (dark, plain)

Billiard-green field `#0F2F25`, tan and dark-green points `#C9BB9C` / `#2A5F4E`,
brighter-than-bone checkers `#FDFAF2` so they stay distinct from the tan point
they stand on. For when the ornament is too much.

### Kaghaz (light)

Paper `#F2EBDD`, field `#E3D8C0`, points `#C05537` / `#52796B`, checkers
`#FFFDF7` / `#2E2720`. Note `--shadow` is `#6B5636` here, not a dark value: a
shadow on paper is warm and light, and reusing a dark one punches holes in it.

## Typography

- **Vazirmatn** (variable) for both Persian and Latin. One family keeps metrics
  consistent across the language toggle. Self-hosted — no CDN, the app is offline.
- **IBM Plex Mono** for position IDs, match IDs, and seeds.
- Every numeral in the app is `font-variant-numeric: tabular-nums`. Pip counts
  and equities must not jitter as they change.

Scale: `12 / 14 / 16 / 20 / 28 / 40`. Weights: 400 body, 500 emphasis, 700
headings only. Nothing lighter than 400 — it falls apart in Persian.

## Board geometry

Everything derives from one unit, `u` = the width of a point. **The proportions
are taken from a real tournament board, not invented** — ~1.75in points, ~1.5in
checkers, ~7in point length, ~2in bar, on a ~23×16in interior. That is why the
board reads as an object rather than as a diagram, and it is why these numbers
should not be nudged for looks without measuring against a real board first.

One exception, measured rather than felt: **point height is `4.9` checker
diameters, not the tournament board's `4.67`.** At 4.67 the open band between
opposing tips came to 1.38 checker diameters, against the ~0.8 that good digital
boards leave, and the middle of the board read as a strip of empty field. Five
checkers still overhang slightly, which is the property that number is protecting.

| Quantity | Value | Real-board equivalent |
| --- | --- | --- |
| checker diameter | `0.857u` | 1.5in on a 1.75in point |
| point height | `4.9 ×` checker diameter | ~7.3in |
| bar width | `1.15u` | 2in |
| inner field | `13.15u × 9.18u` (aspect **1.43**) | 23×16in |
| frame thickness | `0.5u` | |
| inlay band | `0.2u`, set toward the inner edge | |
| tray | `1.05u` wide, behind a `0.14u` divider | |

### Stacking

- **Five checkers sit at full diameter and overhang the point very slightly.**
  This is correct — they do on a real board too. Do not lengthen the point to
  make them fit.
- **Six or more compress** to fit within the point, down to a floor of `0.55`
  diameters.
- Past that floor the stack would read as a smear, so it truncates at what fits
  and puts a small brass count chip on the top checker. Never hide checkers
  silently, never overflow into the frame.

### The light model

**There is ONE light, upper-left, high.** Every shadow, bevel and highlight in
the app obeys it, and that consistency is most of what separates a rendered
object from a diagram. It has two consequences, and they are opposites:

| | lit | in shadow | cast shadow |
| --- | --- | --- | --- |
| **Raised** (case, bar, tray divider, a checker, a die) | top and left | bottom and right | falls down-and-right |
| **Recessed** (playing field, tray well, a drilled pip, a checker's dish) | bottom and right inner wall | **top and left** inner wall | none |

Get that backwards on one element and the whole board flattens, because the eye
reads the inconsistency long before it can name it. A checker's dish and its top
face are shaded in opposite directions for exactly this reason.

Specific consequences, each of which was got wrong at least once:

- **The bar is raised but sits between two raised halves**, so it takes light on
  its left shoulder and falls into shadow on the right. Rendering it as bright
  as the case makes it a plank laid on top of the board.
- **The recess's LIT walls are faint** — 0.15–0.2 at most. A far wall catches a
  glancing light, not a full one; above that the highlight stops reading as a
  wall and starts reading as grey haze over the base of every point.
- **The lit lip on a point is a hairline**, ~5% of its length. At 14% it covered
  half a checker and the board looked dusted.
- **Cast shadows are `--shadow`, never black.** A black shadow on a warm board
  reads as a hole punched through it.

### Materials

Everything is procedural — SVG gradients and filters, no image assets.

- **Wood** is two stacked `feTurbulence` layers: a broad low-frequency one for
  the tonal drift of a sawn plank, and a fine high-frequency one for the pore
  lines, both stretched hard along the grain. One layer never reads as wood.
  Push the red channel into all three and pin alpha to 1 before blending —
  turbulence varies alpha too, and leaving that in gives blotches that read as
  dirt.
- **The khatam band** is a chain of bone and brass lozenges on ebony, wired top
  and bottom. **What actually renders decides the motif**: the band is ~11
  physical pixels across, and a twelve-sided star at that size is mush — it came
  out looking like a row of asterisks and the board read as a cinema marquee. A
  lozenge chain is equally authentic and survives being small.
- **A checker** is, in order: cast shadow, cylindrical wall (lit upper-left —
  this is the layer that makes it an object), top face, one turned groove, the
  dish, and a soft specular bloom. Not a stack of concentric strokes.
- **Die pips are drilled, not printed** — dark on the upper-left inner wall,
  catching light on the lower-right. That inversion is the whole reason a pip
  reads as a hole.

### Filters are for the static board only

An SVG filter re-rasterises its entire subtree whenever anything inside it
changes. `filter="url(#board-shadow)"` originally wrapped the group that also
contained the checkers, so every checker that moved re-ran a two-pass blur over
the whole board, once per frame, per checker.

**The case is filtered; the moving layer is its unfiltered sibling.** Anything
expensive belongs inside the filtered group. Anything that moves uses gradients,
which are free — including checker shadows, which are drawn ellipses.

### Deliberate departures from a real khatam board

Three things here are knowingly *not* what an authentic Iranian board does.
They are choices, not oversights, and they are written down so nobody
"corrects" them later.

- **The points alternate colour.** A real Persian board gives each quadrant six
  IDENTICAL points in one khatam pattern, separated by a contrasting ground
  whose negative spaces form counter-wedges. Alternating points are a Western
  convention — but they are a *functional* one that an experienced player reads
  at speed, and AGENTS.md §1 is explicit that credibility to an expert wins over
  authenticity when the two disagree.
- **There is a doubling cube.** It is a 1920s New York invention and appears on
  no Persian board. The app is a backgammon app; the cube stays.
- **The cypress green is far greener than the real thing.** The traditional
  colour is a verdigris teal, nearer `#0C373D` — bone steeped for months in
  vinegar and copper filings. At that lightness it vanishes against the field,
  which is the exact failure this palette was retuned to fix.

Two things that ARE authentic and should not be "modernised": the lozenge chain
in the border band is the canonical border product (خاتم حاشیه, deliberately
simpler and narrower than field work), and the bar is where a real board's
hinge runs.

### Affordances

The board tells the player what is mechanically possible. It never says what is
GOOD — see AGENTS.md §1.

| Mark | Means |
| --- | --- |
| brass tick at a point's base | a checker here can move |
| brass ring round the top checker | it is in your hand |
| filled brass disc at the landing slot | a quiet landing: open, or yours |
| the same disc inside a red ring | this landing HITS a blot |
| the numeral inside the disc | which die the landing spends |
| the whole slot filled, faintly | the pointer is over this landing |
| a point washed in brass at 17% | the OPPONENT's last turn touched it |

The dot-versus-ring pair is the one convention board-game interfaces have
actually settled on — chess.com and lichess arrived at it independently. The
die numeral is the part backgammon needs and chess does not: a destination there
is a function of which die you spend, and a plain highlight throws that away.

**The last-move wash marks only the opponent's turn**, and only the most recent
actual move — skipping past cube offers and turns with no legal play. Marking
your own would light the board up every time you played.

### Picking a checker up

Both gestures work, and one press has to serve both without the player choosing
in advance. The rule is distance: press and the checker is selected; move more
than a checker's radius before releasing and it was a drag, so it lands where it
is let go; release without moving and it stays selected for the next click.

The carried checker gets a larger, further-offset shadow than a resting one —
that shadow is most of what says it is lifted rather than sliding — and the one
it came from stays drawn at 28% so the player can see where they picked up from.

### Direction is a setting, not a language property

Players differ on which side their home board sits. `homeBoard: 'left' |
'right'` is a **user preference**, independent of interface language.

**The board never mirrors with RTL.** Switching the UI to Persian mirrors the
surrounding chrome — rails, drawers, text alignment — and leaves the board
exactly where it was. An experienced player has a fixed spatial model of a board
and flipping it because he changed language would be actively hostile.

## Motion

Motion exists to make the checkers feel physical. It never announces itself,
never blocks input, and is always interruptible.

| Interaction | Spec |
| --- | --- |
| Checker lift (pick up) | `110ms cubic-bezier(.2,.8,.3,1)`, scale → `1.05`, y `-2px`, shadow blur `3 → 14px` |
| Checker travel | spring `{ stiffness: 420, damping: 28, mass: 0.9 }` — ζ 0.72, ~4% overshoot, ~260ms settle |
| Checker drop | scale `1.05 → 1` over `90ms`, shadow contracts |
| Checker hit → bar | travel spring + `8°` rotation, slight arc, `320ms` |
| Dice roll | three tumbles over `380ms`, land with `6%` overshoot |
| Cube turn | `rotateY(180deg)` over `420ms` |
| Drawer open | spring `{ stiffness: 300, damping: 32 }` |

Use `motion` for springs, layout and exit animations. Use plain CSS transitions
for simple hovers and fades — pulling in a spring for an opacity change is
overkill.

### Tune springs with the physics, not by feel

A spring is fully described by stiffness `k`, mass `m` and damping `c`. What you
actually care about follows from them:

```
damping ratio   ζ = c / (2·√(k·m))
overshoot       ≈ exp(−πζ / √(1−ζ²))
settle time     ≈ 4 / (ζ·√(k/m))
```

The checker travel spring targets **ζ ≈ 0.72** — enough overshoot to feel like a
physical object with weight being set down, not enough to wobble. The first implementation
used `damping: 34`, which is ζ 0.87: almost critically damped, 0.3% overshoot,
and it settled 50ms early. Nobody noticed by eye; `pnpm motion` measured it.

**So: change these numbers only with `pnpm motion` in front of you.** It reports
measured overshoot and settle time against the spec, which is the whole reason
those values are stated here as numbers rather than adjectives.

**`prefers-reduced-motion`:** every entry above degrades to a `120ms` linear
opacity change with no transform. This is not optional and is checked in review.

Sound (checker click, dice on wood, cube turn) is recorded from real equipment,
defaults to on, single volume control, and is silent when the window is unfocused.

## Assets

**There are no texture images.** Wood, felt, the inlay band and every material
on the board are generated at render time from SVG gradients and filters, so a
theme is a palette swap and nothing has to be re-exported when a colour changes.
Do not add a texture file to solve a problem a gradient can solve.

The committed assets are: the six opponent portraits
(`assets/portraits/*.webp`, generated with `gpt-image-2`), the Vazirmatn
variable font, and the sound set. Provenance and licensing for each are in a
`PROVENANCE.md` beside them.

**Sound is CC0 library material**, not recordings of real equipment — see
`assets/sound/PROVENANCE.md`. Nothing that is not CC0 may be added. Events are
named (`place`, `hit`, `bar`, `off`, `dice`, `cube`, `win`); components emit
events and never name a file. Events that repeat many times a game carry several
samples, because one sample played identically reads as a rattle.

## Restraint checklist

Before merging any visual change:

- [ ] Would this look out of place on a real wooden board?
- [ ] Does it use a token, or did you type a hex value?
- [ ] Do both checker colours read against both point colours?
- [ ] Does it degrade correctly under `prefers-reduced-motion`?
- [ ] Does it still look right in all three themes, and in Persian?
- [ ] Did you look at it? (`pnpm shots`)
