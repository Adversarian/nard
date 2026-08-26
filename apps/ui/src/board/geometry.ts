/**
 * Board geometry. Pure, no React, no DOM.
 *
 * Everything is expressed in *point widths* (`u = 1`). The SVG viewBox is sized
 * in these units, so the board scales to any pixel size without the proportions
 * in docs/design-language.md drifting.
 *
 * Point numbering is the engine's on-roll-relative numbering (AGENTS.md §5):
 * point 1 is the on-roll player's ace point, point 24 is furthest from home.
 * Their home board is the bottom-right quadrant by default.
 */

export const GEO = {
  /** Width of one point. The unit everything derives from. */
  u: 1,
  /**
   * Proportions are taken from a real board, not invented: a tournament board
   * has ~1.75in points, ~1.5in checkers, ~7in point length and a ~2in bar, on a
   * ~23x16in interior. Expressed in point-widths that is everything below, and
   * it is why the board reads as an object rather than as a diagram.
   */
  checkerD: 0.857,
  /** 4.67 checker diameters. Five checkers overhang very slightly — as they do
   *  on a real board. Do not "fix" this by lengthening the point. */
  pointH: 0.857 * 4.67,
  barW: 1.15,
  frame: 0.5,
  /** The khatam inlay band, set toward the inner edge of the case. */
  inlayW: 0.2,
  trayW: 1.05,
  trayDivider: 0.14,
  innerW: 12 + 1.15,
  innerH: 9.18,
} as const

export const BOARD_W =
  GEO.frame + GEO.innerW + GEO.trayDivider + GEO.trayW + GEO.frame
export const BOARD_H = GEO.frame + GEO.innerH + GEO.frame

export const FIELD_X = GEO.frame
export const FIELD_Y = GEO.frame
export const CHECKER_R = GEO.checkerD / 2

export type HomeSide = 'left' | 'right'

/**
 * Geometry is home-AGNOSTIC. It always describes the board with the player's
 * home on the right.
 *
 * `home: 'left'` is applied by mirroring the whole case in Board.tsx, which
 * moves the bear-off tray with it. Mirroring only the point columns — the
 * obvious approach, and the first one tried — leaves the tray on the far side
 * of the board from the home it belongs to.
 */

/** Column 0..11, left to right, skipping the bar. */
function columnX(col: number): number {
  return FIELD_X + col * GEO.u + (col >= 6 ? GEO.barW : 0) + GEO.u / 2
}

export interface PointGeom {
  x: number
  /** y of the point's base — the wide end, at the board edge. */
  baseY: number
  /** y of the apex — the tip, pointing into the middle. */
  apexY: number
  /** +1 when checkers stack downward (top row), -1 when upward (bottom row). */
  dir: 1 | -1
  top: boolean
}

/**
 * Geometry of point `p` (1..24).
 *
 * Points 1..12 occupy the bottom row right-to-left and 13..24 the top row
 * left-to-right — the standard layout, matching gnubg's own diagram. `home`
 * mirrors it horizontally for players who keep their home board on the left;
 * that is a user preference and is never tied to interface language.
 */
export function pointGeom(p: number): PointGeom {
  const top = p >= 13
  const col = top ? p - 13 : 12 - p
  return {
    x: columnX(col),
    baseY: top ? FIELD_Y : FIELD_Y + GEO.innerH,
    apexY: top ? FIELD_Y + GEO.pointH : FIELD_Y + GEO.innerH - GEO.pointH,
    dir: top ? 1 : -1,
    top,
  }
}

/** Triangle path for a point, with a slightly softened apex. */
export function pointPath(g: PointGeom): string {
  const half = GEO.u / 2
  const soft = 0.05 // real inlay is not razor-sharp; a hard tip reads as clip-art
  const tipY = g.apexY - g.dir * soft
  return [
    `M ${g.x - half} ${g.baseY}`,
    `L ${g.x - soft} ${tipY}`,
    `Q ${g.x} ${g.apexY} ${g.x + soft} ${tipY}`,
    `L ${g.x + half} ${g.baseY}`,
    'Z',
  ].join(' ')
}

/**
 * Up to five checkers sit at full diameter. Beyond that they compress to fit
 * rather than overflowing the point, down to a floor of 0.55 diameters — past
 * which the stack would read as a smear, so it truncates and shows a count chip.
 */
const MIN_SPACING = GEO.checkerD * 0.55

export function stackSpacing(count: number): number {
  if (count <= 5) return GEO.checkerD
  return Math.max(MIN_SPACING, (GEO.pointH - GEO.checkerD) / (count - 1))
}

/** Aspect ratio of the whole case, for sizing the SVG against the viewport. */
export const ASPECT = () => BOARD_W / BOARD_H

export function stackPlan(count: number): { drawn: number; chip: number } {
  const maxFitting = Math.floor((GEO.pointH - GEO.checkerD) / MIN_SPACING) + 1
  return count <= maxFitting ? { drawn: count, chip: 0 } : { drawn: maxFitting, chip: count }
}

/** Centre of the k-th checker (0 = nearest the board edge) on a point. */
export function checkerCentre(
  p: number,
  k: number,
  count: number,
): { x: number; y: number } {
  const g = pointGeom(p)
  return { x: g.x, y: g.baseY + g.dir * (CHECKER_R + k * stackSpacing(count)) }
}

export const BAR_X = FIELD_X + 6 * GEO.u + GEO.barW / 2
const BAR_MID = FIELD_Y + GEO.innerH / 2

/**
 * The player on roll stacks downward from just below the midline, the opponent
 * upward from just above it — how checkers actually sit on a physical bar.
 */
export function barCentre(k: number, onRoll: boolean): { x: number; y: number } {
  const gap = GEO.checkerD * 0.55
  const dir = onRoll ? 1 : -1
  return { x: BAR_X, y: BAR_MID + dir * (gap + CHECKER_R + k * GEO.checkerD) }
}

export const TRAY_X = FIELD_X + GEO.innerW + GEO.trayDivider
export const TRAY_CX = TRAY_X + GEO.trayW / 2

/**
 * A borne-off checker lies flat, so the tray reads as a stack of slabs rather
 * than a column of discs — the same visual language as a real board.
 */
export function offSlab(
  k: number,
  onRoll: boolean,
): { x: number; y: number; w: number; h: number } {
  const h = GEO.checkerD * 0.26
  const w = GEO.trayW * 0.8
  const pad = 0.16
  return {
    x: TRAY_CX - w / 2,
    w,
    h,
    y: onRoll
      ? FIELD_Y + GEO.innerH - pad - h - k * (h * 1.18)
      : FIELD_Y + pad + k * (h * 1.18),
  }
}
