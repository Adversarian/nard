/**
 * Dev-only transport between the browser and the gnubg sidecar.
 *
 * `packages/ai` spawns gnubg with `node:child_process`. A browser page cannot do
 * that, so during development the evaluator runs inside Vite's own Node process
 * and the page reaches it over HTTP.
 *
 * This is the browser half of the `platform` seam in ADR 0003. The Tauri build
 * replaces it with an IPC call to the Rust side, and `apps/ui/src/platform`
 * is the only code that knows which is in use.
 */
import type { Plugin } from 'vite'

export function devEvaluator(): Plugin {
  let evaluator: Promise<import('@nard/ai').Evaluator> | null = null

  return {
    name: 'nard-dev-evaluator',
    apply: 'serve',
    configureServer(server) {
      // Loaded through Vite's SSR pipeline, not a plain `import`.
      //
      // The workspace packages are TypeScript source using `.js` specifiers
      // (NodeNext style). A bare Node import from middleware cannot resolve
      // those; ssrLoadModule applies Vite's transform and resolution, while
      // still letting node:child_process through as an external.
      const get = async () => {
        if (!evaluator) {
          const mod = (await server.ssrLoadModule('@nard/ai')) as typeof import('@nard/ai')
          evaluator = mod.createEvaluator({
            onBackendError: (e) => console.warn('[nard] gnubg backend:', e.message),
          })
        }
        return evaluator
      }

      server.middlewares.use('/api/eval', (req, res) => {
        if (req.method !== 'POST') return res.writeHead(405).end()
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          try {
            const { pts, off, oppOff, dice, plies, cube } = JSON.parse(body)
            const position = { pts: Int8Array.from(pts), off, oppOff }
            const ev = await get()
            const payload = dice
              ? { moves: await ev.rankMoves(position, dice, { plies: plies ?? 1 }) }
              : { cube: await ev.cubeDecision(position, cube) }
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(payload))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: (error as Error).message }))
          }
        })
      })

      server.httpServer?.once('close', () => {
        void evaluator?.then((e) => e.dispose())
      })
    },
  }
}
