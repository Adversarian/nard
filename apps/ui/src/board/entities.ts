/**
 * Checker identity.
 *
 * Animation needs to know that the checker which was on point 8 is the *same*
 * checker now on point 5 — otherwise React reconciles by index and checkers
 * teleport between stacks instead of moving. So checkers are explicit entities
 * with stable ids, and a move mutates one entity's location.
 *
 * This is also the model the real game needs, so it is not animation-only
 * scaffolding.
 */

import type { Side } from './Checker'
import { barCentre, checkerCentre, offSlab, stackSpacing } from './geometry'

/** Where a checker is. `point` is on-roll-relative 1..24 (AGENTS.md §5). */
export type Loc =
  | { kind: 'point'; point: number }
  | { kind: 'bar' }
  | { kind: 'off' }

export interface CheckerEntity {
  readonly id: string
  readonly side: Side
  /** True when this checker belongs to the player on roll. */
  readonly onRoll: boolean
  loc: Loc
}

/** Build entities from an engine-style `pts` array. */
export function entitiesFrom(
  pts: ArrayLike<number>,
  off: number,
  oppOff: number,
  onRollSide: Side = 'light',
): CheckerEntity[] {
  const oppSide: Side = onRollSide === 'light' ? 'dark' : 'light'
  const out: CheckerEntity[] = []
  let n = 0
  const push = (side: Side, onRoll: boolean, loc: Loc) =>
    out.push({ id: `${side}-${n++}`, side, onRoll, loc })

  for (let p = 1; p <= 24; p++) {
    const v = pts[p] ?? 0
    for (let k = 0; k < Math.abs(v); k++) {
      push(v > 0 ? onRollSide : oppSide, v > 0, { kind: 'point', point: p })
    }
  }
  for (let k = 0; k < (pts[25] ?? 0); k++) push(onRollSide, true, { kind: 'bar' })
  for (let k = 0; k < Math.abs(pts[0] ?? 0); k++) push(oppSide, false, { kind: 'bar' })
  for (let k = 0; k < off; k++) push(onRollSide, true, { kind: 'off' })
  for (let k = 0; k < oppOff; k++) push(oppSide, false, { kind: 'off' })
  return out
}

export interface Placement {
  readonly entity: CheckerEntity
  readonly x: number
  readonly y: number
  /** Draw order: checkers higher on a stack paint over lower ones. */
  readonly z: number
}

/**
 * Resolve every entity to a coordinate. Pure — same entities in, same layout
 * out, which is what makes motion traces reproducible.
 */
export function layout(entities: readonly CheckerEntity[]): Placement[] {
  const byPoint = new Map<number, CheckerEntity[]>()
  const bar: Record<'on' | 'opp', CheckerEntity[]> = { on: [], opp: [] }
  const offs: Record<'on' | 'opp', CheckerEntity[]> = { on: [], opp: [] }

  for (const e of entities) {
    if (e.loc.kind === 'point') {
      const list = byPoint.get(e.loc.point) ?? []
      list.push(e)
      byPoint.set(e.loc.point, list)
    } else if (e.loc.kind === 'bar') bar[e.onRoll ? 'on' : 'opp'].push(e)
    else offs[e.onRoll ? 'on' : 'opp'].push(e)
  }

  const out: Placement[] = []
  for (const [point, list] of byPoint) {
    list.forEach((entity, k) => {
      const c = checkerCentre(point, k, list.length)
      out.push({ entity, x: c.x, y: c.y, z: k })
    })
  }
  for (const which of ['on', 'opp'] as const) {
    bar[which].forEach((entity, k) => {
      const c = barCentre(k, which === 'on')
      out.push({ entity, x: c.x, y: c.y, z: k })
    })
    offs[which].forEach((entity, k) => {
      const s = offSlab(k, which === 'on')
      out.push({ entity, x: s.x + s.w / 2, y: s.y + s.h / 2, z: k })
    })
  }
  return out
}

/**
 * The checker a player would physically pick up from `point` — the top of the
 * stack, which is the LAST one placed there.
 *
 * `layout` assigns draw order by position in this same list, so "last in the
 * list" and "painted on top" are the same checker by construction. Returns null
 * when the point is empty.
 */
export function topEntityAt(
  entities: readonly CheckerEntity[],
  point: number,
): CheckerEntity | null {
  let top: CheckerEntity | null = null
  for (const e of entities) {
    const here =
      point === 25
        ? e.loc.kind === 'bar' && e.onRoll
        : e.loc.kind === 'point' && e.loc.point === point
    if (here) top = e
  }
  return top
}

/** Spacing used for a point, exported so the UI can size hit targets. */
export { stackSpacing }
