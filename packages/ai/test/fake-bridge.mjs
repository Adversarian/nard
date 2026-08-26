import { existsSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const mode = process.env.NARD_FAKE_MODE ?? 'respond'
const marker = process.env.NARD_FAKE_MARKER
const rankResult = JSON.parse(process.env.NARD_FAKE_RANK_RESULT ?? '{"moves":[]}')
const cubeResult = JSON.parse(
  process.env.NARD_FAKE_CUBE_RESULT ??
    '{"action":"no-double","response":"take","equityNoDouble":0,"equityDoubleTake":0,"equityDoublePass":1}',
)

process.stdout.write('fake GNU Backgammon startup banner\n')

const lines = createInterface({ input: process.stdin })
lines.on('line', (line) => {
  const request = JSON.parse(line)

  if (mode === 'timeout') return
  if (mode === 'crash') process.exit(23)
  if (mode === 'crash-once' && marker !== undefined && !existsSync(marker)) {
    writeFileSync(marker, 'crashed\n')
    process.exit(23)
  }

  const result =
    request.method === 'rank_moves' ? rankResult : cubeResult
  process.stdout.write(
    `${JSON.stringify({ id: request.id, ok: true, result })}\n`,
  )
})
