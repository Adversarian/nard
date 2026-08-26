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

### Khatam (default, dark)

| Token | Value | Use |
| --- | --- | --- |
| `--app-bg` | `#100C09` | app background |
| `--app-panel` | `#1A1410` | side rails, drawers |
| `--frame` | `#46331F` | wooden board frame |
| `--frame-hi` | `#6B5133` | frame top bevel |
| `--inlay` | `#C9A227` | khatam hairlines, brass |
| `--field` | `#17110D` | board surface between points |
| `--point-a` | `#A63D2B` | jujube red points |
| `--point-b` | `#2F5148` | cypress green points |
| `--checker-light` | `#F0E4CC` | bone checkers |
| `--checker-light-edge` | `#C2AF8B` | their turned ring |
| `--checker-dark` | `#1A1410` | ebony checkers |
| `--checker-dark-rim` | `#C9A227` | **brass rim — load-bearing, see below** |
| `--checker-dark-hi` | `#4A3B2E` | ebony top bevel |
| `--text` | `#EFE3CD` | primary text |
| `--text-dim` | `#A2917A` | secondary text |
| `--good` | `#7C9A62` | best move, correct decision |
| `--warn` | `#D4952F` | error |
| `--bad` | `#C7522A` | blunder |

**The brass rim is a legibility device, not decoration.** Ebony checkers on the
cypress points would otherwise be dark-on-dark. The rim guarantees both checker
colours read against both point colours. Do not remove it to "clean up" the
design; check contrast first.

### Tournament (dark, plain)

Billiard-green field `#0F2A22`, points `#E8E2D5` / `#1D1A17`, ivory and black
checkers, frame `#2A2119`, no inlay band. For when the ornament is too much.

### Kaghaz (light)

Paper `#F4EFE4`, field `#E6DCC8`, points `#C25B3F` / `#5C7A6E`, checkers
`#FFFDF7` / `#2A241E`. For daylight.

## Typography

- **Vazirmatn** (variable) for both Persian and Latin. One family keeps metrics
  consistent across the language toggle. Self-hosted — no CDN, the app is offline.
- **IBM Plex Mono** for position IDs, match IDs, and seeds.
- Every numeral in the app is `font-variant-numeric: tabular-nums`. Pip counts
  and equities must not jitter as they change.

Scale: `12 / 14 / 16 / 20 / 28 / 40`. Weights: 400 body, 500 emphasis, 700
headings only. Nothing lighter than 400 — it falls apart in Persian.

## Board geometry

Everything derives from one unit, `u` = the width of a point.

| Quantity | Value |
| --- | --- |
| checker diameter | `0.86u` |
| point height | `5.2 ×` checker diameter |
| bar width | `1.4u` |
| inner field | `12u + bar` wide |
| frame thickness | `0.55u` |
| inlay band | `0.18u`, centred in the frame |

- **Maximum five checkers drawn stacked.** Six or more compresses the spacing to
  `0.62 ×` diameter and puts a small brass count chip on the top checker. Never
  hide checkers, never overflow the point.
- Point apexes are slightly rounded (`2px` at `u = 64px`). Real inlay is not
  razor-sharp, and a hard point reads as clip-art.

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
| Checker travel | spring `{ stiffness: 420, damping: 34, mass: 0.9 }` (~260ms settle) |
| Checker drop | scale `1.05 → 1` over `90ms`, shadow contracts |
| Checker hit → bar | travel spring + `8°` rotation, slight arc, `320ms` |
| Dice roll | three tumbles over `380ms`, land with `6%` overshoot |
| Cube turn | `rotateY(180deg)` over `420ms` |
| Drawer open | spring `{ stiffness: 300, damping: 32 }` |

Use `motion` for springs, layout and exit animations. Use plain CSS transitions
for simple hovers and fades — pulling in a spring for an opacity change is
overkill.

**`prefers-reduced-motion`:** every entry above degrades to a `120ms` linear
opacity change with no transform. This is not optional and is checked in review.

Sound (checker click, dice on wood, cube turn) is recorded from real equipment,
defaults to on, single volume control, and is silent when the window is unfocused.

## Textures

The wood grain, felt, and khatam inlay band are generated assets, produced with
the `torob-ai-sub-image-generation` skill and committed as optimised WebP under
`apps/ui/src/assets/textures/`. They are tiled and tinted with the tokens above
rather than baked at final colour, so themes stay swappable. Keep each under
80 KB; this is a desktop app, not a texture demo.

## Restraint checklist

Before merging any visual change:

- [ ] Would this look out of place on a real wooden board?
- [ ] Does it use a token, or did you type a hex value?
- [ ] Do both checker colours read against both point colours?
- [ ] Does it degrade correctly under `prefers-reduced-motion`?
- [ ] Does it still look right in all three themes, and in Persian?
- [ ] Did you look at it? (`pnpm shots`)
