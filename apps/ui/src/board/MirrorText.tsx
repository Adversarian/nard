import { useHomeSide } from './HomeSide'

/**
 * Text that stays readable when the board is mirrored.
 *
 * `home: 'left'` flips the whole case (Board.tsx). Everything on the board is
 * symmetric except the numbers — the cube value and stack count chips — which
 * would come out backwards. This flips them back about their own centre.
 */
export function MirrorText({
  x,
  y,
  children,
  ...rest
}: React.SVGProps<SVGTextElement> & { x: number; y: number }) {
  const home = useHomeSide()
  return (
    <text
      x={x}
      y={y}
      {...(home === 'left' ? { transform: `translate(${2 * x} 0) scale(-1 1)` } : {})}
      {...rest}
    >
      {children}
    </text>
  )
}
