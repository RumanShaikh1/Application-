import type { ChoiceQuality, Rubric, RubricCriterionResult } from '../../../shared/types.js'
import { weightedCriteriaScore } from '../scoring.js'
import { scoreMultiSelect } from '../grading/grader.js'
import { evaluateRationaleLocally, generateFeedback } from './matchRationale.js'

export interface CriterionMatch {
  id: string
  matched: boolean
  evidence?: string
}

/** Shape of a single criterion match as it might arrive from Gemini - untrusted until normalized. Still used by the Simulator (simulator/evaluateTradeRationale.ts), which is unaffected by this module's Decision-Replay-specific rewrite. */
export interface RawCriterionMatch {
  id?: unknown
  matched?: unknown
  evidence?: unknown
}

export interface ScoreResult {
  scoreTotal: number
  maxScore: number
  choiceQuality: ChoiceQuality
  criteria: RubricCriterionResult[]
  feedback: string
}

const MAX_SCORE = 100
// 70% "did you pick a defensible action", 30% "did you select the factors
// that actually support it" - the load-bearing rationale signal is now a
// distractor-aware multi-select (see CLAUDE.md's Product Invariants:
// "grade judgment, not vocabulary"), graded by the same shared grader as
// placement and the case-study ladder. Free text is optional and capped -
// see MAX_RATIONALE_BONUS below.
const CHOICE_WEIGHT = 0.7
const ACCEPTABLE_CHOICE_CREDIT = 0.6
// Out of the 100-point scale, and only ever additive up to that ceiling -
// free text can nudge the number, never flip a poor choice into a sound
// one, and never push the total past what a perfect factor-select already
// earns. That's what "never load-bearing" means as code, not just as a
// stated intention.
const MAX_RATIONALE_BONUS = 5

function classifyChoice(rubric: Rubric, chosenId: string): ChoiceQuality {
  if (rubric.soundChoiceIds.includes(chosenId)) return 'sound'
  if (rubric.acceptableChoiceIds.includes(chosenId)) return 'acceptable'
  return 'poor'
}

/**
 * Validates Gemini's raw criteria-match output against the rubric's actual
 * criteria ids: any id it invents is dropped, any id it omits is filled in
 * as unmatched. This is what makes "the model can't invent criteria" true
 * even if it doesn't fully respect the response schema.
 */
export function normalizeCriteriaMatches(rubric: Rubric, raw: RawCriterionMatch[] | null | undefined): CriterionMatch[] {
  const validIds = new Set(rubric.criteria.map((criterion) => criterion.id))
  const byId = new Map<string, CriterionMatch>()

  for (const entry of raw ?? []) {
    if (typeof entry?.id !== 'string' || !validIds.has(entry.id)) continue
    byId.set(entry.id, {
      id: entry.id,
      matched: entry.matched === true,
      evidence: typeof entry.evidence === 'string' ? entry.evidence : undefined
    })
  }

  return rubric.criteria.map((criterion) => byId.get(criterion.id) ?? { id: criterion.id, matched: false })
}

/**
 * Deterministic scoring - the only inputs are the rubric (authored), the
 * chosen action, and which factor options the user selected (graded by the
 * shared grader, same as placement and the case-study ladder). `rationale`
 * is optional and, if present, contributes only the small capped bonus
 * below via the legacy matchConcepts matcher - it never decides
 * `choiceQuality` and never changes which criteria are marked matched.
 */
export function scoreDecision(rubric: Rubric, chosenId: string, selectedFactorIds: string[], rationale?: string): ScoreResult {
  const choiceQuality = classifyChoice(rubric, chosenId)
  const choiceCredit = choiceQuality === 'sound' ? 1 : choiceQuality === 'acceptable' ? ACCEPTABLE_CHOICE_CREDIT : 0

  const factorResult = scoreMultiSelect(rubric.factorOptions, selectedFactorIds)
  const correctSelectedSet = new Set(factorResult.correctSelected)

  const criteria: RubricCriterionResult[] = rubric.criteria.map((criterion) => {
    const linkedFactorIds = criterion.factorOptionIds ?? []
    const matchedFactorId = linkedFactorIds.find((id) => correctSelectedSet.has(id))
    const matched = matchedFactorId !== undefined
    return {
      id: criterion.id,
      description: criterion.description,
      weight: criterion.weight,
      matched,
      evidence: matched ? rubric.factorOptions.find((option) => option.id === matchedFactorId)?.label : undefined
    }
  })

  const criteriaCredit = weightedCriteriaScore(criteria)

  const baseScoreTotal = Math.round((choiceCredit * CHOICE_WEIGHT + criteriaCredit * (1 - CHOICE_WEIGHT)) * MAX_SCORE)

  let scoreTotal = baseScoreTotal
  if (rationale && rationale.trim()) {
    const bonusMatches = evaluateRationaleLocally(rubric, rationale).criteriaMatches
    const bonusMatchedCount = bonusMatches.filter((match) => match.matched).length
    const bonusFraction = rubric.criteria.length > 0 ? bonusMatchedCount / rubric.criteria.length : 0
    const bonus = Math.round(bonusFraction * MAX_RATIONALE_BONUS)
    scoreTotal = Math.min(MAX_SCORE, baseScoreTotal + bonus)
  }

  const feedback = generateFeedback(
    rubric,
    criteria.map((criterion) => ({ id: criterion.id, matched: criterion.matched }))
  )

  return { scoreTotal, maxScore: MAX_SCORE, choiceQuality, criteria, feedback }
}
