import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createEvaluator } from '../packages/ai/src/index.js'
import {
  analyseMatch,
  exportMatchToMat,
  loadMatch,
  type DecisionAnalysis,
  type ErrorBand,
  type PerformanceMetric,
} from '../packages/analysis/src/index.js'
import type { PlayerId } from '../packages/engine/src/index.js'

function option(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
}

function inputPath(): string {
  const value = process.argv
    .slice(2)
    .find((argument) => !argument.startsWith('--'))
  if (value === undefined) {
    throw new Error(
      'usage: pnpm analyse <matchfile> [--plies=0|1|2] [--export-mat=<file>]',
    )
  }
  return resolve(value)
}

function plies(): 0 | 1 | 2 {
  const value = option('plies')
  if (value === undefined) return 2
  const parsed = Number(value)
  if (parsed !== 0 && parsed !== 1 && parsed !== 2) {
    throw new RangeError('plies must be 0, 1 or 2')
  }
  return parsed
}

function number(value: number): string {
  return value >= 0 ? `+${value.toFixed(4)}` : value.toFixed(4)
}

function pr(value: PerformanceMetric): string {
  return value.pr === null
    ? '—'
    : `${value.pr.toFixed(2)} (${value.decisions})`
}

function playerName(
  player: PlayerId,
  names: Partial<Record<PlayerId, string>>,
): string {
  return names[player] ?? player
}

function decisionText(decision: DecisionAnalysis): string {
  return decision.kind === 'checker'
    ? `${decision.dice.join('')} ${decision.played.notation} → ${decision.best.notation}`
    : `${decision.played} → ${decision.best}`
}

const path = inputPath()
const depth = plies()
const match = loadMatch(await readFile(path, 'utf8'))
const matPath = option('export-mat')
if (matPath !== undefined) {
  await writeFile(resolve(matPath), exportMatchToMat(match), 'utf8')
}

const evaluator = await createEvaluator({ allowFallback: false })
try {
  const analysis = await analyseMatch(match, evaluator, { plies: depth })
  const names: Partial<Record<PlayerId, string>> = {
    ...(match.meta.players?.light === undefined
      ? {}
      : { light: match.meta.players.light.name }),
    ...(match.meta.players?.dark === undefined
      ? {}
      : { dark: match.meta.players.dark.name }),
  }

  console.log(`Nard match analysis — ${path}`)
  console.log(`Commitment: ${analysis.commitment}`)
  console.log(`Evaluator depth: ${analysis.searchDepth}-ply`)
  console.log('')
  console.log('Player              Checker PR       Cube PR        Overall PR')
  for (const player of ['light', 'dark'] as const) {
    const performance = analysis.performance[player]
    console.log(
      [
        playerName(player, names).padEnd(19),
        pr(performance.checker).padEnd(16),
        pr(performance.cube).padEnd(14),
        pr(performance.overall),
      ].join(''),
    )
  }

  console.log('')
  console.log('Per-game PR')
  for (const game of analysis.games) {
    const figures = (['light', 'dark'] as const)
      .map((player) => {
        const performance = game.performance[player]
        return (
          `${playerName(player, names)} checker ${pr(performance.checker)}, ` +
          `cube ${pr(performance.cube)}`
        )
      })
      .join(' · ')
    console.log(`  Game ${game.gameIndex + 1}: ${figures}`)
  }

  const bands: Record<ErrorBand, number> = {
    good: 0,
    doubtful: 0,
    error: 0,
    blunder: 0,
  }
  for (const decision of analysis.decisions) bands[decision.band] += 1
  console.log('')
  console.log(
    `Error bands: good ${bands.good}, doubtful ${bands.doubtful}, ` +
      `error ${bands.error}, blunder ${bands.blunder}`,
  )

  console.log('')
  console.log('Luck / skill split')
  for (const player of ['light', 'dark'] as const) {
    console.log(
      `  ${playerName(player, names)}: luck ${number(
        analysis.luckSkill.luck[player],
      )}, equity lost to decisions ${analysis.luckSkill.skillEquityLost[
        player
      ].toFixed(4)}`,
    )
  }
  console.log(
    `  Light-minus-dark luck: ${number(
      analysis.luckSkill.luckDifferential,
    )}`,
  )
  console.log(
    `  Light skill edge: ${number(analysis.luckSkill.skillDifferential)}`,
  )

  console.log('')
  if (analysis.blunders.length === 0) {
    console.log('Blunders: none')
  } else {
    console.log(`Blunders (${analysis.blunders.length})`)
    for (const blunder of analysis.blunders) {
      const decision = analysis.decisions.find(
        ({ decisionIndex }) => decisionIndex === blunder.decisionIndex,
      )!
      console.log(
        `  G${blunder.gameIndex + 1} #${blunder.decisionIndex} ` +
          `${playerName(blunder.player, names)} ${number(blunder.error)} · ` +
          `${blunder.phase} · ${blunder.theme} · ${blunder.direction} · ` +
          decisionText(decision),
      )
    }
  }

  if (matPath !== undefined) {
    console.log('')
    console.log(`GNU Backgammon MAT export: ${resolve(matPath)}`)
  }
} finally {
  await evaluator.dispose()
}
