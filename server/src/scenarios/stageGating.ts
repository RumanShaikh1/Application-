import type { OHLCPoint, PublicSelectOption, Scenario, ScenarioStagePayload, ScenarioSummary, SelectOption } from '../../../shared/types.js'

function stripCorrectness(options: SelectOption[]): PublicSelectOption[] {
  return options.map(({ id, label }) => ({ id, label }))
}

export function getScenarioSummary(scenario: Scenario): ScenarioSummary {
  return {
    id: scenario.id,
    title: scenario.title,
    difficulty: scenario.difficulty,
    conceptTags: scenario.conceptTags
  }
}

/**
 * The single source of truth for what a stage request may return. Returns
 * null for any out-of-range or non-integer index so the route can 404. The
 * returned object is built field-by-field from the requested stage only -
 * never spread from the whole scenario - so it can never carry `rubric`,
 * `outcome`, or a later stage's content. That guarantee is what
 * stageGating.test.ts pins down.
 */
export function getStagePayload(scenario: Scenario, stageIndex: number): ScenarioStagePayload | null {
  if (!Number.isInteger(stageIndex) || stageIndex < 0) return null

  const stage = scenario.stages[stageIndex]
  if (!stage) return null

  const totalStages = scenario.stages.length
  const isFinalStage = stageIndex === totalStages - 1

  return {
    scenarioId: scenario.id,
    stageIndex,
    totalStages,
    isFinalStage,
    companyContext: scenario.companyContext,
    priceSeed: scenario.priceSeed,
    stage,
    // The action menu isn't a spoiler - the choices themselves reveal
    // nothing about which one is sound - but it only makes sense to show
    // once every informational stage has been seen.
    choices: isFinalStage ? scenario.choices : undefined,
    // Same reasoning as choices, plus `correct` is stripped so the answer
    // key never reaches the client before grading (see shared/types.ts's
    // PublicSelectOption).
    factorOptions: isFinalStage ? stripCorrectness(scenario.rubric.factorOptions) : undefined
  }
}

/**
 * The decision-day price (last price visible before the user answers) and
 * the final outcome price, both read off the scenario's own full price
 * series so they're always internally consistent with what was actually
 * shown. Used to feed the cost model when scoring an answer.
 */
export function getDecisionPrices(scenario: Scenario): { entryPrice: number; exitPrice: number } {
  const lastPriceStage = [...scenario.stages].reverse().find((stage) => stage.kind === 'price' && typeof stage.priceThroughDay === 'number')
  const entryDay = lastPriceStage?.priceThroughDay ?? scenario.priceSeed[scenario.priceSeed.length - 1]?.day ?? 0

  const series = scenario.outcome.priceSeries
  const entryPoint = series.find((point: OHLCPoint) => point.day === entryDay) ?? series[0]
  const exitPoint = series[series.length - 1]

  return { entryPrice: entryPoint.close, exitPrice: exitPoint.close }
}
