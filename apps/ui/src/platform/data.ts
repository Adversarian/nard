/**
 * Native persistence locations from docs/architecture.md.
 *
 * Browser development deliberately returns null: it has no OS app-data
 * directory and its existing localStorage behaviour must remain unchanged.
 * Future persistence readers and writers consume this module rather than
 * importing Tauri or constructing platform paths themselves.
 */

import { invokeTauri, isTauri } from './tauri'

export interface AppDataPaths {
  readonly root: string
  readonly matches: string
  readonly profile: string
  readonly drills: string
}

export async function appDataPaths(): Promise<AppDataPaths | null> {
  if (!isTauri()) return null
  return invokeTauri<AppDataPaths>('local_data_paths')
}
