/** The doubling cube. Brass-edged bone, showing the current stake. */
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
  return (
    <g filter="url(#checker-shadow)">
      <rect
        x={x - half}
        y={y - half}
        width={size}
        height={size}
        rx={size * 0.17}
        fill="var(--checker-light)"
      />
      <rect
        x={x - half}
        y={y - half}
        width={size}
        height={size}
        rx={size * 0.17}
        fill="none"
        stroke="var(--inlay)"
        strokeWidth="0.026"
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * (value >= 10 ? 0.44 : 0.56)}
        fontWeight="700"
        fill="var(--checker-dark)"
      >
        {value}
      </text>
    </g>
  )
}
