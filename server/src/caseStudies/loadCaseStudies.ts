import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CaseStudy, DifficultyLevel } from '../../../shared/types.js'
import { DATA_ROOT } from '../dataDir.js'

const CASE_STUDIES_DIR = join(DATA_ROOT, 'case-studies')

const LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced']

function readCaseStudyFile(fileName: string): CaseStudy {
  const raw = readFileSync(join(CASE_STUDIES_DIR, fileName), 'utf-8')
  const caseStudy = JSON.parse(raw) as CaseStudy

  if (!caseStudy.id || !caseStudy.maskedContext || !caseStudy.tiers?.length || !caseStudy.identity?.companyName) {
    throw new Error(`Case study fixture "${fileName}" is missing required fields.`)
  }
  if (caseStudy.tiers[0]?.kind !== 'risk_read') {
    throw new Error(`Case study fixture "${fileName}" must open with a risk_read tier.`)
  }
  for (const level of LEVELS) {
    if (!caseStudy.variants[level]) {
      throw new Error(`Case study fixture "${fileName}" is missing the "${level}" variant.`)
    }
  }
  return caseStudy
}

// Loaded once at startup, same pattern as scenarios/loadScenarios.ts and
// placement/loadPlacement.ts - one I/O module, everything downstream is pure.
const caseStudies: CaseStudy[] = readdirSync(CASE_STUDIES_DIR)
  .filter((fileName) => fileName.endsWith('.json'))
  .map(readCaseStudyFile)

export function listCaseStudies(): CaseStudy[] {
  return caseStudies
}

export function findCaseStudy(id: string): CaseStudy | undefined {
  return caseStudies.find((caseStudy) => caseStudy.id === id)
}
