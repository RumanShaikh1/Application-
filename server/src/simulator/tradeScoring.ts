import type { RubricCriterionResult } from '../../../shared/types.js'
import { weightedCriteriaScore } from '../scoring.js'

const MAX_SCORE = 100

export interface TradeScoreResult {
  scoreTotal: number
  maxScore: number
}

/**
 * Deterministic scoring, same principle as scenarios/rubricScoring.ts's
 * scoreDecision - Gemini never produces a number. Simpler than Decision
 * Replay's version since there's no "choice quality" concept for a live
 * symbol (you can trade anything), so it's the weighted criteria score
 * directly: two criteria already deterministically scored by
 * portfolioEngine.ts, two scored from Gemini's rationale classification.
 */
export function scoreTradeProcess(criteria: RubricCriterionResult[]): TradeScoreResult {
  const credit = weightedCriteriaScore(criteria)
  return { scoreTotal: Math.round(credit * MAX_SCORE), maxScore: MAX_SCORE }
}
