import type { Dice, PlayerId } from '@nard/engine'

import {
  loadMatch,
  replayMatch,
  type ReplayStep,
  type SavedMatchV1,
} from './match.js'

interface MatEntry {
  readonly player: PlayerId
  readonly text: string
  readonly numbered: boolean
}

function safeName(name: string | undefined, fallback: string): string {
  const cleaned = (name ?? fallback).replace(/[\r\n:]/g, ' ').trim()
  return cleaned === '' ? fallback : cleaned
}

function diceText(dice: Dice): string {
  return `${dice[0]}${dice[1]}`
}

function gameEntries(steps: readonly ReplayStep[]): readonly MatEntry[] {
  const entries: MatEntry[] = []
  const pendingDice = new Map<PlayerId, Dice>()

  for (const step of steps) {
    if (
      step.decision.kind === 'roll' &&
      step.after.phase === 'to-move' &&
      step.after.dice !== null
    ) {
      pendingDice.set(step.after.onRoll, step.after.dice)
    }

    if (step.decision.kind === 'move') {
      const dice = pendingDice.get(step.before.onRoll)
      if (dice === undefined || step.move === undefined) {
        throw new Error('MAT export found a move without its recorded roll')
      }
      entries.push({
        player: step.before.onRoll,
        text: `${diceText(dice)}: ${step.move.notation}`,
        numbered: true,
      })
      pendingDice.delete(step.before.onRoll)
    }

    if (step.decision.kind === 'pass-turn') {
      const dice = pendingDice.get(step.before.onRoll)
      if (dice === undefined) {
        throw new Error('MAT export found a pass without its recorded roll')
      }
      entries.push({
        player: step.before.onRoll,
        text: `${diceText(dice)}: Cannot move`,
        numbered: true,
      })
      pendingDice.delete(step.before.onRoll)
    }

    if (step.decision.kind === 'double') {
      entries.push({
        player: step.before.onRoll,
        text: `Doubles => ${step.before.cube.value * 2}`,
        numbered: true,
      })
    }
    if (step.decision.kind === 'take') {
      entries.push({
        player:
          step.before.onRoll === 'light' ? 'dark' : 'light',
        text: 'Takes',
        numbered: true,
      })
    }
    if (step.decision.kind === 'drop') {
      entries.push({
        player:
          step.before.onRoll === 'light' ? 'dark' : 'light',
        text: 'Drops',
        numbered: true,
      })
    }

    if (
      (step.after.phase === 'game-over' ||
        step.after.phase === 'match-over') &&
      step.after.result !== null &&
      step.decision.kind === 'move'
    ) {
      entries.push({
        player: step.after.result.winner,
        text: `Wins ${step.after.result.points} point${
          step.after.result.points === 1 ? '' : 's'
        }`,
        numbered: false,
      })
    }
  }

  return entries
}

function renderEntries(entries: readonly MatEntry[]): readonly string[] {
  const lines: string[] = []
  let left: string | null = null
  let turn = 1

  const flush = (right: string | null = null): void => {
    if (left === null && right === null) return
    lines.push(
      `  ${String(turn).padStart(2)}) ${(left ?? '').padEnd(32)}${right ?? ''}`.trimEnd(),
    )
    left = null
    turn += 1
  }

  for (const entry of entries) {
    if (!entry.numbered) {
      flush()
      lines.push(
        `      ${entry.player === 'light' ? entry.text : ''.padEnd(32) + entry.text}`.trimEnd(),
      )
      continue
    }

    if (entry.player === 'light') {
      if (left !== null) flush()
      left = entry.text
    } else {
      flush(entry.text)
    }
  }
  flush()
  return lines
}

/** Export the replayed record to the Jellyfish MAT format GNU Backgammon reads. */
export function exportMatchToMat(input: SavedMatchV1): string {
  const match = loadMatch(input)
  if (match.meta.rules.automaticDoubles) {
    throw new Error('MAT export does not represent automatic opening doubles')
  }
  const replay = replayMatch(match)
  const lightName = safeName(match.meta.players?.light?.name, 'light')
  const darkName = safeName(match.meta.players?.dark?.name, 'dark')
  const matchLength = match.meta.match.length
  const gameIndexes = [
    ...new Set(replay.steps.map(({ gameIndex }) => gameIndex)),
  ].sort((left, right) => left - right)
  const lines = [
    `${matchLength} point match`,
    '',
  ]

  for (const gameIndex of gameIndexes) {
    const steps = replay.steps.filter((step) => step.gameIndex === gameIndex)
    const initial = steps[0]?.before
    if (initial === undefined) continue
    lines.push(`Game ${gameIndex + 1}`)
    lines.push(
      `${lightName} : ${initial.match.score.light}`.padEnd(32) +
        `${darkName} : ${initial.match.score.dark}`,
    )
    lines.push(...renderEntries(gameEntries(steps)), '')
  }

  return `${lines.join('\n').trimEnd()}\n`
}
