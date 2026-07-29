import { describe, expect, it } from 'vitest'
import type { Scenario } from '../../../shared/types.js'
import { getDecisionPrices, getScenarioSummary, getStagePayload } from './stageGating.js'

function buildScenario(): Scenario {
  return {
    id: 'test-scenario',
    title: 'Test Scenario',
    difficulty: 'beginner',
    conceptTags: ['test'],
    companyContext: 'A hypothetical test company.',
    priceSeed: [{ day: 0, open: 100, high: 101, low: 99, close: 100 }],
    stages: [
      { index: 0, kind: 'headline', headline: 'Stage zero headline' },
      { index: 1, kind: 'fundamentals', fundamentals: { 'P/E': 20 } },
      { index: 2, kind: 'price', priceThroughDay: 10 }
    ],
    choices: [
      { id: 'hold', label: 'Hold' },
      { id: 'sell_all', label: 'Sell' }
    ],
    rubric: {
      soundChoiceIds: ['hold'],
      acceptableChoiceIds: [],
      criteria: [{ id: 'crit_a', description: 'Some criterion', weight: 100, factorOptionIds: ['genuine'] }],
      factorOptions: [
        { id: 'genuine', label: 'A genuine driver', correct: true },
        { id: 'distractor', label: 'A plausible distractor', correct: false }
      ],
      idealSummary: 'SECRET IDEAL SUMMARY'
    },
    outcome: {
      summary: 'SECRET OUTCOME SUMMARY',
      priceSeries: [
        { day: 0, open: 100, high: 101, low: 99, close: 100 },
        { day: 10, open: 108, high: 112, low: 107, close: 110 },
        { day: 20, open: 110, high: 132, low: 109, close: 130 }
      ],
      grossReturnPercent: 30,
      outcomeCategory: 'modest_gain'
    },
    survivorshipNote: 'test note'
  }
}

describe('getScenarioSummary', () => {
  it('strips stages, choices, rubric, and outcome', () => {
    const summary = getScenarioSummary(buildScenario())
    expect(summary).toEqual({ id: 'test-scenario', title: 'Test Scenario', difficulty: 'beginner', conceptTags: ['test'] })
    expect(JSON.stringify(summary)).not.toContain('SECRET')
  })
})

describe('getStagePayload', () => {
  it('returns only the requested stage, never a later stage, rubric, or outcome', () => {
    const payload = getStagePayload(buildScenario(), 0)
    expect(payload).not.toBeNull()
    expect(payload!.stage.index).toBe(0)
    expect(payload!.isFinalStage).toBe(false)
    expect(payload!.choices).toBeUndefined()

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('SECRET')
    // Stage 1's and stage 2's own fields must not leak into stage 0's payload.
    expect(serialized).not.toContain('P/E')
    expect(serialized).not.toContain('priceThroughDay')
    expect(payload).not.toHaveProperty('rubric')
    expect(payload).not.toHaveProperty('outcome')
  })

  it('includes the choices (action menu) only on the final stage', () => {
    const scenario = buildScenario()
    const early = getStagePayload(scenario, 1)
    const final = getStagePayload(scenario, 2)

    expect(early!.isFinalStage).toBe(false)
    expect(early!.choices).toBeUndefined()
    expect(final!.isFinalStage).toBe(true)
    expect(final!.choices).toEqual(scenario.choices)
  })

  it('includes factorOptions only on the final stage, stripped of which one is correct', () => {
    const scenario = buildScenario()
    const early = getStagePayload(scenario, 1)
    const final = getStagePayload(scenario, 2)

    expect(early!.factorOptions).toBeUndefined()
    expect(final!.factorOptions).toEqual([
      { id: 'genuine', label: 'A genuine driver' },
      { id: 'distractor', label: 'A plausible distractor' }
    ])
    expect(JSON.stringify(final)).not.toContain('correct')
  })

  it('returns null for an out-of-range or non-integer index instead of leaking anything', () => {
    const scenario = buildScenario()
    expect(getStagePayload(scenario, -1)).toBeNull()
    expect(getStagePayload(scenario, 3)).toBeNull()
    expect(getStagePayload(scenario, 1.5)).toBeNull()
  })
})

describe('getDecisionPrices', () => {
  it('reads the entry price from the last price-reveal day and the exit price from the final outcome point', () => {
    const { entryPrice, exitPrice } = getDecisionPrices(buildScenario())
    expect(entryPrice).toBe(110)
    expect(exitPrice).toBe(130)
  })
})
