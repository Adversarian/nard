/**
 * Player settings. Persisted locally; there is no server and no account.
 *
 * URL parameters still override, because the screenshot and motion harnesses
 * address a specific theme and language and must not depend on whatever was
 * last chosen (docs/playtesting.md).
 */

import { create } from 'zustand'
import type { HomeSide } from '../board/geometry'
import type { Lang } from '../i18n'
import { sound } from '../sound/player'

export type Theme = 'khatam' | 'tournament' | 'kaghaz'

export interface Settings {
  theme: Theme
  lang: Lang
  /** Which side the player's home board sits on. A preference, never tied to
   *  interface language — see docs/design-language.md. */
  home: HomeSide
  volume: number
}

const KEY = 'nard.settings'

const DEFAULTS: Settings = { theme: 'khatam', lang: 'en', home: 'right', volume: 0.7 }

function load(): Settings {
  let stored: Partial<Settings> = {}
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>
  } catch {
    // Blocked storage just means defaults.
  }
  const params = new URLSearchParams(location.search)
  const urlTheme = params.get('theme') as Theme | null
  const urlLang = params.get('lang') as Lang | null
  return {
    ...DEFAULTS,
    ...stored,
    ...(urlTheme ? { theme: urlTheme } : {}),
    ...(urlLang ? { lang: urlLang } : {}),
  }
}

interface SettingsStore extends Settings {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  set(key, value) {
    set({ [key]: value } as Pick<Settings, typeof key>)
    if (key === 'volume') sound.setVolume(value as number)
    const { theme, lang, home, volume } = get()
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme, lang, home, volume }))
    } catch {
      // Not worth guarding; the setting simply will not persist.
    }
  },
}))
