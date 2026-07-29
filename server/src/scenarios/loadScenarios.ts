import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Scenario } from '../../../shared/types.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const SCENARIOS_DIR = join(currentDir, '../../data/scenarios')

function readScenarioFile(fileName: string): Scenario {
  const raw = readFileSync(join(SCENARIOS_DIR, fileName), 'utf-8')
  const scenario = JSON.parse(raw) as Scenario

  if (!scenario.id || !scenario.title || !scenario.stages?.length || !scenario.choices?.length || !scenario.rubric || !scenario.outcome) {
    throw new Error(`Scenario fixture "${fileName}" is missing required fields.`)
  }
  return scenario
}

// Loaded once at startup, from local fixtures only - never a live Yahoo
// call, so scenario content stays fixed and reproducible regardless of
// market data availability.
const scenarios: Scenario[] = readdirSync(SCENARIOS_DIR)
  .filter((fileName) => fileName.endsWith('.json'))
  .map(readScenarioFile)

const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))

export function listScenarios(): Scenario[] {
  return scenarios
}

export function getScenario(id: string): Scenario | undefined {
  return scenariosById.get(id)
}
