import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PlacementMiniScenario } from '../../../shared/types.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const PLACEMENT_DIR = join(currentDir, '../../data/placement')

function readMiniScenarioFile(fileName: string): PlacementMiniScenario {
  const raw = readFileSync(join(PLACEMENT_DIR, fileName), 'utf-8')
  const scenario = JSON.parse(raw) as PlacementMiniScenario

  if (!scenario.id || !scenario.context || !scenario.block?.readOptions?.length || !scenario.block?.factorOptions?.length) {
    throw new Error(`Placement fixture "${fileName}" is missing required fields.`)
  }
  return scenario
}

// Loaded once at startup, same pattern as scenarios/loadScenarios.ts - one
// I/O module, everything downstream is pure.
const miniScenarios: PlacementMiniScenario[] = readdirSync(PLACEMENT_DIR)
  .filter((fileName) => fileName.endsWith('.json'))
  .map(readMiniScenarioFile)

export function listPlacementMiniScenarios(): PlacementMiniScenario[] {
  return miniScenarios
}
