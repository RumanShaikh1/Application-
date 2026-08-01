import type { PlacementMiniScenario } from '../../../shared/types.js'
import { listDataFiles, readDataFileText } from '../dataFs.js'

const PLACEMENT_DIR = 'placement'

function readMiniScenarioFile(fileName: string): PlacementMiniScenario {
  const raw = readDataFileText(`${PLACEMENT_DIR}/${fileName}`)
  const scenario = JSON.parse(raw) as PlacementMiniScenario

  if (!scenario.id || !scenario.context || !scenario.block?.readOptions?.length || !scenario.block?.factorOptions?.length) {
    throw new Error(`Placement fixture "${fileName}" is missing required fields.`)
  }
  return scenario
}

// Loaded once at startup, same pattern as scenarios/loadScenarios.ts - one
// I/O module, everything downstream is pure.
const miniScenarios: PlacementMiniScenario[] = listDataFiles(PLACEMENT_DIR)
  .filter((fileName) => fileName.endsWith('.json'))
  .map(readMiniScenarioFile)

export function listPlacementMiniScenarios(): PlacementMiniScenario[] {
  return miniScenarios
}
