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

/** The wooden body, and the rounded-over outer arris that catches the light. */
function Case() {
  return (
    <g>
      <rect x="0" y="0" width={BOARD_W} height={BOARD_H} rx="0.2" fill="url(#wood)" />
      <rect
        x="0"
        y="0"
        width={BOARD_W}
        height={BOARD_H}
        rx="0.2"
        filter="url(#grain)"
        opacity="0.26"
        style={{ mixBlendMode: 'overlay' }}
      />
      {/* lit top-left arris */}
      <path
        d={`M 0.2 ${BOARD_H} L 0.2 0.2 Q 0.2 0.06 0.34 0.06 L ${BOARD_W - 0.2} 0.06`}
        fill="none"
        stroke="var(--frame-hi)"
        strokeOpacity="0.55"
        strokeWidth="0.045"
      />
      {/* shadowed bottom-right arris */}
      <path
        d={`M ${BOARD_W - 0.06} 0.2 L ${BOARD_W - 0.06} ${BOARD_H - 0.3} Q ${BOARD_W - 0.06} ${BOARD_H - 0.06} ${BOARD_W - 0.3} ${BOARD_H - 0.06} L 0.3 ${BOARD_H - 0.06}`}
        fill="none"
        stroke="#000"
        strokeOpacity="0.5"
        strokeWidth="0.06"
      />
    </g>
  )
}

/** The playing surface, before anything is inlaid into it. */
function Field() {
  return (
    <g>
      <rect x={FIELD_X} y={FIELD_Y} width={GEO.innerW} height={GEO.innerH} fill="var(--field)" />
      <rect
        x={FIELD_X}
        y={FIELD_Y}
        width={GEO.innerW}
        height={GEO.innerH}
        filter="url(#end-grain)"
        opacity="0.09"
        style={{ mixBlendMode: 'overlay' }}
      />
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
        return (
          <g key={p}>
            <path d={d} fill={`url(#point-${a ? 'a' : 'b'}-${g.top ? 'top' : 'bot'})`} />
            <path
              d={d}
              fill="none"
              stroke="var(--point-seam)"
              strokeOpacity="0.28"
              strokeWidth="0.014"
            />
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
      <rect x={x} y={FIELD_Y} width={GEO.barW} height={GEO.innerH} fill="url(#wood-bar)" />
      <rect
        x={x}
        y={FIELD_Y}
        width={GEO.barW}
        height={GEO.innerH}
        filter="url(#grain)"
        opacity="0.1"
        style={{ mixBlendMode: 'overlay' }}
      />
      {/* the field falls away into shadow on both sides of it */}
      <rect x={x - 0.09} y={FIELD_Y} width={GEO.barW + 0.18} height={GEO.innerH} fill="url(#edge-h)" />
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

/** The bear-off tray: a divider standing proud, and a well sunk behind it. */
function Tray() {
  const { innerH, trayW, trayDivider } = GEO
  const dx = FIELD_X + GEO.innerW
  return (
    <g>
      <rect x={dx} y={FIELD_Y} width={trayDivider} height={innerH} fill="url(#wood)" />
      <rect x={dx - 0.07} y={FIELD_Y} width={trayDivider + 0.14} height={innerH} fill="url(#edge-h)" />

      <rect x={TRAY_X} y={FIELD_Y} width={trayW} height={innerH} fill="var(--field)" />
      <rect
        x={TRAY_X}
        y={FIELD_Y}
        width={trayW}
        height={innerH}
        filter="url(#end-grain)"
        opacity="0.07"
        style={{ mixBlendMode: 'overlay' }}
      />
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

/** The khatam band, inset within the case edge on all four sides. */
function Inlay({ inset }: { inset: number }) {
  const w = GEO.inlayW
  return (
    <g>
      <rect x={inset} y={inset} width={BOARD_W - inset * 2} height={w} fill="url(#khatam-h)" />
      <rect
        x={inset}
        y={BOARD_H - inset - w}
        width={BOARD_W - inset * 2}
        height={w}
        fill="url(#khatam-h)"
      />
      <rect x={inset} y={inset} width={w} height={BOARD_H - inset * 2} fill="url(#khatam-v)" />
      <rect
        x={BOARD_W - inset - w}
        y={inset}
        width={w}
        height={BOARD_H - inset * 2}
        fill="url(#khatam-v)"
      />
      {/* the band is let into the timber, so it sits below the surface */}
      <rect
        x={inset}
        y={inset}
        width={BOARD_W - inset * 2}
        height={BOARD_H - inset * 2}
        fill="none"
        stroke="#000"
        strokeOpacity="0.4"
        strokeWidth="0.016"
      />
    </g>
  )
}
