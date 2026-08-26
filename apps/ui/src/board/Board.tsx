import { BoardDefs } from './Defs'
import { HomeSideProvider } from './HomeSide'
import {
  BOARD_H,
  BOARD_W,
  FIELD_X,
  FIELD_Y,
  GEO,
  TRAY_X,
  pointGeom,
  pointPath,
  type HomeSide,
} from './geometry'

/**
 * The board itself: case, khatam band, playing field, points, bar and tray.
 *
 * Static — checkers, dice and the cube are drawn over it by the caller. Keeping
 * the surface separate means the expensive-looking parts render once and the
 * moving parts stay cheap to animate.
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
      className="h-auto w-full max-w-[min(95vw,calc(90vh*1.51))] select-none"
      role="img"
      aria-label="Backgammon board"
      {...(onFieldClick
        ? { onClick: onFieldClick, style: { cursor: 'pointer' } }
        : {})}
    >
      <BoardDefs />
      <HomeSideProvider value={home}>

      {/*
        `home: 'left'` mirrors the ENTIRE case, so the bear-off tray travels with
        the home board it belongs beside. Mirroring only the point columns leaves
        the tray stranded on the far side, which is wrong on any real board.
        The two pieces of text inside (the cube value, stack count chips)
        counter-mirror themselves — see MirrorText.
      */}
      <g
        filter="url(#board-shadow)"
        {...(home === 'left'
          ? { transform: `translate(${BOARD_W} 0) scale(-1 1)` }
          : {})}
      >
        {/* case */}
        <rect
          x="0"
          y="0"
          width={BOARD_W}
          height={BOARD_H}
          rx="0.14"
          fill="url(#wood)"
        />
        <rect
          x="0"
          y="0"
          width={BOARD_W}
          height={BOARD_H}
          rx="0.14"
          filter="url(#grain)"
          opacity="0.14"
          style={{ mixBlendMode: 'overlay' }}
        />

        {/* khatam band, inset within the case edge */}
        <g>
          <rect
            x={inlayInset}
            y={inlayInset}
            width={BOARD_W - inlayInset * 2}
            height={GEO.inlayW}
            fill="url(#khatam-h)"
          />
          <rect
            x={inlayInset}
            y={BOARD_H - inlayInset - GEO.inlayW}
            width={BOARD_W - inlayInset * 2}
            height={GEO.inlayW}
            fill="url(#khatam-h)"
          />
          <rect
            x={inlayInset}
            y={inlayInset}
            width={GEO.inlayW}
            height={BOARD_H - inlayInset * 2}
            fill="url(#khatam-v)"
          />
          <rect
            x={BOARD_W - inlayInset - GEO.inlayW}
            y={inlayInset}
            width={GEO.inlayW}
            height={BOARD_H - inlayInset * 2}
            fill="url(#khatam-v)"
          />
          {/* brass hairlines framing the band */}
          <rect
            x={inlayInset}
            y={inlayInset}
            width={BOARD_W - inlayInset * 2}
            height={BOARD_H - inlayInset * 2}
            fill="none"
            stroke="var(--inlay)"
            strokeWidth="0.012"
            opacity="0.7"
          />
        </g>

        {/* playing field */}
        <rect
          x={FIELD_X}
          y={FIELD_Y}
          width={GEO.innerW}
          height={GEO.innerH}
          fill="var(--field)"
        />
        <rect
          x={FIELD_X}
          y={FIELD_Y}
          width={GEO.innerW}
          height={GEO.innerH}
          filter="url(#felt)"
          opacity="0.055"
          style={{ mixBlendMode: 'overlay' }}
        />

        {/* points */}
        <g>
          {Array.from({ length: 24 }, (_, i) => {
            const p = i + 1
            const g = pointGeom(p)
            // Alternate by board column so neighbours always differ, and the
            // pattern stays symmetric across the bar.
            const a = p % 2 === 1
            const fill = `url(#point-${a ? 'a' : 'b'}-${g.top ? 'top' : 'bot'})`
            return <path key={p} d={pointPath(g)} fill={fill} />
          })}
        </g>

        {/* bar — part of the case, standing proud of the field */}
        <g>
          <rect
            x={FIELD_X + 6 * GEO.u}
            y={FIELD_Y}
            width={GEO.barW}
            height={GEO.innerH}
            fill="url(#wood-bar)"
          />
          <rect
            x={FIELD_X + 6 * GEO.u}
            y={FIELD_Y}
            width={GEO.barW}
            height={GEO.innerH}
            filter="url(#grain)"
            opacity="0.16"
            style={{ mixBlendMode: 'overlay' }}
          />
          {/* the field falls away on both sides of it */}
          <rect
            x={FIELD_X + 6 * GEO.u - 0.05}
            y={FIELD_Y}
            width={GEO.barW + 0.1}
            height={GEO.innerH}
            fill="url(#edge-h)"
          />
        </g>

        {/* tray: a divider standing proud, and a well sunk behind it */}
        <g>
          <rect
            x={FIELD_X + GEO.innerW}
            y={FIELD_Y}
            width={GEO.trayDivider}
            height={GEO.innerH}
            fill="url(#wood)"
          />
          <rect
            x={FIELD_X + GEO.innerW - 0.05}
            y={FIELD_Y}
            width={GEO.trayDivider + 0.1}
            height={GEO.innerH}
            fill="url(#edge-h)"
          />
          <rect
            x={TRAY_X}
            y={FIELD_Y}
            width={GEO.trayW}
            height={GEO.innerH}
            fill="var(--frame)"
            opacity="0.35"
          />
          <rect
            x={TRAY_X}
            y={FIELD_Y}
            width={GEO.trayW}
            height={GEO.innerH}
            filter="url(#felt)"
            opacity="0.06"
            style={{ mixBlendMode: 'overlay' }}
          />
          <rect
            x={TRAY_X}
            y={FIELD_Y}
            width={GEO.trayW}
            height={GEO.innerH}
            fill="url(#well)"
          />
          {/* brass divider between the two players' trays */}
          <line
            x1={TRAY_X + 0.12}
            y1={FIELD_Y + GEO.innerH / 2}
            x2={TRAY_X + GEO.trayW - 0.12}
            y2={FIELD_Y + GEO.innerH / 2}
            stroke="var(--inlay)"
            strokeWidth="0.014"
            opacity="0.5"
          />
        </g>

        {/* inner edge shadow, so the field sits inside the case */}
        <rect
          x={FIELD_X}
          y={FIELD_Y}
          width={GEO.innerW}
          height={GEO.innerH}
          fill="none"
          stroke="#000"
          strokeOpacity="0.45"
          strokeWidth="0.045"
        />

        {children}
      </g>
      </HomeSideProvider>
    </svg>
  )
}
