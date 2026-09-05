/**
 * Sound playback. See docs/sound-spec.md.
 *
 * Components emit EVENTS, never filenames, and the event fires at the moment the
 * thing happens on screen — a checker's click belongs to its landing, not to its
 * pick-up. Getting that wrong is audible immediately.
 */

import { NEEDS_VARIANTS, SOUNDS, type SoundEvent } from './manifest'

export interface PlayRecord {
  t: number
  event: SoundEvent
  variant: number
  gain: number
  rate: number
}

const VOLUME_KEY = 'nard.volume'

class SoundPlayer {
  #ctx: AudioContext | null = null
  #buffers = new Map<SoundEvent, (AudioBuffer | null)[]>()
  #lastVariant = new Map<SoundEvent, number>()
  #volume = 0.7
  #loading: Promise<void> | null = null

  /** Recent plays, for the verification harness. Bounded; not a leak. */
  readonly log: PlayRecord[] = []

  constructor() {
    try {
      const stored = localStorage.getItem(VOLUME_KEY)
      if (stored !== null) this.#volume = Math.min(1, Math.max(0, Number(stored)))
    } catch {
      // Private browsing and blocked storage both throw. A default is fine.
    }
  }

  get volume(): number {
    return this.#volume
  }

  setVolume(v: number): void {
    this.#volume = Math.min(1, Math.max(0, v))
    try {
      localStorage.setItem(VOLUME_KEY, String(this.#volume))
    } catch {
      // Not worth caring about; the setting simply will not persist.
    }
  }

  /**
   * Browsers refuse to start audio without a user gesture, so this is called
   * from the first interaction rather than at startup.
   */
  async unlock(): Promise<void> {
    if (!this.#ctx) {
      const Ctor = globalThis.AudioContext ?? (globalThis as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.#ctx = new Ctor()
    }
    if (this.#ctx.state === 'suspended') await this.#ctx.resume()
    this.#loading ??= this.#loadAll()
    await this.#loading
  }

  async #loadAll(): Promise<void> {
    const ctx = this.#ctx
    if (!ctx) return
    await Promise.all(
      (Object.keys(SOUNDS) as SoundEvent[]).map(async (event) => {
        const urls = SOUNDS[event]
        const decoded = await Promise.all(
          urls.map(async (url) => {
            try {
              const res = await fetch(url)
              return await ctx.decodeAudioData(await res.arrayBuffer())
            } catch {
              return null // one bad file must not silence the whole game
            }
          }),
        )
        this.#buffers.set(event, decoded)
      }),
    )
  }

  /**
   * Pick a variant, never the same one twice running.
   *
   * A repeated sample played identically reads as a rattle within one game —
   * this is the difference between "a board" and "a computer".
   */
  #pickVariant(event: SoundEvent, count: number): number {
    if (count <= 1) return 0
    const last = this.#lastVariant.get(event)
    let i = Math.floor(Math.random() * count)
    if (i === last) i = (i + 1 + Math.floor(Math.random() * (count - 1))) % count
    this.#lastVariant.set(event, i)
    return i
  }

  /**
   * `rate` multiplies the pitch. Used to make one sample serve two moments
   * that belong together — a checker being lifted is the same click as one
   * being set down, lighter and higher, and a second recorded sample for it
   * would be a download for no gain.
   */
  play(event: SoundEvent, opts: { gain?: number; rate?: number } = {}): void {
    const ctx = this.#ctx
    if (!ctx || this.#volume === 0) return
    // Silent when the window is not focused. Always.
    if (typeof document !== 'undefined' && document.hidden) return

    const bank = this.#buffers.get(event)
    if (!bank || bank.length === 0) return
    const variant = this.#pickVariant(event, bank.length)
    const buffer = bank[variant]
    if (!buffer) return

    // Jitter, so repeats are never bit-identical.
    const rate = (opts.rate ?? 1) * (1 + (Math.random() - 0.5) * 0.16)
    const gain = this.#volume * (opts.gain ?? 1) * (1 + (Math.random() - 0.5) * 0.2)

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    const g = ctx.createGain()
    g.gain.value = Math.min(1, gain)
    src.connect(g).connect(ctx.destination)
    src.start()

    this.log.push({ t: performance.now(), event, variant, gain, rate })
    if (this.log.length > 400) this.log.splice(0, 200)
  }

  /** Which events have too few samples to avoid sounding mechanical. */
  underVaried(): SoundEvent[] {
    return NEEDS_VARIANTS.filter((e) => (SOUNDS[e]?.length ?? 0) < 3)
  }
}

export const sound = new SoundPlayer()
