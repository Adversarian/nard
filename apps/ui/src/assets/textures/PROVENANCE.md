# Textures

Generated images, not photographs of anything owned by anyone.

| File | What it is | Used for |
| --- | --- | --- |
| `case.webp` | figured dark walnut | the board's case, the bar, the tray divider |
| `field.webp` | dark polished rosewood | the playing surface and the bear-off well |
| `band.webp` | khatam-kari marquetry banding | the inlay band around the case |
| `bone.webp` | polished camel bone | light checkers, dice, the cube, and the points |
| `ebony.webp` | polished black ebony | dark checkers |

## Provenance

All five were generated with **`gpt-image-2`** from written prompts, then cropped
and processed locally. No third-party photographs, scans or stock assets are
included, and nothing here is derived from a copyrighted source.

## How they were made, and why it matters if you regenerate them

**Prompt them FLAT and EVENLY LIT.** These carry material only; the board's
single upper-left light is drawn over them in SVG (see `board/Defs.tsx`). A
swatch with its own lighting baked in cannot be relit, and will fight every
shadow on the board.

**The requested size is advisory.** The model quantises to its own set of
aspect ratios and picks its own resolution — ask for 1536×1024 and you may get
1672×941. Generate larger than you need and crop; never rely on getting the
dimensions you asked for.

**`case` and `field` are cut to the exact aspect of the surface they cover**, so
they are laid down as a single piece and never tile. Those are the two largest
areas on the board and a repeat would be obvious on both.

**`band`, `bone` and `ebony` DO tile, and were made seamless** by cross-fading
each tile's trailing edge back over its leading one. Generated material is never
exactly periodic, so a straight crop shows a hard seam at every repeat. The
script that does this is short and worth rewriting rather than hunting for:
crop, paste the tail over the head through a linear alpha ramp, save.

**Themes recolour these rather than replacing them.** `Tint` in `board/Board.tsx`
lays a white wash (changes lightness) and then a `color`-blended tint (changes
hue, keeps lightness) over each surface. That is why one set of swatches serves
the walnut, tournament-green and paper boards — and why a new theme needs
`--case-lift` / `--case-tint` / `--field-lift` / `--field-tint` rather than new
image files.

Keep the whole directory under about 300 KB. It is a desktop game, not a
texture demo.
