import type { Scenario } from '../../../shared/types.js'
import { listDataFiles, readDataFileText } from '../dataFs.js'

const SCENARIOS_DIR = 'scenarios'

function readScenarioFile(fileName: string): Scenario {
  const raw = readDataFileText(`${SCENARIOS_DIR}/${fileName}`)
  const scenario = JSON.parse(raw) as Scenario

  if (!scenario.id || !scenario.title || !scenario.stages?.length || !scenario.choices?.length || !scenario.rubric || !scenario.outcome) {
    throw new Error(`Scenario fixture "${fileName}" is missing required fields.`)
  }
  return scenario
}

// Loaded once at startup, from local fixtures only - never a live Yahoo
// call, so scenario content stays fixed and reproducible regardless of
// market data availability.
const scenarios: Scenario[] = listDataFiles(SCENARIOS_DIR)
  .filter((fileName) => fileName.endsWith('.json'))
  .map(readScenarioFile)

const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))

export function listScenarios(): Scenario[] {
  return scenarios
}

export function getScenario(id: string): Scenario | undefined {
  return scenariosById.get(id)
}
