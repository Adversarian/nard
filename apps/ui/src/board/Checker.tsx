import { CHECKER_R } from './geometry'

export type Side = 'light' | 'dark'

/**
 * A single checker: turned bone or ebony, lit from the upper-left.
 *
 * The brass rim on dark checkers is a legibility device, not decoration — see
 * docs/design-language.md. Without it they go dark-on-dark against the cypress
 * points. Check contrast before removing it.
 */
export function Checker({ side }: { side: Side }) {
  const r = CHECKER_R
  const light = side === 'light'
  const x = 0
  const y = 0
  return (
    <g>
      {/*
        Drawn shadow, NOT filter="url(#checker-shadow)". An feDropShadow forces
        the browser to re-run the filter every frame the group is transformed;
        with 30 checkers on the board that dropped animation to ~17fps. An
        ellipse is free. Measured with `pnpm motion` — see the frame-pacing line.
      */}
      <ellipse
        cx={x + r * 0.05}
        cy={y + r * 0.16}
        rx={r * 0.96}
        ry={r * 0.9}
        fill="#000"
        opacity="0.45"
      />
      <circle cx={x} cy={y} r={r} fill={`url(#checker-${side})`} />
      <circle
        cx={x}
        cy={y}
        r={r - (light ? 0.012 : 0.016)}
        fill="none"
        stroke={light ? 'var(--checker-light-edge)' : 'var(--checker-dark-rim)'}
        strokeWidth={light ? 0.016 : 0.024}
        strokeOpacity={light ? 0.75 : 0.8}
      />
      {/* turned rings, as on a lathed wooden checker */}
      <circle
        cx={x}
        cy={y}
        r={r * 0.62}
        fill="none"
        stroke={light ? 'var(--checker-light-edge)' : 'var(--checker-dark-hi)'}
        strokeWidth="0.017"
        strokeOpacity="0.6"
      />
      <circle
        cx={x}
        cy={y}
        r={r * 0.34}
        fill="none"
        stroke={light ? 'var(--checker-light-edge)' : 'var(--checker-dark-hi)'}
        strokeWidth="0.013"
        strokeOpacity="0.4"
      />
      {/* specular sliver, upper-left, agreeing with every shadow in the app */}
      <path
        d={`M ${x - r * 0.62} ${y - r * 0.34} A ${r * 0.72} ${r * 0.72} 0 0 1 ${x - r * 0.2} ${y - r * 0.68}`}
        fill="none"
        stroke="#fff"
        strokeOpacity={light ? 0.5 : 0.16}
        strokeWidth="0.026"
        strokeLinecap="round"
      />
    </g>
  )
}

/** Shown on the top checker when a stack is too tall to draw in full. */
export function CountChip({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={CHECKER_R * 0.46} fill="var(--inlay)" />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={CHECKER_R * 0.62}
        fontWeight="700"
        fill="var(--app-bg)"
      >
        {n}
      </text>
    </g>
  )
}
