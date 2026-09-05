import type { Hop } from '@nard/engine'
import {
  BAR,
  CHECKER_R,
  FIELD_X,
  FIELD_Y,
  GEO,
  TRAY_CX,
  TRAY_X,
  checkerCentre,
  pointGeom,
  pointPath,
} from './geometry'
import { MirrorText } from './MirrorText'

/**
 * Hit targets and affordances.
 *
 * Deliberately quiet. A strong player does not need the board lit up — he can
 * see the legal moves. Highlighting exists to make the mechanics unambiguous,
 * not to teach, so nothing here says whether a move is GOOD.
 *
 * Two marks, and the distinction between them is the whole grammar:
 *
 *   a filled DOT  — this landing is quiet, the point is open or yours
 *   an open RING  — this landing HITS; there is a blot on it
 *
 * Chess.com and lichess arrived at that pair independently, which is about as
 * close to a settled convention as board-game interfaces have. Backgammon
 * needs it more than chess does, because a destination there is a function of
 * which die you spend — so each mark also carries the die it would spend. That
 * is mechanical information the player would otherwise have to derive, not
 * advice about what to play.
 *
 * Hit areas are half-height columns rather than the point triangles themselves,
 * because a triangle is a miserable click target near its tip and checkers
 * routinely sit outside it. They carry `data-point` so `pnpm pointer` can drive
 * the board with real mouse events — see tools/pointer.ts, and note that no
 * other harness here touches the DOM at all, which is how drag-and-drop came to
 * be missing entirely without a single test noticing.
 */
export function Interaction({
  movable,
  hops,
  selected,
  counts,
  dragOver,
  hover,
  onHover,
  onDrop,
  onStartDrag,
}: {
  movable: readonly number[]
  /** Where the picked-up checker may go, with the die each landing spends. */
  hops: readonly Hop[]
  selected: number | null
  /** Checkers currently on each point, for placing the marks on the stack. */
  counts: Readonly<Record<number, number>>
  /** The destination a dragged checker is currently over, if any. */
  dragOver: number | null
  /**
   * The point under the cursor. Owned by the caller rather than kept here,
   * because the CHECKER layer needs it too — a checker you can pick up lifts a
   * little under the cursor, and that layer is this one's sibling.
   */
  hover: number | null
  onHover: (point: number | null) => void
  onDrop: (point: number) => void
  onStartDrag: (from: number, event: React.PointerEvent<SVGElement>) => void
}) {
  const half = GEO.innerH / 2
  const destinations = hops.map((h) => h.to)
  /**
   * When there is nothing to pick up or drop, the hit areas step aside.
   *
   * They tile the whole field, so leaving them live would swallow a click meant
   * for the board underneath — which is how you roll.
   */
  const interactive = movable.length > 0 || destinations.length > 0
  const lit = dragOver ?? hover

  const press = (p: number) => (event: React.PointerEvent<SVGElement>) => {
    // Dropping wins over picking up: with a checker in hand, a press on a
    // legal landing is the second half of a click-to-move, not the start of a
    // new drag from whatever happens to be sitting there.
    if (destinations.includes(p)) {
      onDrop(p)
      return
    }
    if (movable.includes(p)) onStartDrag(p, event)
  }

  return (
    <g>
      {/* points you may pick up from */}
      {movable.map((p) => {
        if (p === BAR) return null
        const g = pointGeom(p)
        const y = g.top ? FIELD_Y + 0.03 : FIELD_Y + GEO.innerH - 0.03
        return (
          <rect
            key={`m${p}`}
            x={g.x - GEO.u * 0.32}
            y={y - 0.015}
            width={GEO.u * 0.64}
            height={0.03}
            rx={0.015}
            fill="var(--inlay)"
            opacity={selected === null ? 0.7 : 0.22}
          />
        )
      })}

      {/* the checker in hand */}
      {selected !== null &&
        (() => {
          const n = counts[selected] ?? 1
          const c =
            selected === BAR
              ? { x: FIELD_X + 6 * GEO.u + GEO.barW / 2, y: FIELD_Y + half + CHECKER_R + 0.24 }
              : checkerCentre(selected, Math.max(0, n - 1), Math.max(1, n))
          return (
            <circle
              cx={c.x}
              cy={c.y}
              r={CHECKER_R + 0.055}
              fill="none"
              stroke="var(--inlay)"
              strokeWidth="0.035"
            />
          )
        })()}

      {/* where it may go */}
      {hops.map((h) => (
        <Landing key={`d${h.to}`} hop={h} counts={counts} lit={lit === h.to} />
      ))}

      {/* hit targets, last so they sit above everything */}
      {interactive &&
        Array.from({ length: 24 }, (_, i) => {
          const p = i + 1
          const g = pointGeom(p)
          const live = movable.includes(p) || destinations.includes(p)
          return (
            <rect
              key={`h${p}`}
              data-point={p}
              x={g.x - GEO.u / 2}
              y={g.top ? FIELD_Y : FIELD_Y + half}
              width={GEO.u}
              height={half}
              fill="transparent"
              style={{ cursor: live ? 'pointer' : 'default' }}
              onPointerDown={press(p)}
              onPointerEnter={() => onHover(p)}
              onPointerLeave={() => onHover(null)}
            />
          )
        })}

      {/* the bar, for entering */}
      {movable.includes(BAR) && (
        <rect
          data-point={BAR}
          x={FIELD_X + 6 * GEO.u}
          y={FIELD_Y}
          width={GEO.barW}
          height={GEO.innerH}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onPointerDown={press(BAR)}
        />
      )}

      {/* the tray, for bearing off */}
      {destinations.includes(0) && (
        <rect
          data-point={0}
          x={TRAY_X}
          y={FIELD_Y}
          width={GEO.trayW}
          height={GEO.innerH}
          fill="var(--inlay)"
          opacity={lit === 0 ? 0.22 : 0.1}
          style={{ cursor: 'pointer' }}
          onPointerDown={press(0)}
          onPointerEnter={() => onHover(0)}
          onPointerLeave={() => onHover(null)}
        />
      )}
    </g>
  )
}

/**
 * One landing: the mark, and the die it spends.
 *
 * The die is `from - to` for every kind of move there is — an ordinary play, a
 * bar entry (`25 - to`, and `from` IS 25), and a bear-off from exactly the
 * die's point. Only an over-large bear-off die breaks it, where more than one
 * die would serve, and that case shows no number rather than a wrong one.
 */
function Landing({
  hop,
  counts,
  lit,
}: {
  hop: Hop
  counts: Readonly<Record<number, number>>
  lit: boolean
}) {
  const off = hop.to === 0
  const c = off
    ? { x: TRAY_CX, y: FIELD_Y + GEO.innerH / 2 }
    : (() => {
        const n = counts[hop.to] ?? 0
        return checkerCentre(hop.to, n, n + 1)
      })()

  const die = hop.from - hop.to
  const shows = !off && die >= 1 && die <= 6
  /*
   * The disc is brass at near-full opacity with a dark numeral, and it carries
   * a dark hairline so it reads on the oxblood points, the cypress points and
   * the bare field alike. It was brass at 34% first, which over a cypress point
   * composites to a muddy olive that looks like a mark on the board rather than
   * something you can click — and the numeral, set larger than the disc that
   * held it, was unreadable.
   */
  const r = CHECKER_R * 0.52

  return (
    <g style={{ pointerEvents: 'none' }}>
      {lit && !off && (
        // The whole landing slot fills while the pointer is over it, so the
        // player can commit without looking away from where the checker will
        // actually end up.
        <circle cx={c.x} cy={c.y} r={CHECKER_R} fill="var(--inlay)" opacity="0.2" />
      )}

      {/* A ring says this landing HITS. It is the only difference between the
          two marks, and it is deliberately the loud one. */}
      {hop.hit && (
        <circle
          cx={c.x}
          cy={c.y}
          r={CHECKER_R * 0.92}
          fill="none"
          stroke="var(--bad)"
          strokeWidth="0.05"
          opacity={lit ? 1 : 0.85}
        />
      )}

      <circle
        cx={c.x}
        cy={c.y}
        r={r}
        fill="var(--inlay)"
        opacity={lit ? 1 : 0.82}
        stroke="var(--app-bg)"
        strokeOpacity="0.45"
        strokeWidth="0.018"
      />
      {shows && (
        <MirrorText
          x={c.x}
          y={c.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={CHECKER_R * 0.62}
          fontWeight="700"
          fill="var(--app-bg)"
        >
          {die}
        </MirrorText>
      )}
    </g>
  )
}

/**
 * The points the opponent's last turn touched.
 *
 * A checker that moves while you are looking at it needs no marker — the
 * animation is the marker. This is for the other case, which is most of them:
 * you look at the rail, or away from the screen, and come back to a board that
 * has changed without having seen it change. The turn log says what happened in
 * words; this says where, which is the faster question to answer.
 *
 * It clears itself: the moment the player commits their own turn the newest log
 * entry is theirs, and there is nothing to draw.
 */
export function LastMove({ points }: { points: readonly number[] }) {
  if (points.length === 0) return null
  return (
    <g style={{ pointerEvents: 'none' }}>
      {points.map((p) => (
        <path key={p} d={pointPath(pointGeom(p))} fill="var(--inlay)" opacity="0.17" />
      ))}
    </g>
  )
}
