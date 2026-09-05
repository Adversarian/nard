import { MirrorText } from './MirrorText'

/**
 * The doubling cube. Brass-edged bone, showing the current stake.
 *
 * Rendered heavier than a die on purpose: the cube is the most consequential
 * object on the board and a strong player looks at it constantly, so it gets a
 * brass surround, a deeper contact shadow, and an engraved numeral rather than
 * a printed one.
 */
export function Cube({
  x,
  y,
  value,
  size = 0.66,
}: {
  x: number
  y: number
  value: number
  size?: number
}) {
  const half = size / 2
  const r = size * 0.16
  /*
   * A cube still on 1 has not been used, so it is drawn as an empty brass
   * outline — the cube's berth on the bar rather than the cube itself. Drawn
   * as a solid bone tile it was the loudest object on the board for the whole
   * of every game before the first double, saying nothing; dimming it just
   * made it a grey smudge. Where it sits still carries the ownership, which is
   * why it is not simply hidden.
   */
  if (value <= 1) {
    return (
      <g opacity="0.5">
        <rect
          x={x - half}
          y={y - half}
          width={size}
          height={size}
          rx={r}
          fill="none"
          stroke="var(--inlay)"
          strokeWidth="0.02"
          strokeDasharray="0.09 0.07"
        />
      </g>
    )
  }

  return (
    <g>
      <rect
        x={x - half * 1.2}
        y={y - half * 1.1}
        width={size * 1.2}
        height={size * 1.2}
        rx={size * 0.4}
        fill="url(#cast)"
      />
      <rect x={x - half} y={y - half} width={size} height={size} rx={r} fill="url(#cube-face)" />
      {/* the lit top-left arris */}
      <path
        d={`M ${x - half + r * 0.3} ${y + half - r * 0.4} L ${x - half + r * 0.3} ${y - half + r} Q ${x - half + r * 0.3} ${y - half + r * 0.3} ${x - half + r} ${y - half + r * 0.3} L ${x + half - r * 0.4} ${y - half + r * 0.3}`}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.7"
        strokeWidth={size * 0.035}
        strokeLinecap="round"
      />
      <rect
        x={x - half}
        y={y - half}
        width={size}
        height={size}
        rx={r}
        fill="none"
        stroke="var(--inlay)"
        strokeWidth="0.022"
        strokeOpacity="0.9"
      />
      {/* engraved, so the numeral sits in the bone rather than on it */}
      <MirrorText
        x={x}
        y={y + size * 0.012}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * (value >= 10 ? 0.44 : 0.56)}
        fontWeight="700"
        fill="#fff"
        opacity="0.5"
      >
        {value}
      </MirrorText>
      <MirrorText
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * (value >= 10 ? 0.44 : 0.56)}
        fontWeight="700"
        fill="var(--pip-deep)"
      >
        {value}
      </MirrorText>
    </g>
  )
}
