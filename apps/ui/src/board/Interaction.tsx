import { CHECKER_R, FIELD_X, FIELD_Y, GEO, checkerCentre, pointGeom } from './geometry'

/**
 * Hit targets and affordances.
 *
 * Deliberately quiet. A strong player does not need the board lit up — he can
 * see the legal moves. Highlighting exists to make clicking unambiguous, not to
 * teach. Everything here is a thin brass mark or a ghost outline; nothing glows.
 *
 * Hit areas are half-height columns rather than the point triangles themselves,
 * because a triangle is a miserable click target near its tip and checkers
 * routinely sit outside it.
 */
export function Interaction({
  movable,
  destinations,
  selected,
  hits,
  counts,
  onPick,
  onDrop,
}: {
  movable: readonly number[]
  destinations: readonly number[]
  selected: number | null
  /** Destinations where landing would hit a blot. */
  hits: readonly number[]
  /** Checkers currently on each point, for placing the ghost. */
  counts: Readonly<Record<number, number>>
  onPick: (point: number) => void
  onDrop: (point: number) => void
}) {
  const half = GEO.innerH / 2

  return (
    <g>
      {/* affordance marks */}
      {movable.map((p) => {
        const g = pointGeom(p)
        const y = g.top ? FIELD_Y + 0.028 : FIELD_Y + GEO.innerH - 0.028
        return (
          <rect
            key={`m${p}`}
            x={g.x - GEO.u * 0.34}
            y={y - 0.014}
            width={GEO.u * 0.68}
            height={0.028}
            rx={0.014}
            fill="var(--inlay)"
            opacity={selected === null ? 0.75 : 0.25}
          />
        )
      })}

      {/* selected point */}
      {selected !== null &&
        (() => {
          const n = counts[selected] ?? 1
          const c = checkerCentre(selected, Math.max(0, n - 1), Math.max(1, n))
          return (
            <circle
              cx={c.x}
              cy={c.y}
              r={CHECKER_R + 0.05}
              fill="none"
              stroke="var(--inlay)"
              strokeWidth="0.035"
            />
          )
        })()}

      {/* destination ghosts */}
      {destinations.map((p) => {
        if (p <= 0) return null
        const n = counts[p] ?? 0
        const c = checkerCentre(p, n, n + 1)
        const isHit = hits.includes(p)
        return (
          <circle
            key={`d${p}`}
            cx={c.x}
            cy={c.y}
            r={CHECKER_R * 0.72}
            fill="none"
            stroke={isHit ? 'var(--bad)' : 'var(--inlay)'}
            strokeWidth="0.03"
            strokeDasharray={isHit ? undefined : '0.09 0.07'}
            opacity="0.9"
          />
        )
      })}

      {/* hit targets, last so they sit above everything */}
      {Array.from({ length: 24 }, (_, i) => {
        const p = i + 1
        const g = pointGeom(p)
        return (
          <rect
            key={`h${p}`}
            x={g.x - GEO.u / 2}
            y={g.top ? FIELD_Y : FIELD_Y + half}
            width={GEO.u}
            height={half}
            fill="transparent"
            style={{ cursor: movable.includes(p) || destinations.includes(p) ? 'pointer' : 'default' }}
            onClick={() => (destinations.includes(p) ? onDrop(p) : onPick(p))}
          />
        )
      })}

      {/* the bar, for entering */}
      <rect
        x={FIELD_X + 6 * GEO.u}
        y={FIELD_Y}
        width={GEO.barW}
        height={GEO.innerH}
        fill="transparent"
        style={{ cursor: movable.includes(25) ? 'pointer' : 'default' }}
        onClick={() => onPick(25)}
      />

      {/* the tray, for bearing off */}
      <rect
        x={FIELD_X + GEO.innerW + GEO.trayDivider}
        y={FIELD_Y}
        width={GEO.trayW}
        height={GEO.innerH}
        fill={destinations.includes(0) ? 'var(--inlay)' : 'transparent'}
        opacity={destinations.includes(0) ? 0.12 : 1}
        style={{ cursor: destinations.includes(0) ? 'pointer' : 'default' }}
        onClick={() => onDrop(0)}
      />
    </g>
  )
}
