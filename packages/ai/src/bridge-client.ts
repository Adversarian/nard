import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  BridgeRequest,
  BridgeResponse,
  CubeDecisionRequest,
  CubeDecisionResponse,
  RankMovesRequest,
  RankMovesResponse,
} from './protocol.js'

const DEFAULT_TIMEOUT_MS = 10_000

export class GnubgBridgeError extends Error {
  override readonly name = 'GnubgBridgeError'
}

export interface BridgeCommand {
  readonly command: string
  readonly args?: readonly string[]
  readonly env?: NodeJS.ProcessEnv
}

export interface BridgeClientOptions {
  readonly command?: BridgeCommand
  readonly timeoutMs?: number
}

interface PendingRequest {
  readonly id: number
  readonly resolve: (result: unknown) => void
  readonly reject: (error: Error) => void
  readonly timer: NodeJS.Timeout
}

function defaultCommand(): BridgeCommand {
  const root =
    process.env.GNUBG_ROOT ??
    resolve(process.env.HOME ?? '', 'opt/gnubg/usr')
  const binary = process.env.GNUBG_BINARY ?? `${root}/games/gnubg`
  const data = process.env.GNUBG_DATA ?? `${root}/share/gnubg`
  const bridge =
    process.env.GNUBG_BRIDGE ??
    fileURLToPath(new URL('../bridge.py', import.meta.url))

  return {
    command: binary,
    args: [
      '-q',
      '-t',
      '-r',
      '-P',
      data,
      '-D',
      data,
      `--python=${bridge}`,
    ],
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class GnubgBridgeClient {
  readonly #command: BridgeCommand
  readonly #timeoutMs: number
  #child: ChildProcessWithoutNullStreams | null = null
  #pending: PendingRequest | null = null
  #nextId = 1
  #stdout = ''
  #stderr = ''
  #tail: Promise<unknown> = Promise.resolve()
  #disposed = false

  constructor(options: BridgeClientOptions = {}) {
    this.#command = options.command ?? defaultCommand()
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new RangeError('bridge timeout must be a positive number')
    }
  }

  rankMoves(params: RankMovesRequest): Promise<RankMovesResponse> {
    return this.#enqueue('rank_moves', params) as Promise<RankMovesResponse>
  }

  cubeDecision(params: CubeDecisionRequest): Promise<CubeDecisionResponse> {
    return this.#enqueue(
      'cube_decision',
      params,
    ) as Promise<CubeDecisionResponse>
  }

  async dispose(): Promise<void> {
    this.#disposed = true
    const child = this.#child
    this.#child = null
    this.#rejectPending(new GnubgBridgeError('GNU Backgammon bridge was disposed'))
    if (child === null || child.exitCode !== null) return

    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
      child.kill()
    })
  }

  #enqueue(
    method: BridgeRequest['method'],
    params: RankMovesRequest | CubeDecisionRequest,
  ): Promise<unknown> {
    const run = this.#tail.then(
      () => this.#request(method, params),
      () => this.#request(method, params),
    )
    this.#tail = run
    return run
  }

  #request(
    method: BridgeRequest['method'],
    params: RankMovesRequest | CubeDecisionRequest,
  ): Promise<unknown> {
    if (this.#disposed) {
      return Promise.reject(
        new GnubgBridgeError('GNU Backgammon bridge is disposed'),
      )
    }

    const child = this.#ensureChild()
    const id = this.#nextId
    this.#nextId += 1

    const request =
      method === 'rank_moves'
        ? { id, method, params: params as RankMovesRequest }
        : { id, method, params: params as CubeDecisionRequest }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending = null
        this.#discardChild(child)
        reject(
          new GnubgBridgeError(
            `GNU Backgammon request ${id} timed out after ${this.#timeoutMs}ms`,
          ),
        )
      }, this.#timeoutMs)

      this.#pending = { id, resolve, reject, timer }
      child.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
        if (error === null || error === undefined) return
        this.#rejectPending(
          new GnubgBridgeError(
            `could not write to GNU Backgammon bridge: ${error.message}`,
          ),
        )
        this.#discardChild(child)
      })
    })
  }

  #ensureChild(): ChildProcessWithoutNullStreams {
    if (this.#child !== null && this.#child.exitCode === null) return this.#child

    const child = spawn(this.#command.command, [...(this.#command.args ?? [])], {
      env: { ...process.env, ...this.#command.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.#child = child
    this.#stdout = ''
    this.#stderr = ''

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.#readStdout(chunk))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      this.#stderr = `${this.#stderr}${chunk}`.slice(-4_096)
    })
    child.once('error', (error) => {
      this.#rejectPending(
        new GnubgBridgeError(
          `could not start GNU Backgammon bridge: ${error.message}`,
        ),
      )
      if (this.#child === child) this.#child = null
    })
    child.once('exit', (code, signal) => {
      if (this.#child === child) this.#child = null
      const detail = this.#stderr.trim()
      this.#rejectPending(
        new GnubgBridgeError(
          `GNU Backgammon bridge exited before replying ` +
            `(${signal ?? `code ${code ?? 'unknown'}`})` +
            (detail === '' ? '' : `: ${detail}`),
        ),
      )
    })

    return child
  }

  #readStdout(chunk: string): void {
    this.#stdout += chunk

    for (;;) {
      const newline = this.#stdout.indexOf('\n')
      if (newline < 0) return

      const line = this.#stdout.slice(0, newline).trim()
      this.#stdout = this.#stdout.slice(newline + 1)
      if (!line.startsWith('{')) continue

      let response: BridgeResponse
      try {
        response = JSON.parse(line) as BridgeResponse
      } catch {
        continue
      }

      const pending = this.#pending
      if (pending === null || response.id !== pending.id) continue
      this.#pending = null
      clearTimeout(pending.timer)

      if (response.ok) {
        pending.resolve(response.result)
      } else {
        pending.reject(
          new GnubgBridgeError(`GNU Backgammon bridge error: ${response.error}`),
        )
      }
    }
  }

  #rejectPending(error: Error): void {
    const pending = this.#pending
    if (pending === null) return
    this.#pending = null
    clearTimeout(pending.timer)
    pending.reject(error)
  }

  #discardChild(child: ChildProcessWithoutNullStreams): void {
    if (this.#child === child) this.#child = null
    if (child.exitCode === null) child.kill()
  }
}

export function bridgeErrorMessage(error: unknown): string {
  return `GNU Backgammon unavailable: ${errorMessage(error)}`
}
