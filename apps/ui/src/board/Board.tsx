import { BoardDefs } from './Defs'
import { HomeSideProvider } from './HomeSide'
import {
  BOARD_H,
  BOARD_W,
  FIELD_X,
  FIELD_Y,
  GEO,
  TRAY_X,
  offSlab,
  pointEdges,
  pointGeom,
  pointPath,
  type HomeSide,
} from './geometry'

/** How deep the walls of a recess read. One number, so every recess agrees. */
const WALL = 0.26

/**
 * The board itself: case, khatam band, playing field, points, bar and tray.
 *
 * Static — checkers, dice and the cube are drawn over it by the caller.
 *
 * Everything here obeys the single upper-left light described at the top of
 * Defs.tsx. The field is RECESSED, so its top and left inner walls are dark
 * and its bottom and right walls are lit; the case and the bar are RAISED, so
 * they are the other way round. That opposition is what gives the board depth,
 * and inverting one of them flattens the whole thing.
 */
export function Board({
  home = 'right',
  children,
  onFieldClick,
}: {
  home?: HomeSide
  children?: React.ReactNode
  /**
   * Clicking the board rolls, the way you pick the dice up rather than
   * travelling to a button.
   *
   * The handler belongs on the SVG root, not on the field rectangle: points and
   * checkers are painted above the field and are its SIBLINGS, so a click on
   * them never reaches it. Only passed when rolling is actually the move
   * available, so it cannot fight with picking a checker up.
   */
  onFieldClick?: () => void
}) {
  const inlayInset = (GEO.frame - GEO.inlayW) / 2

  return (
    <svg
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      /*
       * Sized by SVG's own preserveAspectRatio (`xMidYMid meet` is the
       * default), not by CSS. The board fills whatever box the parent gives it
       * and letterboxes itself inside it, centred, in both directions at once.
       *
       * The CSS approach this replaces — a `max-width: min(95vw, 90vh * ratio)`
       * — has to be retuned every time the chrome around the board changes
       * height, and silently overflows the window when it is wrong. The parent
       * needs `min-h-0` for this to work; a flex child defaults to its content
       * size and will refuse to shrink without it.
       */
      className="h-full w-full select-none"
      {...(onFieldClick ? { style: { cursor: 'pointer' } } : {})}
      role="img"
      aria-label="Backgammon board"
      {...(onFieldClick ? { onClick: onFieldClick } : {})}
    >
      <BoardDefs />
      <HomeSideProvider value={home}>
        {/*
          `home: 'left'` mirrors the ENTIRE case, so the bear-off tray travels
          with the home board it belongs beside. Mirroring only the point
          columns leaves the tray stranded on the far side, which is wrong on
          any real board. The two pieces of text inside (the cube value, stack
          count chips) counter-mirror themselves — see MirrorText.
        */}
        <g
          {...(home === 'left'
            ? { transform: `translate(${BOARD_W} 0) scale(-1 1)` }
            : {})}
        >
          {/*
            The filter wraps the STATIC case only.

            It used to wrap `children` too, which meant every checker that moved
            invalidated the cached filter result and re-ran a two-pass blur over
            the entire board — once per frame, per checker. Splitting them lets
            the browser rasterise the case once and never touch it again.
            Anything expensive added to this file belongs inside this group;
            anything that moves belongs outside it.
          */}
          <g filter="url(#board-shadow)">
            <Case />
            <Field />
            <Points />
            <Recess />
            <Bar />
            <Tray />
            <Inlay inset={inlayInset} />
          </g>

          {children}
        </g>
      </HomeSideProvider>
    </svg>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The wooden body.
 *
 * A photograph of walnut, relit. The texture is laid flat and then `lightsweep`
 * — pure white-to-black with no hue in it — supplies the single upper-left
 * light on top, so one swatch serves any lighting the board needs and the
 * material still reads as the same piece of timber across every theme.
 *
 * `Tint` is what makes the other two themes possible without three sets of
 * photographs: `color` blending takes hue and saturation from the tint and
 * LUMINOSITY from the wood underneath, so the grain survives being recoloured.
 */
function Case() {
  return (
    <g>
      <rect x="0" y="0" width={BOARD_W} height={BOARD_H} rx="0.2" fill="url(#tex-case)" />
      <Tint x={0} y={0} w={BOARD_W} h={BOARD_H} rx={0.2} kind="case" />
      <rect x="0" y="0" width={BOARD_W} height={BOARD_H} rx="0.2" fill="url(#lightsweep)" />
      {/* lit top-left arris */}
      <path
        d={`M 0.2 ${BOARD_H} L 0.2 0.2 Q 0.2 0.06 0.34 0.06 L ${BOARD_W - 0.2} 0.06`}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.16"
        strokeWidth="0.05"
      />
      {/* shadowed bottom-right arris */}
      <path
        d={`M ${BOARD_W - 0.06} 0.2 L ${BOARD_W - 0.06} ${BOARD_H - 0.3} Q ${BOARD_W - 0.06} ${BOARD_H - 0.06} ${BOARD_W - 0.3} ${BOARD_H - 0.06} L 0.3 ${BOARD_H - 0.06}`}
        fill="none"
        stroke="#000"
        strokeOpacity="0.5"
        strokeWidth="0.07"
      />
    </g>
  )
}

/**
 * Recolour a photographed surface for the current theme.
 *
 * Two layers, because one is not enough: `color` blending can change a
 * material's hue but never its lightness, so a near-black rosewood stays
 * near-black however it is tinted. `lift` is a plain white wash underneath it,
 * which is what lets the paper theme have a pale field at all.
 */
function Tint({
  x,
  y,
  w,
  h,
  rx = 0,
  kind,
}: {
  x: number
  y: number
  w: number
  h: number
  rx?: number
  kind: 'case' | 'field'
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill="#fff"
        style={{ opacity: `var(--${kind}-lift, 0)` }}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        style={{
          fill: `var(--${kind}-tint, transparent)`,
          opacity: `var(--${kind}-tint-a, 0)`,
          mixBlendMode: 'color',
        }}
      />
    </>
  )
}

/** The playing surface: dark polished rosewood, relit and tinted per theme. */
function Field() {
  return (
    <g>
      <rect x={FIELD_X} y={FIELD_Y} width={GEO.innerW} height={GEO.innerH} fill="url(#tex-field)" />
      <Tint x={FIELD_X} y={FIELD_Y} w={GEO.innerW} h={GEO.innerH} kind="field" />
      <rect x={FIELD_X} y={FIELD_Y} width={GEO.innerW} height={GEO.innerH} fill="url(#sheen)" />
    </g>
  )
}

/**
 * The twenty-four points.
 *
 * Each is filled with its sheen gradient and then outlined with a hairline in
 * `--point-seam`. The seam is the whole trick: marquetry has a visible join
 * where two pieces of veneer meet, and without it the points read as painted
 * onto the field rather than let into it. It is worth roughly nothing to draw
 * and is most of what separates this from a diagram.
 */
function Points() {
  return (
    <g>
      {Array.from({ length: 24 }, (_, i) => {
        const p = i + 1
        const g = pointGeom(p)
        // Alternate by board column so neighbours always differ, and the
        // pattern stays symmetric across the bar.
        const a = p % 2 === 1
        const d = pointPath(g)
        const e = pointEdges(g)
        return (
          <g key={p}>
            <path d={d} fill={`url(#mat-${a ? 'a' : 'b'})`} />
            <path d={d} fill={`url(#tipfade-${g.top ? 'top' : 'bot'})`} />
            {/* The bevel: lit slope, shadowed slope. One outline all the way
                round reads as an outline; two differently-lit edges read as a
                piece set into the field. */}
            <path d={e.lit} fill="none" stroke="var(--point-seam)" strokeOpacity="0.42" strokeWidth="0.014" />
            <path d={e.shade} fill="none" stroke="#000" strokeOpacity="0.34" strokeWidth="0.014" />
          </g>
        )
      })}
    </g>
  )
}

/**
 * The four inner walls of the well the field sits in.
 *
 * Drawn AFTER the points, so the shadow falls across the base of each point the
 * way it would on a real board. Top and left are dark, bottom and right are
 * lit — see the light model in Defs.tsx.
 */
function Recess() {
  const { innerW, innerH } = GEO
  return (
    <g>
      <rect x={FIELD_X} y={FIELD_Y} width={innerW} height={WALL} fill="url(#wall-top)" />
      <rect x={FIELD_X} y={FIELD_Y} width={WALL * 0.7} height={innerH} fill="url(#wall-left)" />
      <rect
        x={FIELD_X}
        y={FIELD_Y + innerH - WALL * 0.6}
        width={innerW}
        height={WALL * 0.6}
        fill="url(#wall-bottom)"
      />
      <rect
        x={FIELD_X + innerW - WALL * 0.5}
        y={FIELD_Y}
        width={WALL * 0.5}
        height={innerH}
        fill="url(#wall-right)"
      />
      {/* the crisp line where the veneer stops and the case begins */}
      <rect
        x={FIELD_X}
        y={FIELD_Y}
        width={innerW}
        height={innerH}
        fill="none"
        stroke="#000"
        strokeOpacity="0.55"
        strokeWidth="0.03"
      />
    </g>
  )
}

/** The bar: part of the case, standing proud of the field on both sides. */
function Bar() {
  const x = FIELD_X + 6 * GEO.u
  return (
    <g>
      <rect x={x} y={FIELD_Y} width={GEO.barW} height={GEO.innerH} fill="url(#tex-spine)" />
      <Tint x={x} y={FIELD_Y} w={GEO.barW} h={GEO.innerH} kind="case" />
      <rect x={x} y={FIELD_Y} width={GEO.barW} height={GEO.innerH} fill="url(#bar-light)" />
      <RaisedEdges left={x} right={x + GEO.barW} />
      {/* a brass wire down the centre, as on the case seam of a real board */}
      <line
        x1={x + GEO.barW / 2}
        y1={FIELD_Y + 0.2}
        x2={x + GEO.barW / 2}
        y2={FIELD_Y + GEO.innerH - 0.2}
        stroke="var(--inlay)"
        strokeWidth="0.01"
        opacity="0.25"
      />
    </g>
  )
}

/**
 * What a raised strip does to the field either side of it.
 *
 * The light is upper-left, so the strip casts to its RIGHT and the field on its
 * left is simply lit — it gets nothing but the hairline where the two meet.
 * Both marks sit entirely OUTSIDE the strip; the strip's own shading is its
 * own business. Anything that spans the strip and spills onto the field on both
 * sides paints a halo round it, which is what was here before.
 */
function RaisedEdges({ left, right }: { left: number; right: number }) {
  const reach = 0.22 // how far the cast shadow carries across the field
  return (
    <g>
      {/* the line where the field meets the strip's lit side */}
      <rect
        x={left - 0.02}
        y={FIELD_Y}
        width={0.02}
        height={GEO.innerH}
        fill="#000"
        opacity="0.4"
      />
      <rect x={right} y={FIELD_Y} width={reach} height={GEO.innerH} fill="url(#cast-right)" />
    </g>
  )
}

/** The bear-off tray: a divider standing proud, and a well sunk behind it. */
function Tray() {
  const { innerH, trayW, trayDivider } = GEO
  const dx = FIELD_X + GEO.innerW
  return (
    <g>
      <rect x={dx} y={FIELD_Y} width={trayDivider} height={innerH} fill="url(#tex-spine)" />
      <Tint x={dx} y={FIELD_Y} w={trayDivider} h={innerH} kind="case" />
      <RaisedEdges left={dx} right={dx + trayDivider} />

      <rect x={TRAY_X} y={FIELD_Y} width={trayW} height={innerH} fill="url(#tex-field)" />
      <Tint x={TRAY_X} y={FIELD_Y} w={trayW} h={innerH} kind="field" />
      <rect x={TRAY_X} y={FIELD_Y} width={trayW} height={innerH} fill="url(#well)" />
      {/* brass divider between the two players' halves of the tray */}
      <line
        x1={TRAY_X + 0.14}
        y1={FIELD_Y + innerH / 2}
        x2={TRAY_X + trayW - 0.14}
        y2={FIELD_Y + innerH / 2}
        stroke="var(--inlay)"
        strokeWidth="0.014"
        opacity="0.45"
      />
      {/*
        Counting ticks at five and ten, let into each half of the tray.
        The tray is empty for most of a game and was reading as a black slot
        cut in the side of the board. These give it a reason to be there and do
        a real job once it fills: five off and ten off are the two counts a
        player checks during a bear-off, and a tick means not counting slabs.
      */}
      {[5, 10].map((k) =>
        ([true, false] as const).map((mine) => {
          const slab = offSlab(k, mine)
          return (
            <line
              key={`${k}-${mine}`}
              x1={TRAY_X + 0.08}
              y1={slab.y + slab.h / 2}
              x2={TRAY_X + trayW - 0.08}
              y2={slab.y + slab.h / 2}
              stroke="var(--inlay)"
              strokeWidth="0.008"
              opacity="0.3"
            />
          )
        }),
      )}
    </g>
  )
}

/**
 * The khatam band, inset within the case edge on all four sides.
 *
 * MITRED AT THE CORNERS, like every piece of framing ever made. Each side is a
 * trapezoid whose ends are cut at 45 degrees, so the four bands meet corner to
 * corner instead of one running over another.
 *
 * They were four rectangles first, and the overlap at each corner is one of
 * those details that is invisible until you look and then impossible to unsee —
 * marquetry is cut and fitted, and butting one length over another is what a
 * printed border does. It costs four polygons instead of four rects.
 */
function Inlay({ inset }: { inset: number }) {
  const w = GEO.inlayW
  const x0 = inset
  const y0 = inset
  const x1 = BOARD_W - inset
  const y1 = BOARD_H - inset
  const poly = (pts: number[][]) => pts.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    /* `--inlay-band-a` lets a theme dial the ornament down without losing the
       trim entirely — the tournament board wants a line, not marquetry. */
    <g style={{ opacity: 'var(--inlay-band-a, 1)' }}>
      <polygon
        points={poly([[x0, y0], [x1, y0], [x1 - w, y0 + w], [x0 + w, y0 + w]])}
        fill="url(#khatam-h)"
      />
      <polygon
        points={poly([[x0, y1], [x1, y1], [x1 - w, y1 - w], [x0 + w, y1 - w]])}
        fill="url(#khatam-h)"
      />
      <polygon
        points={poly([[x0, y0], [x0, y1], [x0 + w, y1 - w], [x0 + w, y0 + w]])}
        fill="url(#khatam-v)"
      />
      <polygon
        points={poly([[x1, y0], [x1, y1], [x1 - w, y1 - w], [x1 - w, y0 + w]])}
        fill="url(#khatam-v)"
      />
      {/* the mitre joints themselves, as fine dark cuts */}
      {[
        [[x0, y0], [x0 + w, y0 + w]],
        [[x1, y0], [x1 - w, y0 + w]],
        [[x0, y1], [x0 + w, y1 - w]],
        [[x1, y1], [x1 - w, y1 - w]],
      ].map(([a, b], i) => (
        <line
          key={i}
          x1={a![0]}
          y1={a![1]}
          x2={b![0]}
          y2={b![1]}
          stroke="#000"
          strokeOpacity="0.45"
          strokeWidth="0.012"
        />
      ))}
      {/* the band is let into the timber, so it sits below the surface */}
      <rect
        x={x0}
        y={y0}
        width={x1 - x0}
        height={y1 - y0}
        fill="none"
        stroke="#000"
        strokeOpacity="0.4"
        strokeWidth="0.016"
      />
    </g>
  )
}
