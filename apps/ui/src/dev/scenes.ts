/**
 * Canonical board states, addressable by URL. See docs/playtesting.md.
 *
 * These are plain fixtures, deliberately independent of the engine, so they
 * work before the engine exists and cannot be broken by an engine bug.
 *
 * `pts` follows the engine's on-roll-relative layout (AGENTS.md §5):
 *   index 1..24 signed counts, 25 = on-roll bar, 0 = opponent bar (negative).
 *
 * ADD A SCENE whenever you build UI for a state that is hard to reach by
 * playing. A state with no scene will not get looked at.
 */

export interface Scene {
  readonly id: string
  readonly title: string
  /** Why this scene exists — what it is meant to catch. */
  readonly probes: string
  readonly pts: readonly number[]
  readonly off: number
  readonly oppOff: number
  readonly dice?: readonly [number, number]
  readonly cube?: { value: number; owner: 'light' | 'dark' | null }
  readonly lang?: 'en' | 'fa'
}

const empty = () => new Array<number>(26).fill(0)

function build(spec: Record<number, number>): number[] {
  const p = empty()
  for (const [k, v] of Object.entries(spec)) p[Number(k)] = v
  return p
}

/** Standard opening position, on-roll perspective. */
const OPENING = build({ 24: 2, 13: 5, 8: 3, 6: 5, 1: -2, 12: -5, 17: -3, 19: -5 })

export const SCENES: readonly Scene[] = [
  {
    id: 'opening',
    title: 'Opening position',
    probes: 'the baseline — geometry, point colours, checker stacking',
    pts: OPENING,
    off: 0,
    oppOff: 0,
    dice: [3, 1],
  },
  {
    id: 'crowded-point',
    title: 'Seven checkers on one point',
    probes: 'stack compression and the count chip above five checkers',
    pts: build({ 6: 7, 8: 3, 13: 5, 19: -5, 17: -3, 12: -5, 1: -2 }),
    off: 0,
    oppOff: 0,
    dice: [6, 6],
  },
  {
    id: 'both-on-bar',
    title: 'Both players on the bar',
    probes: 'both bar slots occupied at once',
    pts: build({ 25: 2, 0: -2, 6: 4, 8: 3, 13: 4, 19: -4, 17: -3, 12: -4 }),
    off: 0,
    oppOff: 0,
    dice: [5, 2],
  },
  {
    id: 'bearoff-race',
    title: 'Bear-off race',
    probes: 'the off-tray, no contact, asymmetric borne-off counts',
    pts: build({ 6: 2, 5: 3, 4: 2, 3: 2, 2: 1, 1: 1, 19: -3, 20: -3, 21: -2, 22: -2 }),
    off: 4,
    oppOff: 5,
    dice: [6, 4],
  },
  {
    id: 'backgame',
    title: 'Backgame',
    probes: 'two anchors deep in our home board, heavy contact',
    pts: build({ 24: 2, 23: 2, 13: 4, 8: 3, 6: 4, 1: -3, 2: -3, 12: -4, 17: -3, 19: -2 }),
    off: 0,
    oppOff: 0,
    dice: [4, 2],
  },
  {
    id: 'cube-64',
    title: 'Cube at 64',
    probes: 'maximum cube value, owned, two-digit rendering',
    pts: OPENING,
    off: 0,
    oppOff: 0,
    dice: [5, 4],
    cube: { value: 64, owner: 'light' },
  },
  {
    id: 'gammon-win',
    title: 'Gammon',
    probes: 'game-over overlay with opponent on zero borne off',
    pts: build({ 19: -4, 20: -4, 21: -4, 22: -3 }),
    off: 15,
    oppOff: 0,
  },
  {
    id: 'long-persian',
    title: 'Persian interface',
    probes: 'RTL chrome with the board unmirrored, and longest strings',
    pts: OPENING,
    off: 0,
    oppOff: 0,
    dice: [6, 5],
    lang: 'fa',
  },
]

export const sceneById = (id: string | null): Scene =>
  SCENES.find((s) => s.id === id) ?? SCENES[0]!
