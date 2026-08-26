import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  applyMove,
  encodePositionId,
  generateLegalMoves,
  mirror,
  standardPosition,
  type Dice,
  type Die,
  type Position,
} from '../packages/engine/src/index.js'

interface DiffCase {
  readonly positionId: string
  readonly dice: Dice
  readonly ours: readonly string[]
}

const DEFAULT_CASES = 10_000
const DEFAULT_SEED = 0x4e415244
const GNUBG_ROOT =
  process.env.GNUBG_ROOT ??
  resolve(process.env.HOME ?? '', 'opt/gnubg/usr')

function argument(name: string, fallback: number): number {
  const prefix = `--${name}=`
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length)
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return parsed
}

function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

function die(random: () => number): Die {
  return ((random() % 6) + 1) as Die
}

function resultIds(position: Position, dice: Dice): readonly string[] {
  return generateLegalMoves(position, dice)
    .map((move) => encodePositionId(applyMove(position, move)))
    .sort()
}

function generateCases(count: number, seed: number): readonly DiffCase[] {
  const random = pseudoRandom(seed)
  const cases: DiffCase[] = []
  let position = standardPosition()

  while (cases.length < count) {
    const dice = [die(random), die(random)] as Dice
    const ours = resultIds(position, dice)
    cases.push({
      positionId: encodePositionId(position),
      dice,
      ours,
    })

    if (ours.length === 0) {
      position = mirror(position)
      continue
    }

    const moves = generateLegalMoves(position, dice)
    const chosen = moves[random() % moves.length]!
    const result = applyMove(position, chosen)
    position = result.off === 15 ? standardPosition() : mirror(result)

    // Regular restarts keep the corpus broad instead of over-sampling races.
    if (random() % 97 === 0) position = standardPosition()
  }

  return cases
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

const count = argument('cases', DEFAULT_CASES)
const seed = argument('seed', DEFAULT_SEED)
const cases = generateCases(count, seed)
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'nard-difftest-'))
const inputPath = join(temporaryDirectory, 'cases.json')

try {
  writeFileSync(
    inputPath,
    JSON.stringify(
      cases.map(({ positionId, dice }) => ({ positionId, dice })),
    ),
  )

  const result = spawnSync(
    join(GNUBG_ROOT, 'games/gnubg'),
    [
      '-q',
      '-t',
      '-r',
      '-P',
      join(GNUBG_ROOT, 'share/gnubg'),
      '-D',
      join(GNUBG_ROOT, 'share/gnubg'),
      '-p',
      resolve('tools/gnubg-difftest.py'),
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, NARD_DIFF_INPUT: inputPath },
      maxBuffer: 256 * 1024 * 1024,
    },
  )

  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.stderr.write(result.stdout)
    process.exit(result.status ?? 1)
  }

  const oracle = new Map<number, readonly string[]>()
  for (const line of result.stdout.split('\n')) {
    const start = line.indexOf('NARD_DIFF ')
    const end = line.indexOf(' NARD_END', start)
    if (start < 0 || end < 0) continue
    const [index, positions] = JSON.parse(
      line.slice(start + 'NARD_DIFF '.length, end),
    ) as [
      number,
      string[],
    ]
    oracle.set(index, positions)
  }

  const disagreements: string[] = []
  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index]!
    const gnubg = oracle.get(index)
    if (gnubg === undefined) {
      disagreements.push(`${testCase.positionId} ${testCase.dice.join('')} missing GNU result`)
      continue
    }
    if (!arraysEqual(testCase.ours, gnubg)) {
      disagreements.push(
        [
          `${testCase.positionId} dice=${testCase.dice.join(',')}`,
          `  ours:  ${testCase.ours.join(' ') || '(no move)'}`,
          `  gnubg: ${gnubg.join(' ') || '(no move)'}`,
        ].join('\n'),
      )
    }
  }

  if (disagreements.length > 0) {
    console.error(
      `${disagreements.length} disagreements over ${count} random reachable positions (seed ${seed}).`,
    )
    console.error(disagreements.slice(0, 20).join('\n'))
    process.exit(1)
  }

  console.log(
    `Zero disagreements over ${count} random reachable positions (seed ${seed}).`,
  )
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
