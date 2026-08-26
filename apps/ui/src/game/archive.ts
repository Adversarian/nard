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

/**
 * A match's PR, once it has been reviewed.
 *
 * Kept separately from the match record because analysis is on demand and
 * expensive — a match is a few kilobytes but analysing one is thousands of
 * evaluator calls. Recomputing the whole history to draw a chart would be
 * absurd, so the figure is remembered the first time it is produced.
 */
export interface PrPoint {
  readonly id: string
  readonly at: string
  readonly checkerPr: number
  readonly cubePr: number | null
  readonly opponentId: string
}

const PR_KEY = 'nard.prhistory'

export function prHistory(): PrPoint[] {
  try {
    return JSON.parse(localStorage.getItem(PR_KEY) ?? '[]') as PrPoint[]
  } catch {
    return []
  }
}

export function recordPr(point: PrPoint): void {
  try {
    const rows = prHistory().filter((r) => r.id !== point.id)
    rows.push(point)
    rows.sort((a, b) => a.at.localeCompare(b.at))
    localStorage.setItem(PR_KEY, JSON.stringify(rows.slice(-LIMIT)))
  } catch {
    // Storage blocked; the chart simply will not fill in.
  }
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
