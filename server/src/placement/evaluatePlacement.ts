import { evaluateRiskReadBlock } from '../grading/grader.js'
import type { DifficultyLevel, PlacementAnswer, PlacementMiniScenario, PlacementResult, RiskReadResult } from '../../../shared/types.js'

function evaluateMiniScenario(scenario: PlacementMiniScenario, answer: PlacementAnswer | undefined): RiskReadResult {
  const selectedFactorIds = answer?.selectedFactorIds ?? []
  return { id: scenario.id, ...evaluateRiskReadBlock(scenario.block, answer?.selectedReadId, selectedFactorIds) }
}

// Strict ">" for advancing a level: landing exactly on a threshold stays at
// the lower level. This is "on a borderline total, place lower" (CLAUDE.md)
// as a structural property of the comparison, not a separate fuzzy
// "is this borderline" check bolted on afterward.
const ADVANCED_THRESHOLD = 0.75
const INTERMEDIATE_THRESHOLD = 0.45

function levelForScore(totalScore: number): DifficultyLevel {
  if (totalScore > ADVANCED_THRESHOLD) return 'advanced'
  if (totalScore > INTERMEDIATE_THRESHOLD) return 'intermediate'
  return 'beginner'
}

/**
 * Pure. An unanswered mini-scenario (missing from `answers`) grades as
 * fully incorrect rather than being skipped or excluded from the average -
 * skipping a question isn't free.
 */
export function evaluatePlacement(miniScenarios: PlacementMiniScenario[], answers: PlacementAnswer[]): PlacementResult {
  const answersById = new Map(answers.map((answer) => [answer.miniScenarioId, answer]))
  const perScenario = miniScenarios.map((scenario) => evaluateMiniScenario(scenario, answersById.get(scenario.id)))

  const totalScore = perScenario.length > 0 ? perScenario.reduce((sum, result) => sum + result.combinedScore, 0) / perScenario.length : 0

  return { level: levelForScore(totalScore), totalScore, perScenario }
}
