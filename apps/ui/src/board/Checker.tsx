import { CHECKER_R, GEO } from './geometry'
import { MirrorText } from './MirrorText'

export type Side = 'light' | 'dark'

/**
 * A single checker: turned bone or ebony, seen from directly above, lit from
 * the upper-left like everything else on the board.
 *
 * The order below is the order a lathe would produce it, and every layer is
 * doing a job:
 *
 *   cast       the contact shadow. Soft, tight, warm — see below.
 *   wall       the cylindrical side, showing as a rim. Lit upper-left, dark
 *              lower-right. THIS is the layer that makes a checker read as an
 *              object; a rim of one flat colour cannot, at any width.
 *   face       the flat top, brightest toward the light.
 *   groove     the single turned ring a lathe leaves near the edge.
 *   dish       the shallow concavity in the middle. Its shading is INVERTED
 *              against the face, because a dish is a recess — see Defs.tsx.
 *   spec       a soft highlight bloom, not a drawn arc.
 *
 * What was here before was three concentric strokes and a hairline crescent,
 * which reads as a printed bullseye rather than a turned piece.
 *
 * No filters. Thirty of these animate at once and an feDropShadow on each was
 * measured at ~17fps; every effect here is a gradient, which costs nothing.
 */
export function Checker({ side }: { side: Side }) {
  const r = CHECKER_R
  const dark = side === 'dark'

  return (
    <g>
      {/* Warm and offset down-right, agreeing with the light. Slightly wider
          than the checker so the penumbra shows past the edge. */}
      <ellipse cx={r * 0.09} cy={r * 0.15} rx={r * 1.16} ry={r * 1.12} fill="url(#cast)" />

      <circle cx="0" cy="0" r={r} fill={`url(#rim-${side})`} />
      {/* A contour, so the lower-right edge still has a silhouette where the
          wall gradient goes darker than the point beneath it. */}
      <circle
        cx="0"
        cy="0"
        r={r - 0.006}
        fill="none"
        stroke={dark ? 'var(--checker-dark-rim)' : 'var(--checker-light-lo)'}
        strokeOpacity={dark ? 0.22 : 0.4}
        strokeWidth="0.012"
      />

      <circle cx="0" cy="0" r={r * 0.86} fill={`url(#face-${side})`} />

      {/* Ebony checkers carry one fine brass line let into the face.
          It is a legibility device before it is decoration: on the bar and on
          the bare field an ebony checker sits on ground close to its own
          value, and this is what holds it there. It is deliberately ONE line
          and a thin one — a heavy ring, or a second one on the rim, turns the
          whole set into bottle caps. Check the bar before weakening it. */}
      {dark && (
        <circle
          cx="0"
          cy="0"
          r={r * 0.72}
          fill="none"
          stroke="var(--checker-dark-rim)"
          strokeOpacity="0.32"
          strokeWidth="0.01"
        />
      )}

      {/* One groove, faint, and only on bone. Two concentric rings and the
          checker reads as a printed bullseye rather than a turned edge — which
          is why the ebony ones, which already carry the brass line above, do
          not get this as well. */}
      {!dark && (
        <circle
          cx="0"
          cy="0"
          r={r * 0.58}
          fill="none"
          stroke="var(--checker-light-edge)"
          strokeOpacity="0.3"
          strokeWidth="0.011"
        />
      )}

      <circle cx="0" cy="0" r={r * 0.5} fill={`url(#dish-${side})`} />

      <ellipse
        cx={-r * 0.3}
        cy={-r * 0.36}
        rx={r * 0.4}
        ry={r * 0.26}
        fill="url(#spec)"
        opacity={dark ? 0.35 : 0.7}
        transform={`rotate(-32 ${-r * 0.3} ${-r * 0.36})`}
      />
    </g>
  )
}

/**
 * A borne-off checker, lying flat in the tray.
 *
 * Checkers in the tray are stacked far tighter than on a point, so drawing them
 * as discs makes an overlapping smear. Lying flat is also what they actually do
 * on a real board — you can see the edge of each one in the stack, which is how
 * a player counts them without picking them up.
 */
export function Slab({ side }: { side: Side }) {
  const dark = side === 'dark'
  const w = GEO.trayW * 0.8
  const h = GEO.checkerD * 0.26
  const rx = h / 2.4
  return (
    <g>
      <rect x={-w / 2} y={-h / 2 + h * 0.28} width={w} height={h} rx={rx} fill="url(#cast)" opacity="0.7" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx} fill={`url(#rim-${side})`} />
      {/* the lit top arris of the disc's edge, which is what you actually see
          of a checker lying on its side */}
      <rect
        x={-w / 2 + h * 0.2}
        y={-h / 2 + h * 0.1}
        width={w - h * 0.4}
        height={h * 0.3}
        rx={h * 0.15}
        fill={dark ? 'var(--checker-dark-hi)' : '#fff'}
        opacity={dark ? 0.3 : 0.5}
      />
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={rx}
        fill="none"
        stroke={dark ? 'var(--checker-dark-rim)' : 'var(--checker-light-lo)'}
        strokeWidth="0.01"
        strokeOpacity="0.55"
      />
    </g>
  )
}

/** Shown on the top checker when a stack is too tall to draw in full. */
export function CountChip({ x, y, n }: { x: number; y: number; n: number }) {
  const r = CHECKER_R * 0.46
  return (
    <g>
      <circle cx={x} cy={y + r * 0.16} r={r * 1.2} fill="url(#cast)" />
      <circle cx={x} cy={y} r={r} fill="var(--inlay)" />
      <circle cx={x} cy={y} r={r} fill="url(#dish-light)" opacity="0.5" />
      <MirrorText
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={CHECKER_R * 0.62}
        fontWeight="700"
        fill="var(--app-bg)"
      >
        {n}
      </MirrorText>
    </g>
  )
}
