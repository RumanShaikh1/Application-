import { describe, expect, it } from 'vitest'
import { evaluatePlacement } from './evaluatePlacement.js'
import { listPlacementMiniScenarios } from './loadPlacement.js'
import type { PlacementAnswer, PlacementMiniScenario } from '../../../shared/types.js'

function miniScenario(overrides: Partial<PlacementMiniScenario> & { id: string }): PlacementMiniScenario {
  return {
    context: 'context',
    block: {
      readOptions: [
        { id: 'correct_read', label: 'correct', correct: true },
        { id: 'wrong_read', label: 'wrong', correct: false }
      ],
      factorOptions: [{ id: 'f1', label: 'f1', correct: true }]
    },
    ...overrides
  }
}

describe('evaluatePlacement - full/zero credit', () => {
  it('perfect answers across every mini-scenario place at advanced', () => {
    const scenarios = [miniScenario({ id: 'a' }), miniScenario({ id: 'b' }), miniScenario({ id: 'c' })]
    const answers: PlacementAnswer[] = scenarios.map((s) => ({ miniScenarioId: s.id, selectedReadId: 'correct_read', selectedFactorIds: ['f1'] }))

    const result = evaluatePlacement(scenarios, answers)
    expect(result.level).toBe('advanced')
    expect(result.totalScore).toBe(1)
    expect(result.perScenario).toHaveLength(3)
  })

  it('every answer wrong places at beginner', () => {
    const scenarios = [miniScenario({ id: 'a' }), miniScenario({ id: 'b' }), miniScenario({ id: 'c' })]
    const answers: PlacementAnswer[] = scenarios.map((s) => ({ miniScenarioId: s.id, selectedReadId: 'wrong_read', selectedFactorIds: [] }))

    const result = evaluatePlacement(scenarios, answers)
    expect(result.level).toBe('beginner')
    expect(result.totalScore).toBe(0)
  })

  it('an unanswered mini-scenario grades as fully incorrect, not skipped', () => {
    const scenarios = [miniScenario({ id: 'a' }), miniScenario({ id: 'b' })]
    // Only "a" answered, "b" has no matching answer at all.
    const answers: PlacementAnswer[] = [{ miniScenarioId: 'a', selectedReadId: 'correct_read', selectedFactorIds: ['f1'] }]

    const result = evaluatePlacement(scenarios, answers)
    const unanswered = result.perScenario.find((r) => r.id === 'b')!
    expect(unanswered.readCorrect).toBe(false)
    expect(unanswered.factorScore).toBe(0)
    expect(unanswered.combinedScore).toBe(0)
  })
})

describe('evaluatePlacement - borderline totals resolve to the lower level', () => {
  it('a total exactly at the intermediate threshold (0.45) places at beginner, not intermediate', () => {
    // Scenario A: read correct (0.6 * 1 = 0.6), zero factors selected (0.4 * 0 = 0) -> combined 0.6.
    const scenarioA = miniScenario({
      id: 'a',
      block: {
        readOptions: [
          { id: 'correct_read', label: 'correct', correct: true },
          { id: 'wrong_read', label: 'wrong', correct: false }
        ],
        factorOptions: [{ id: 'f1', label: 'f1', correct: true }]
      }
    })
    // Scenario B: read wrong (0.6 * 0 = 0), 3 of 4 correct factors selected, 0 incorrect (0.4 * 0.75 = 0.3) -> combined 0.3.
    const scenarioB = miniScenario({
      id: 'b',
      block: {
        readOptions: [
          { id: 'correct_read', label: 'correct', correct: false },
          { id: 'other_read', label: 'other', correct: true }
        ],
        factorOptions: [
          { id: 'f1', label: 'f1', correct: true },
          { id: 'f2', label: 'f2', correct: true },
          { id: 'f3', label: 'f3', correct: true },
          { id: 'f4', label: 'f4', correct: true }
        ]
      }
    })
    const answers: PlacementAnswer[] = [
      { miniScenarioId: 'a', selectedReadId: 'correct_read', selectedFactorIds: [] },
      { miniScenarioId: 'b', selectedReadId: 'correct_read', selectedFactorIds: ['f1', 'f2', 'f3'] }
    ]

    const result = evaluatePlacement([scenarioA, scenarioB], answers)
    expect(result.totalScore).toBeCloseTo(0.45, 10) // (0.6 + 0.3) / 2
    expect(result.level).toBe('beginner')
  })

  it('a total exactly at the advanced threshold (0.75) places at intermediate, not advanced', () => {
    // Scenario A: read correct, zero factors -> combined 0.6.
    const scenarioA = miniScenario({ id: 'a' })
    // Scenario B: read correct (0.6), 3 of 4 correct factors selected, 0 incorrect (0.4 * 0.75 = 0.3) -> combined 0.9.
    const scenarioB = miniScenario({
      id: 'b',
      block: {
        readOptions: [
          { id: 'correct_read', label: 'correct', correct: true },
          { id: 'wrong_read', label: 'wrong', correct: false }
        ],
        factorOptions: [
          { id: 'f1', label: 'f1', correct: true },
          { id: 'f2', label: 'f2', correct: true },
          { id: 'f3', label: 'f3', correct: true },
          { id: 'f4', label: 'f4', correct: true }
        ]
      }
    })
    const answers: PlacementAnswer[] = [
      { miniScenarioId: 'a', selectedReadId: 'correct_read', selectedFactorIds: [] },
      { miniScenarioId: 'b', selectedReadId: 'correct_read', selectedFactorIds: ['f1', 'f2', 'f3'] }
    ]

    const result = evaluatePlacement([scenarioA, scenarioB], answers)
    expect(result.totalScore).toBeCloseTo(0.75, 10) // (0.6 + 0.9) / 2
    expect(result.level).toBe('intermediate')
  })

  it('a total just above the advanced threshold does place at advanced', () => {
    const scenarioA = miniScenario({ id: 'a' })
    const answers: PlacementAnswer[] = [{ miniScenarioId: 'a', selectedReadId: 'correct_read', selectedFactorIds: ['f1'] }]
    const result = evaluatePlacement([scenarioA], answers)
    expect(result.totalScore).toBe(1)
    expect(result.level).toBe('advanced')
  })
})

describe('evaluatePlacement - against the real shipped fixtures', () => {
  it('loads at least 3 mini-scenarios, each with a valid single correct read and at least one distractor', () => {
    const scenarios = listPlacementMiniScenarios()
    expect(scenarios.length).toBeGreaterThanOrEqual(3)
    for (const scenario of scenarios) {
      const correctReads = scenario.block.readOptions.filter((o) => o.correct)
      expect(correctReads.length, `scenario "${scenario.id}" has no correct read option`).toBeGreaterThanOrEqual(1)
      const distractors = scenario.block.factorOptions.filter((o) => !o.correct)
      expect(distractors.length, `scenario "${scenario.id}" has no distractor factor options`).toBeGreaterThanOrEqual(1)
    }
  })

  it('a genuine, well-reasoned answer to every real fixture places at advanced', () => {
    const scenarios = listPlacementMiniScenarios()
    const answers: PlacementAnswer[] = scenarios.map((scenario) => ({
      miniScenarioId: scenario.id,
      selectedReadId: scenario.block.readOptions.find((o) => o.correct)!.id,
      selectedFactorIds: scenario.block.factorOptions.filter((o) => o.correct).map((o) => o.id)
    }))

    const result = evaluatePlacement(scenarios, answers)
    expect(result.level).toBe('advanced')
    expect(result.totalScore).toBe(1)
  })
})
