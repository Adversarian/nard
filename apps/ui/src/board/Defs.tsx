import { BOARD_H, BOARD_W, FIELD_X, FIELD_Y, GEO } from './geometry'

/*
 * Real materials, photographed rather than computed.
 *
 * Wood, bone, ebony and khatam marquetry all have structure no amount of
 * turbulence reproduces — growth rings that wander and double back, the
 * mottling in a piece of bone, a brass wire catching light along one edge only.
 * The procedural versions were the single biggest reason the board read as a
 * diagram of a board rather than as a board.
 *
 * Provenance and licensing: assets/textures/PROVENANCE.md.
 *
 * The textures carry MATERIAL ONLY. Lighting is still drawn over them with the
 * gradients below, so the single upper-left light survives — they were prompted
 * flat and evenly lit for exactly that reason, because a photograph with its own
 * lighting baked in cannot be relit.
 */
import caseTex from '../assets/textures/case.webp'
import fieldTex from '../assets/textures/field.webp'
import bandTex from '../assets/textures/band.webp'
import boneTex from '../assets/textures/bone.webp'
import ebonyTex from '../assets/textures/ebony.webp'

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
/** The band tile's own aspect, so it is laid at its true proportions. */
const BAND_W = GEO.inlayW * (304 / 178)

export function BoardDefs() {
  return (
    <defs>
      {/* --- wood ------------------------------------------------------- */}
      {/*
        There is no procedural wood here any more.

        It went through a linear gradient, then two layers of multiplied
        turbulence, then hand-drawn growth rings pushed around by a displacement
        map — each better than the last, and none of them wood. Real timber has
        figure that doubles back on itself, and noise cannot produce that
        because noise has no memory. The photographed swatches above do the job
        in a fraction of the code; what is left here is the LIGHTING that gets
        laid over them.
      */}

      {/* --- relighting a photographed surface --------------------------- */}
      {/*
        Light ONLY: white on the side facing the lamp, black on the side facing
        away, nothing in between and no hue anywhere. Laid over a photographed
        material it relights it without recolouring it, which is what lets one
        walnut swatch serve a board lit from the upper left.
      */}
      <linearGradient id="lightsweep" x1="0.05" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.17" />
        <stop offset="0.32" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.7" stopColor="#000" stopOpacity="0.1" />
        <stop offset="1" stopColor="#000" stopOpacity="0.45" />
      </linearGradient>

      {/* The bar stands between two raised halves: lit on its left shoulder,
          falling away on the right, and darker overall than the case. */}
      <linearGradient id="bar-light" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.55" />
        <stop offset="0.13" stopColor="#fff" stopOpacity="0.13" />
        <stop offset="0.45" stopColor="#000" stopOpacity="0.12" />
        <stop offset="1" stopColor="#000" stopOpacity="0.6" />
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
        One tiling period of real marquetry, laid along each side of the case.
         rotates it for the left and right sides so the
        courses always run along the band rather than across it.

        The tile was made seamless by folding its trailing edge back over its
        leading one — generated material is never exactly periodic, and a
        straight crop shows a hard seam at every repeat.
      */}
      <pattern id="khatam-h" patternUnits="userSpaceOnUse" width={BAND_W} height={GEO.inlayW}>
        <image href={bandTex} width={BAND_W} height={GEO.inlayW} preserveAspectRatio="none" />
      </pattern>
      <pattern
        id="khatam-v"
        patternUnits="userSpaceOnUse"
        width={BAND_W}
        height={GEO.inlayW}
        patternTransform="rotate(90)"
      >
        <image href={bandTex} width={BAND_W} height={GEO.inlayW} preserveAspectRatio="none" />
      </pattern>

      {/* --- the case and the playing surface ---------------------------- */}
      {/* One piece of timber each, at that surface's own aspect ratio, so
          neither ever tiles and no seam can appear on the two largest areas of
          the board. */}
      <pattern id="tex-case" patternUnits="userSpaceOnUse" width={BOARD_W} height={BOARD_H}>
        <image href={caseTex} width={BOARD_W} height={BOARD_H} preserveAspectRatio="none" />
      </pattern>
      <pattern
        id="tex-field"
        patternUnits="userSpaceOnUse"
        width={GEO.innerW}
        height={GEO.innerH}
        x={FIELD_X}
        y={FIELD_Y}
      >
        <image href={fieldTex} width={GEO.innerW} height={GEO.innerH} preserveAspectRatio="none" />
      </pattern>

      {/* --- checker and die materials ----------------------------------- */}
      {/* Sized to about three checker diameters and anchored to the BOARD, not
          to each piece, so neighbouring checkers sample different parts of the
          material instead of showing thirty identical copies of one patch. */}
      <pattern id="tex-bone" patternUnits="userSpaceOnUse" width="2.4" height="2.4">
        <image href={boneTex} width="2.4" height="2.4" preserveAspectRatio="none" />
      </pattern>
      <pattern id="tex-ebony" patternUnits="userSpaceOnUse" width="2.4" height="2.4">
        <image href={ebonyTex} width="2.4" height="2.4" preserveAspectRatio="none" />
      </pattern>

      {/* --- points ----------------------------------------------------- */}
      {/*
        Points are STAINED BONE, not paint.
        The same bone the checkers are turned from, with the point colour
        multiplied over it — which is what dyeing bone actually does to it, and
        it leaves the mottling and the fine flecks showing through. Flat colour
        was the last synthetic surface on the board, and against real timber it
        was the only thing still reading as vector art.
        The colour comes from a token, so the other themes follow for free.
      */}
      {(['a', 'b'] as const).map((k) => (
        <pattern
          key={k}
          id={`mat-${k}`}
          patternUnits="userSpaceOnUse"
          width="2.4"
          height="2.4"
        >
          <image href={boneTex} width="2.4" height="2.4" preserveAspectRatio="none" />
          <rect
            width="2.4"
            height="2.4"
            style={{ fill: `var(--point-${k})`, mixBlendMode: 'multiply' }}
          />
        </pattern>
      ))}

      {/*
        Length falloff, as light rather than colour, so one pair of gradients
        serves both point colours and every theme.

        EXACTLY vertical — do not tilt. Gradients default to `objectBoundingBox`
        units, where x scales by the box width and y by the box height, and a
        point's box is four times taller than it is wide. The gradient VECTOR
        barely rotates under that, so a small sideways offset looks harmless
        when you write it; but the iso-lines run perpendicular to the vector and
        perpendicularity is NOT preserved by a non-uniform scale. Sixteen
        hundredths of sideways came out as a 33-degree shear, and every point
        wore a grey diagonal wash across its base.
      */}
      <linearGradient id="tipfade-top" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
        <stop offset="0.06" stopColor="#000" stopOpacity="0" />
        <stop offset="0.66" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.4" />
      </linearGradient>
      <linearGradient id="tipfade-bot" x1="0.5" y1="1" x2="0.5" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
        <stop offset="0.06" stopColor="#000" stopOpacity="0" />
        <stop offset="0.66" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.4" />
      </linearGradient>

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

