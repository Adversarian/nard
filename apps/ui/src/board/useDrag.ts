import { useCallback, useEffect, useRef, useState } from 'react'
import { pointAt } from './geometry'
import { sound } from '../sound/player'

export interface Drag {
  /** Where the checker was picked up from. */
  readonly from: number
  /** Pointer position, in board coordinates. */
  readonly x: number
  readonly y: number
  /** The point under the pointer, when it is somewhere this checker may go. */
  readonly over: number | null
}

/**
 * Picking a checker up and carrying it.
 *
 * The board supports BOTH click-to-move and drag-and-drop, and one gesture has
 * to serve both without the player choosing in advance. The rule is distance:
 * press, and the checker is selected; move more than a checker's radius before
 * releasing, and it was a drag, so it drops where it is let go. Release without
 * moving, and it stays selected and the next click places it.
 *
 * Coordinates come from `getScreenCTM()` on the element that was pressed, not
 * on the <svg> root. Everything on the board sits inside a group that is
 * mirrored for players who keep their home board on the left, and the root's
 * matrix does not include that mirror — taking it from the root drops checkers
 * on the horizontally reflected point.
 *
 * Listeners go on `window`, not the element: a drag routinely leaves the board
 * (the tray sits at the edge, and a fast player overshoots), and a pointerup
 * that lands outside an element that is only listening to itself never
 * arrives, which strands the checker mid-air.
 */
export function useDrag({
  legalFor,
  onPick,
  onDrop,
}: {
  /** True if a checker picked up at `from` may be played to `to`. */
  legalFor: (from: number, to: number) => boolean
  onPick: (from: number) => void
  onDrop: (from: number, to: number) => void
}): {
  drag: Drag | null
  /** True once the pointer has moved far enough that this is a drag. */
  dragging: boolean
  start: (from: number, event: React.PointerEvent<SVGElement>) => void
} {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dragging, setDragging] = useState(false)
  // Refs, not state: these are read inside window listeners registered once,
  // and a listener closing over stale state is how drags start ignoring the
  // move they were begun for.
  const matrix = useRef<DOMMatrix | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const live = useRef<Drag | null>(null)
  const moved = useRef(false)
  const cb = useRef({ legalFor, onDrop })
  cb.current = { legalFor, onDrop }

  const at = (clientX: number, clientY: number) => {
    const m = matrix.current
    if (!m) return null
    const p = new DOMPoint(clientX, clientY).matrixTransform(m)
    return { x: p.x, y: p.y }
  }

  const start = useCallback(
    (from: number, event: React.PointerEvent<SVGElement>) => {
      const ctm = (event.currentTarget as SVGGraphicsElement).getScreenCTM()
      if (!ctm) return
      matrix.current = ctm.inverse()
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.current)
      origin.current = { x: p.x, y: p.y }
      moved.current = false
      const next: Drag = { from, x: p.x, y: p.y, over: null }
      live.current = next
      setDrag(next)
      setDragging(false)
      // The same click as setting a checker down, lighter and pitched up. A
      // pick-up that makes no sound at all leaves the gesture feeling like
      // nothing happened until the checker lands.
      sound.play('place', { gain: 0.34, rate: 1.4 })
      onPick(from)
    },
    [onPick],
  )

  useEffect(() => {
    if (!drag) return

    const move = (e: PointerEvent) => {
      const here = at(e.clientX, e.clientY)
      const from = live.current?.from
      if (!here || from === undefined) return

      const o = origin.current
      if (o && !moved.current) {
        // A checker radius. Below it the gesture is still a click, so a player
        // who twitches while clicking does not have the checker snatched away.
        if (Math.hypot(here.x - o.x, here.y - o.y) > 0.42) {
          moved.current = true
          setDragging(true)
        }
      }

      const target = pointAt(here.x, here.y)
      const over = target !== null && cb.current.legalFor(from, target) ? target : null
      const next: Drag = { from, x: here.x, y: here.y, over }
      live.current = next
      setDrag(next)
    }

    const end = () => {
      const d = live.current
      live.current = null
      origin.current = null
      setDrag(null)
      setDragging(false)
      // A press that never moved is a click; the checker stays selected and
      // the next click on a destination plays it.
      if (d && moved.current && d.over !== null) cb.current.onDrop(d.from, d.over)
      moved.current = false
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    // Registered once per drag, on the transition from null to a live drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  return { drag, dragging, start }
}
