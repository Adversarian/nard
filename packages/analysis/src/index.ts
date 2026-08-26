/**
 * @nard/analysis — equity loss, performance rating, luck/skill decomposition.
 * See docs/analysis-spec.md. Lands in M5.
 */

export type ErrorBand = 'good' | 'doubtful' | 'error' | 'blunder'

/** Conventional thresholds, so our numbers mean what they mean elsewhere. */
export const ERROR_THRESHOLDS = {
  doubtful: -0.02,
  error: -0.04,
  blunder: -0.08,
} as const

export function bandFor(equityError: number): ErrorBand {
  if (equityError > ERROR_THRESHOLDS.doubtful) return 'good'
  if (equityError > ERROR_THRESHOLDS.error) return 'doubtful'
  if (equityError > ERROR_THRESHOLDS.blunder) return 'error'
  return 'blunder'
}
