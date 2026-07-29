import type { Band, BandCredit, RiskReadBlock, RiskReadResult, SelectOption } from '../../../shared/types.js'

/**
 * The one deterministic grader behind placement, the case-study tier
 * ladder, and the existing-scenario factor cleanup - see CLAUDE.md's
 * Product Invariants ("no API, ever, in the grading path"). Every gradeable
 * input in those three features reduces to one of these three shapes:
 * pick-one, pick-many-with-distractors, or where-does-a-value-fall-on-a-
 * scale. Nothing here scores free text - that stays a separate, capped,
 * optional bonus (matchRationale.ts).
 */

export function scoreSingleSelect(options: SelectOption[], selectedId: string | undefined): boolean {
  if (selectedId === undefined) return false
  return options.find((option) => option.id === selectedId)?.correct === true
}

export interface MultiSelectResult {
  /** Correct-minus-incorrect, floored at zero, normalised to the number of correct options available (0 to 1). */
  score: number
  correctSelected: string[]
  incorrectSelected: string[]
  missedCorrect: string[]
}

/**
 * correct-minus-incorrect, floored at zero: guessing everything scores the
 * same as guessing nothing, but a genuinely partial, honest answer still
 * earns partial credit. Ids that don't match any authored option are
 * ignored outright - untrusted input naming an option that doesn't exist
 * neither helps nor hurts, the same way an unrecognised criterion id from
 * Gemini gets dropped rather than trusted (see rubricScoring.ts).
 */
export function scoreMultiSelect(options: SelectOption[], selectedIds: string[]): MultiSelectResult {
  const byId = new Map(options.map((option) => [option.id, option]))
  const totalCorrect = options.filter((option) => option.correct).length

  const correctSelected: string[] = []
  const incorrectSelected: string[] = []
  for (const id of selectedIds) {
    const option = byId.get(id)
    if (!option) continue
    if (option.correct) correctSelected.push(id)
    else incorrectSelected.push(id)
  }

  const selectedSet = new Set(selectedIds)
  const missedCorrect = options.filter((option) => option.correct && !selectedSet.has(option.id)).map((option) => option.id)

  const rawScore = correctSelected.length - incorrectSelected.length
  const score = totalCorrect > 0 ? Math.max(0, rawScore) / totalCorrect : 0

  return { score, correctSelected, incorrectSelected, missedCorrect }
}

export interface BandResult {
  credit: BandCredit
  band: Band | undefined
}

/** A value outside every authored band defaults to zero credit - an unanticipated bucket is never silently rewarded. */
export function scoreBand(bands: Band[], value: number): BandResult {
  const band = bands.find((candidate) => value >= candidate.min && value <= candidate.max)
  return { credit: band?.credit ?? 'zero', band }
}

export const BAND_CREDIT_VALUE: Record<BandCredit, number> = {
  full: 1,
  partial: 0.5,
  zero: 0
}

// The read is the primary judgment under test ("grade judgment, not
// vocabulary" - CLAUDE.md); the factor list shows the reasoning behind it,
// worth less on its own. Shared by placement and the case-study tier-1
// risk_read tier - the one RiskReadBlock mechanic, graded in exactly one
// place, per CLAUDE.md's "do not duplicate scoring logic."
const RISK_READ_WEIGHT = 0.6

/** Grades one RiskReadBlock. Callers attach whatever `id` identifies the scenario/tier - the mechanic itself doesn't know or care which. */
export function evaluateRiskReadBlock(block: RiskReadBlock, selectedReadId: string | undefined, selectedFactorIds: string[]): Omit<RiskReadResult, 'id'> {
  const readCorrect = scoreSingleSelect(block.readOptions, selectedReadId)
  const factorResult = scoreMultiSelect(block.factorOptions, selectedFactorIds)

  const combinedScore = (readCorrect ? 1 : 0) * RISK_READ_WEIGHT + factorResult.score * (1 - RISK_READ_WEIGHT)

  return {
    readCorrect,
    correctReadIds: block.readOptions.filter((option) => option.correct).map((option) => option.id),
    factorScore: factorResult.score,
    correctFactorIds: factorResult.correctSelected,
    incorrectlySelectedFactorIds: factorResult.incorrectSelected,
    missedFactorIds: factorResult.missedCorrect,
    combinedScore
  }
}
