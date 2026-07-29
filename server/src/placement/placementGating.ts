import type { PlacementMiniScenario, PlacementMiniScenarioPublic, PublicSelectOption, SelectOption } from '../../../shared/types.js'

function stripCorrectness(options: SelectOption[]): PublicSelectOption[] {
  return options.map(({ id, label }) => ({ id, label }))
}

/**
 * Never send `correct` to the client before grading - the same reasoning as
 * ScenarioStagePayload never including the rubric. Anyone with the browser
 * network tab open would otherwise be able to read the answer key.
 */
export function getPlacementPayload(miniScenarios: PlacementMiniScenario[]): PlacementMiniScenarioPublic[] {
  return miniScenarios.map((scenario) => ({
    id: scenario.id,
    context: scenario.context,
    block: {
      question: scenario.block.question,
      readOptions: stripCorrectness(scenario.block.readOptions),
      factorQuestion: scenario.block.factorQuestion,
      factorOptions: stripCorrectness(scenario.block.factorOptions)
    }
  }))
}
