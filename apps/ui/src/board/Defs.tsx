import { GEO } from './geometry'

/**
 * Shared SVG materials: wood, khatam inlay, turned checkers, dice, shadows.
 *
 * Everything is procedural — no image assets. Colours resolve from the theme
 * tokens in styles/theme.css, so one set of defs serves every theme.
 *
 * ---------------------------------------------------------------------------
 * THE LIGHT MODEL — read this before adding anything here.
 *
 * There is ONE light, upper-left, high. Every shadow, bevel and highlight in
 * this app obeys it, and that consistency is most of what separates a rendered
 * object from a diagram. It has two consequences, and they are opposites:
 *
 *   RAISED (the case, the bar, a checker)
 *     top and left edges catch the light; bottom and right edges fall away;
 *     a cast shadow lands down-and-right of the object.
 *
 *   RECESSED (the playing field, the tray well, a drilled pip)
 *     the top and left INNER walls are in shadow — they face away from the
 *     light; the bottom and right inner walls are lit.
 *
 * Get that backwards on one element and the whole board flattens out, because
 * the eye reads the inconsistency long before it can name it.
 * ---------------------------------------------------------------------------
 *
 * PERFORMANCE. Filters here are for the STATIC board only. An SVG filter
 * re-rasterises its whole subtree whenever anything inside it changes, so a
 * filter anywhere above a moving checker costs a full board re-render per
 * frame. Moving parts use gradients — which are free — and never filters.
 * See Board.tsx, where the case is filtered and the children deliberately are
 * not.
 */
export function BoardDefs() {
  return (
    <defs>
      {/* --- wood ------------------------------------------------------- */}
      {/*
        The case is lit from above-left, so the face carries a diagonal
        gradient rather than a vertical one. Three stops, not two: real timber
        under a single light has a bright shoulder well before the edge.
      */}
      <linearGradient id="wood" x1="0.05" y1="0" x2="0.85" y2="1">
        <stop offset="0" stopColor="var(--frame-hi)" />
        <stop offset="0.28" stopColor="var(--frame)" />
        <stop offset="0.78" stopColor="var(--frame)" />
        <stop offset="1" stopColor="var(--frame-lo)" />
      </linearGradient>

      {/*
        Grain, in two layers, because one never reads as wood.
        `figure` is the broad tonal drift of a sawn plank; `pore` is the fine
        line structure on top of it. Both are stretched hard along the grain
        direction — the anisotropy IS the effect.

        The colour matrix pushes the red channel into all three and pins alpha
        to 1, so what comes out is predictable grey the overlay blend can act
        on. Turbulence varies alpha too, and leaving that in gives a blotchy
        result that reads as dirt rather than grain.
      */}
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.05 1.1" numOctaves="3" seed="7" result="figure" />
        <feTurbulence type="fractalNoise" baseFrequency="0.35 9" numOctaves="2" seed="11" result="pore" />
        <feBlend in="figure" in2="pore" mode="multiply" result="mixed" />
        <feColorMatrix
          in="mixed"
          type="matrix"
          values="1 0 0 0 0
                  1 0 0 0 0
                  1 0 0 0 0
                  0 0 0 0 1"
        />
        <feComponentTransfer>
          <feFuncR type="linear" slope="2.2" intercept="-0.55" />
          <feFuncG type="linear" slope="2.2" intercept="-0.55" />
          <feFuncB type="linear" slope="2.2" intercept="-0.55" />
        </feComponentTransfer>
      </filter>

      {/*
        Field texture: fine and isotropic.

        NOT felt, despite what this used to be called. A khatam board has no
        cloth on it anywhere — the playing surface is polished wood or khatam
        under several coats of lacquer, mirror-finished, and the only felt on the
        object is glued under the checkers. Every piece of khatam is also cut
        ACROSS the rod, so what you see is end grain: a tight uniform speckle,
        never long figure. Hence isotropic noise here and directional grain only
        on the case.
      */}
      <filter id="end-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="7" numOctaves="3" seed="3" />
        <feColorMatrix
          type="matrix"
          values="1 0 0 0 0
                  1 0 0 0 0
                  1 0 0 0 0
                  0 0 0 0 1"
        />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.6" intercept="-0.3" />
          <feFuncG type="linear" slope="1.6" intercept="-0.3" />
          <feFuncB type="linear" slope="1.6" intercept="-0.3" />
        </feComponentTransfer>
      </filter>

      {/* The bar stands between two raised halves, so it takes light on its
          left shoulder and falls into shadow on the right. */}
      <linearGradient id="wood-bar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--frame-lo)" />
        <stop offset="0.13" stopColor="var(--frame-hi)" />
        <stop offset="0.45" stopColor="var(--frame)" />
        <stop offset="1" stopColor="var(--frame-lo)" />
      </linearGradient>

      {/* --- inset walls ------------------------------------------------ */}
      {/*
        The four inner walls of a recess, as gradients rather than a filter.
        An feDropShadow-based inner shadow would be one more filter over the
        board; four strips cost nothing and let the lit walls differ from the
        shadowed ones, which a symmetric blur cannot do.
      */}
      <linearGradient id="wall-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.72" />
        <stop offset="0.45" stopColor="#000" stopOpacity="0.18" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="wall-left" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.6" />
        <stop offset="0.5" stopColor="#000" stopOpacity="0.14" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      {/*
        The lit walls are FAINT. A recess's far wall catches a glancing light,
        not a full one, and at anything above about 0.2 the highlight stops
        reading as a wall and starts reading as grey haze laid over the base of
        every point — which is what it did at 0.5.
      */}
      <linearGradient id="wall-bottom" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="var(--frame-hi)" stopOpacity="0.18" />
        <stop offset="0.7" stopColor="var(--frame-hi)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="wall-right" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor="var(--frame-hi)" stopOpacity="0.15" />
        <stop offset="0.7" stopColor="var(--frame-hi)" stopOpacity="0" />
      </linearGradient>

      {/* Raised edges: bright lip on the lit side, dark on the far side. */}
      <linearGradient id="edge-h" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--frame-hi)" stopOpacity="0.55" />
        <stop offset="0.1" stopColor="#000" stopOpacity="0" />
        <stop offset="0.9" stopColor="#000" stopOpacity="0.35" />
        <stop offset="1" stopColor="#000" stopOpacity="0.7" />
      </linearGradient>

      {/* The tray well, sunk deepest of anything on the board. */}
      <linearGradient id="well" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.68" />
        <stop offset="0.22" stopColor="#000" stopOpacity="0.24" />
        <stop offset="0.8" stopColor="#000" stopOpacity="0.1" />
        <stop offset="1" stopColor="#000" stopOpacity="0.3" />
      </linearGradient>

      {/* --- khatam inlay ---------------------------------------------- */}
      {/*
        Brass is the BRIGHTEST material on a khatam surface — brighter than the
        bone — and the only one with a specular. Flat mid-gold is the documented
        failure mode; it is what a printed imitation looks like. So the wire
        gets a highlight across its width rather than a single fill, and it is
        thin and bright rather than thin and dim.
      */}
      <linearGradient id="brass-wire" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--khatam-brass-lo)" />
        <stop offset="0.38" stopColor="var(--khatam-brass-hi)" />
        <stop offset="0.62" stopColor="var(--khatam-brass)" />
        <stop offset="1" stopColor="var(--khatam-brass-lo)" />
      </linearGradient>
      {/*
        Khatam-kari is built from bundled rods of bone, ebony and brass wire,
        sliced across the bundle — so the motif is always a tight tessellation
        of small triangles around a star, never a printed-looking repeat. At
        the width this band actually renders (a couple of dozen pixels) the
        readable unit is a chain of six-point stars, so that is what this draws:
        bone stars on ebony, brass wire between them, and a hairline of brass
        top and bottom where the band meets the timber.

        The old band was a one-way sawtooth. It read as a zigzag ribbon, which
        is a printed border, not marquetry — the giveaway was that every
        triangle pointed the same way.
      */}
      {khatamBand('khatam-h', false)}
      {khatamBand('khatam-v', true)}

      {/* --- points ----------------------------------------------------- */}
      {/*
        Two effects, both subtle, and the board dies without either:

        `sheen` is a lengthwise falloff — an inlaid point is a flat piece of
        veneer catching a raking light, brightest where it meets the frame.

        The seam is drawn in Board.tsx as a hairline stroke. Real marquetry
        has a visible join line where two pieces of veneer meet; without it
        the points read as painted onto the field rather than let into it.
      */}
      {pointSheen('point-a', 'var(--point-a)', 'var(--point-a-lo)')}
      {pointSheen('point-b', 'var(--point-b)', 'var(--point-b-lo)')}

      {/* --- checkers --------------------------------------------------- */}
      {/*
        A turned checker seen from directly above shows three things: the
        cylindrical wall as a rim, the flat top face, and the dish turned into
        it. The rim is the one that matters — it is lit on the upper-left and
        dark on the lower-right, and that single gradient is what stops the
        checker reading as a sticker. A uniform stroke, which is what was here
        before, cannot do it at any width.
      */}
      {checkerMaterial('light')}
      {checkerMaterial('dark')}

      {/* Contact shadow. Soft, tight, and warm rather than black — a black
          shadow on a warm board reads as a hole punched through it. */}
      <radialGradient id="cast" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="var(--shadow)" stopOpacity="0.55" />
        <stop offset="0.55" stopColor="var(--shadow)" stopOpacity="0.34" />
        <stop offset="1" stopColor="var(--shadow)" stopOpacity="0" />
      </radialGradient>

      {/* A broad, soft sheen for the playing surface. Lacquered wood catches
          light; a wholly matte field reads as card. Kept very low — this is a
          sheen, not a gloss. */}
      <radialGradient id="sheen" cx="0.3" cy="0.18" r="0.85">
        <stop offset="0" stopColor="#fff" stopOpacity="0.05" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.015" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>

      {/* Specular bloom: a soft blob, not a hairline arc. Polished bone has a
          broad highlight; a thin crescent reads as a drawn outline. */}
      <radialGradient id="spec" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0.16" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>

      {/* --- dice and cube ---------------------------------------------- */}
      {dieMaterial('light')}
      {dieMaterial('dark')}
      <linearGradient id="cube-face" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="var(--checker-light)" />
        <stop offset="0.6" stopColor="var(--checker-light)" />
        <stop offset="1" stopColor="var(--checker-light-edge)" />
      </linearGradient>

      {/* A drilled pip: dark at the top-left where the wall shades it, and
          catching light on the lower-right wall. Recessed, so the opposite of
          a checker — see the light model at the top of this file. */}
      <radialGradient id="pip-dark" cx="0.34" cy="0.3" r="0.78">
        <stop offset="0" stopColor="var(--pip-deep)" />
        <stop offset="0.62" stopColor="var(--pip-deep)" />
        <stop offset="1" stopColor="var(--pip-lit)" />
      </radialGradient>
      <radialGradient id="pip-light" cx="0.34" cy="0.3" r="0.78">
        <stop offset="0" stopColor="var(--checker-light-edge)" />
        <stop offset="0.62" stopColor="var(--checker-light)" />
        <stop offset="1" stopColor="#fff" />
      </radialGradient>

      {/* --- board shadow ----------------------------------------------- */}
      {/* Two-part: a tight dark contact shadow and a wide soft ambient one.
          A single blur reads as a sticker with a glow; the pair reads as an
          object resting on a surface. */}
      <filter id="board-shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="0.09" stdDeviation="0.1" floodColor="#000" floodOpacity="0.7" result="tight" />
        <feDropShadow in="tight" dx="0" dy="0.55" stdDeviation="0.85" floodColor="#000" floodOpacity="0.5" />
      </filter>
    </defs>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * One point's fill. `top` and `bot` differ only in which end the sheen starts
 * from — the light does not flip when the point does, so the base is bright in
 * both cases and the tip falls away.
 */
function pointSheen(id: string, base: string, low: string) {
  /*
   * The gradient runs along the point's AXIS, base to tip, and is EXACTLY
   * vertical. Do not tilt it.
   *
   * Tilting it to pick up the same upper-left light as the rest of the board
   * is the obvious thing to try, and it fails in a way worth writing down.
   * Gradients default to `objectBoundingBox` units, where x is scaled by the
   * box width and y by the box height — and a point's box is about four times
   * taller than it is wide. The gradient VECTOR barely rotates under that
   * scaling, so `x1=0.42 x2=0.58` looks nearly vertical when you write it; but
   * the iso-lines run perpendicular to the vector, and perpendicularity is not
   * preserved by a non-uniform scale. Those 0.16 units of sideways offset came
   * out as a 33-degree shear, and every point got a grey diagonal wash across
   * its base.
   *
   * The lip itself is a hairline. At 0.14 of the length it covered half a
   * checker and read as haze rather than as an edge.
   */
  const lip = 0.055
  const stops = (
    <>
      <stop offset="0" stopColor="var(--point-hi)" stopOpacity="0.16" />
      <stop offset={lip} stopColor={base} />
      <stop offset="0.66" stopColor={base} />
      <stop offset="1" stopColor={low} />
    </>
  )
  return (
    <>
      <linearGradient id={`${id}-top`} x1="0.5" y1="0" x2="0.5" y2="1" key={`${id}-top`}>
        {stops}
      </linearGradient>
      <linearGradient id={`${id}-bot`} x1="0.5" y1="1" x2="0.5" y2="0" key={`${id}-bot`}>
        {stops}
      </linearGradient>
    </>
  )
}

/** Rim, face and dish for one checker colour. */
function checkerMaterial(side: 'light' | 'dark') {
  const dark = side === 'dark'
  // Keys are prefixed by what they belong to. `key={side}` on both this and
  // dieMaterial put two children called "light" and two called "dark" in the
  // same <defs>, and React's warning for that says it may OMIT one — which for
  // a gradient definition means a material silently missing from the board.
  return (
    <g key={`checker-${side}`}>
      {/*
        The cylindrical wall, lit upper-left.

        Ebony takes a NARROW catch and then goes dark fast. Carrying the brass
        rim colour across a third of this gradient — which is what it did
        first — put a gold arc round every dark checker, and thirty of them
        read as bottle caps rather than as a set of pieces.
      */}
      <linearGradient id={`rim-${side}`} x1="0.12" y1="0.05" x2="0.88" y2="0.95">
        <stop offset="0" stopColor={dark ? 'var(--checker-dark-hi)' : '#fff'} />
        <stop offset={dark ? '0.16' : '0.3'} stopColor={dark ? 'var(--checker-dark)' : 'var(--checker-light)'} />
        <stop offset="0.62" stopColor={dark ? 'var(--checker-dark)' : 'var(--checker-light-edge)'} />
        <stop offset="1" stopColor={dark ? 'var(--checker-dark-lo)' : 'var(--checker-light-lo)'} />
      </linearGradient>
      {/*
        The top face — bright toward the light, and never fully even.

        Ebony's catch is TIGHT. Carrying the warm rim colour a third of the way
        across the face turned the middle of every dark checker into a brown
        blob; the specular bloom is what lights it, not the base gradient.
      */}
      <radialGradient id={`face-${side}`} cx="0.35" cy="0.28" r="0.85">
        <stop offset="0" stopColor={dark ? 'var(--checker-dark-hi)' : '#fff'} />
        <stop offset={dark ? '0.2' : '0.42'} stopColor={dark ? 'var(--checker-dark)' : 'var(--checker-light)'} />
        <stop offset="1" stopColor={dark ? 'var(--checker-dark-lo)' : 'var(--checker-light-edge)'} />
      </radialGradient>
      {/* The dish. Concave, so its lighting is inverted against the face. */}
      {/*
        Turned bone is matte. A strong dish plus a strong specular domes the
        checker and it reads as a pearl; this is deliberately just enough to
        say the middle is not flat.
      */}
      <radialGradient id={`dish-${side}`} cx="0.66" cy="0.72" r="0.8">
        <stop offset="0" stopColor="#fff" stopOpacity={dark ? 0.07 : 0.2} />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity={dark ? 0.22 : 0.1} />
      </radialGradient>
    </g>
  )
}

function dieMaterial(side: 'light' | 'dark') {
  const dark = side === 'dark'
  return (
    <linearGradient id={`die-${side}`} x1="0.05" y1="0" x2="0.95" y2="1" key={`die-${side}`}>
      <stop offset="0" stopColor={dark ? 'var(--checker-dark-hi)' : '#fff'} />
      <stop offset="0.3" stopColor={dark ? 'var(--checker-dark)' : 'var(--checker-light)'} />
      <stop offset="1" stopColor={dark ? 'var(--checker-dark-lo)' : 'var(--checker-light-edge)'} />
    </linearGradient>
  )
}

/**
 * The khatam band: two courses of bone and brass lozenges on ebony, with brass
 * wire between and either side.
 *
 * Khatam-kari is built by bundling rods of bone, ebony and brass wire and
 * slicing across the bundle, so the motif is always a tight tessellation of
 * small pieces rather than a printed-looking repeat. A lozenge chain is the
 * canonical BORDER product (خاتم حاشیه) — deliberately simpler and narrower
 * than the field work — so this is the right motif for this location and not a
 * compromise for want of pixels.
 *
 * TWO COURSES, not one. Real borders run 2–6% of a board's width, and this band
 * was widened to reach that; scaling one chain up to fill it made the lozenges
 * bigger, and the band stopped reading as inlay and started reading as a gold
 * chain hung round the board — the loudest thing on screen, competing with the
 * checkers. Khatam is FINE work: the honest way to fill a wider band is more
 * courses of small pieces, which is also what the real thing does. The second
 * course is offset half a pitch so the two interlock rather than striping.
 *
 * `vertical` rotates the tile for the left and right sides of the case.
 */
function khatamBand(id: string, vertical: boolean) {
  const w = GEO.inlayW // across the band
  const wire = w * 0.05 // brass, three of them: top, middle, bottom
  const course = (w - wire * 3) / 2
  const pitch = course * 0.95 // near-equilateral lozenges

  const lozenge = (cx: number, cy: number) =>
    [
      `${cx},${cy - course / 2}`,
      `${cx + pitch / 2},${cy}`,
      `${cx},${cy + course / 2}`,
      `${cx - pitch / 2},${cy}`,
    ].join(' ')

  const rowY = (n: 0 | 1) => wire + course / 2 + n * (course + wire)

  return (
    <pattern
      id={id}
      key={id}
      patternUnits="userSpaceOnUse"
      width={pitch * 2}
      height={w}
      {...(vertical ? { patternTransform: 'rotate(90)' } : {})}
    >
      <rect width={pitch * 2} height={w} fill="var(--khatam-ground)" />
      <polygon points={lozenge(pitch * 0.5, rowY(0))} fill="var(--khatam-bone)" />
      <polygon points={lozenge(pitch * 1.5, rowY(0))} fill="var(--khatam-brass)" />
      {/* offset half a pitch, so the courses interlock instead of striping */}
      <polygon points={lozenge(0, rowY(1))} fill="var(--khatam-brass)" />
      <polygon points={lozenge(pitch, rowY(1))} fill="var(--khatam-bone)" />
      <polygon points={lozenge(pitch * 2, rowY(1))} fill="var(--khatam-brass)" />
      <rect width={pitch * 2} height={wire} fill="url(#brass-wire)" />
      <rect y={wire + course} width={pitch * 2} height={wire} fill="url(#brass-wire)" />
      <rect y={w - wire} width={pitch * 2} height={wire} fill="url(#brass-wire)" />
    </pattern>
  )
}
