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
  /**
   * 4.9 checker diameters. Five checkers still overhang very slightly — as they
   * do on a real board — so do not "fix" that by lengthening it further.
   *
   * It was 4.67, which is the tournament-board figure, but measured against
   * how the best digital boards actually render the ratio is nearer 5.0. The
   * shortfall showed up twice: the points read stubby, and the open band
   * between opposing tips came to 1.38 checker diameters against the ~0.8 a
   * good board leaves — a strip of empty field across the middle that made the
   * board look sparser than it is.
   */
  pointH: 0.857 * 4.9,
  barW: 1.15,
  frame: 0.5,
  /**
   * The khatam inlay band, set toward the inner edge of the case.
   *
   * Real khatam borders (خاتم حاشیه) run 1–3cm on a ~50cm board, which is 2–6%
   * of its width. At 0.2 this band was 1.3% — narrower than any real one, and
   * the reason the motif had to be squeezed until it stopped reading.
   */
  inlayW: 0.28,
  trayW: 1.05,
  trayDivider: 0.14,
  innerW: 12 + 1.15,
  innerH: 9.18,
} as const

export const BOARD_W =
  GEO.frame + GEO.innerW + GEO.trayDivider + GEO.trayW + GEO.frame
export const BOARD_H = GEO.frame + GEO.innerH + GEO.frame

/** The bar, in the engine's numbering (AGENTS.md §5). */
export const BAR = 25

export const FIELD_X = GEO.frame
export const FIELD_Y = GEO.frame
export const CHECKER_R = GEO.checkerD / 2

export const TRAY_X = FIELD_X + GEO.innerW + GEO.trayDivider
export const TRAY_CX = TRAY_X + GEO.trayW / 2

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
  /*
   * Real inlay is not razor-sharp — a mathematically perfect point reads as
   * clip-art, and no craftsman cuts one. But this was 0.05, which is a tenth of
   * the point's width, and at any size worth looking at the tips came out blunt,
   * like fat fingers rather than veneer. A hint of relief, not a rounded end.
   */
  const soft = 0.022
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
 * The two sloping sides of a point, separately.
 *
 * A single outline round a shape reads as an outline; a piece let into a
 * surface has ONE side catching the light and the other in shadow, and that
 * difference is what says "inset" rather than "drawn on top". Under the board's
 * upper-left light the left-hand slope is the lit one.
 */
export function pointEdges(g: PointGeom): { lit: string; shade: string } {
  const half = GEO.u / 2
  const soft = 0.022
  const tipY = g.apexY - g.dir * soft
  return {
    lit: `M ${g.x - half} ${g.baseY} L ${g.x - soft} ${tipY}`,
    shade: `M ${g.x + half} ${g.baseY} L ${g.x + soft} ${tipY}`,
  }
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

/**
 * Which point a board coordinate falls in — the inverse of `pointGeom`.
 *
 * Returns 1..24 for a point, 25 for the bar, 0 for the bear-off tray, and null
 * for the frame or the space between. Used for dropping a dragged checker,
 * where the pointer can be anywhere and there is no element under it to ask.
 *
 * Coordinates must be in the BOARD's own space, after the `home: 'left'`
 * mirror has been applied — take them from `getScreenCTM()` on an element
 * inside the mirrored group, not on the <svg> root, or left-handed players
 * will drop checkers on the mirror image of the point they aimed at.
 */
export function pointAt(x: number, y: number): number | null {
  if (y < FIELD_Y || y > FIELD_Y + GEO.innerH) return null
  if (x >= TRAY_X && x <= TRAY_X + GEO.trayW) return 0

  const barStart = FIELD_X + 6 * GEO.u
  if (x >= barStart && x < barStart + GEO.barW) return BAR

  let col: number
  if (x >= FIELD_X && x < barStart) col = Math.floor((x - FIELD_X) / GEO.u)
  else if (x >= barStart + GEO.barW && x < FIELD_X + GEO.innerW) {
    col = 6 + Math.floor((x - barStart - GEO.barW) / GEO.u)
  } else return null
  if (col < 0 || col > 11) return null

  return y < FIELD_Y + GEO.innerH / 2 ? col + 13 : 12 - col
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
