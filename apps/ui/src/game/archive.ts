/**
 * Saved matches.
 *
 * Every completed match is kept, because the analysis, the PR history and the
 * drills are all derived from the record rather than accumulated as the game is
 * played. A match is a seed, a commitment and a list of decisions — a few
 * kilobytes — so keeping all of them costs nothing.
 *
 * Browser storage here; the packaged build writes to the app data directory
 * through the platform seam (docs/architecture.md §"Data that persists").
 */

import { loadMatch, saveMatch, type SavedMatchV1 } from '@nard/analysis'

const KEY = 'nard.matches'
/** Enough for years of play at a few kilobytes each, and well under any quota. */
const LIMIT = 500

export interface ArchivedMatch {
  readonly id: string
  readonly saved: SavedMatchV1
}

export function listMatches(): ArchivedMatch[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const rows = JSON.parse(raw) as { id: string; json: string }[]
    return rows.flatMap((row) => {
      try {
        return [{ id: row.id, saved: loadMatch(row.json) }]
      } catch {
        // One unreadable record must not take the rest of the history with it.
        return []
      }
    })
  } catch {
    return []
  }
}

export function archiveMatch(saved: SavedMatchV1): string | null {
  const id = `${saved.meta.startedAt}-${saved.commitment.slice(0, 8)}`
  try {
    const raw = localStorage.getItem(KEY)
    const rows = raw ? (JSON.parse(raw) as { id: string; json: string }[]) : []
    if (rows.some((r) => r.id === id)) return id
    rows.push({ id, json: saveMatch(saved) })
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-LIMIT)))
    return id
  } catch {
    return null
  }
}

export function findMatch(id: string): SavedMatchV1 | null {
  return listMatches().find((m) => m.id === id)?.saved ?? null
}
