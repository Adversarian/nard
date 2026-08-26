/**
 * Capture every gallery scene to .shots/ so an agent can look at its own work.
 * See docs/playtesting.md.
 *
 *   pnpm dev &        # must already be serving on :5173
 *   pnpm shots
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { SCENES } from '../apps/ui/src/dev/scenes.js'

const BASE = process.env.NARD_URL ?? 'http://localhost:5173'
const OUT = '.shots'

const only = process.argv.slice(2)
const scenes = only.length ? SCENES.filter((s) => only.includes(s.id)) : SCENES

await mkdir(OUT, { recursive: true })
// Use the system Chrome rather than downloading Playwright's own build.
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

const index: string[] = []
for (const scene of scenes) {
  const url = `${BASE}/?scene=${scene.id}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400) // let springs settle
  await page.screenshot({ path: `${OUT}/${scene.id}.png` })
  index.push(`${scene.id.padEnd(20)} ${scene.title}`)
  console.log(`captured ${scene.id}`)
}

await writeFile(`${OUT}/index.txt`, index.join('\n') + '\n')
await browser.close()
console.log(`\n${scenes.length} scene(s) -> ${OUT}/`)
