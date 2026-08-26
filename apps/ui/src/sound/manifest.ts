/**
 * Sound set. See docs/sound-spec.md, and PROVENANCE.md in the assets folder for
 * licensing — everything is CC0 and nothing else may be added.
 *
 * Components emit EVENTS. They never name a file.
 */

export type SoundEvent = 'place' | 'hit' | 'bar' | 'off' | 'dice' | 'cube' | 'win'

/** Vite resolves these at build time, so the files are hashed and bundled. */
const files = import.meta.glob<string>('../assets/sound/*.ogg', {
  eager: true,
  query: '?url',
  import: 'default',
})

function variantsFor(event: SoundEvent): string[] {
  return Object.entries(files)
    .filter(([path]) => path.includes(`/${event}-`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url)
}

export const SOUNDS: Readonly<Record<SoundEvent, readonly string[]>> = {
  place: variantsFor('place'),
  hit: variantsFor('hit'),
  bar: variantsFor('bar'),
  off: variantsFor('off'),
  dice: variantsFor('dice'),
  cube: variantsFor('cube'),
  win: variantsFor('win'),
}

/**
 * Events that repeat many times a game and therefore need real variation.
 * A single sample played identically reads as a rattle, which is worse than
 * silence — asserted in tests.
 */
export const NEEDS_VARIANTS: readonly SoundEvent[] = ['place', 'hit', 'off', 'dice']
