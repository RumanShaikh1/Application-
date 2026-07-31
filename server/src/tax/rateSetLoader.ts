import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TaxRateSet } from '../../../shared/types.js'
import { compareIsoDates } from './holdingPeriod.js'
import { DATA_ROOT } from '../dataDir.js'

const TAX_RATES_DIR = join(DATA_ROOT, 'tax-rates')

function readRateSetFile(fileName: string): TaxRateSet {
  const raw = readFileSync(join(TAX_RATES_DIR, fileName), 'utf-8')
  const rateSet = JSON.parse(raw) as TaxRateSet

  if (!rateSet.id || !rateSet.effectiveFrom || !rateSet.capitalGains || !rateSet.transactionCharges || !rateSet.businessIncome || !rateSet.lossSetOff) {
    throw new Error(`Tax rate-set fixture "${fileName}" is missing required fields.`)
  }
  return rateSet
}

// Loaded once at startup, sorted oldest-first by effective date - same
// read-once pattern as scenarios/loadScenarios.ts. A future rate change is
// a new file here, never a code change (see CLAUDE.md's Product Invariants).
const rateSets: TaxRateSet[] = readdirSync(TAX_RATES_DIR)
  .filter((fileName) => fileName.endsWith('.json'))
  .map(readRateSetFile)
  .sort((a, b) => compareIsoDates(a.effectiveFrom, b.effectiveFrom))

export function listRateSets(): TaxRateSet[] {
  return rateSets
}

/**
 * Picks the rate set with the latest effectiveFrom that is <= the given
 * transaction date. There's no effectiveTo field to keep in sync by hand -
 * it's derived purely from ordering, so adjacent rate sets can never drift
 * out of sync with each other. Returns undefined if the date predates
 * every loaded rate set.
 */
export function getRateSetForDate(transactionDate: string): TaxRateSet | undefined {
  let applicable: TaxRateSet | undefined
  for (const rateSet of rateSets) {
    if (compareIsoDates(rateSet.effectiveFrom, transactionDate) <= 0) {
      applicable = rateSet
    } else {
      break
    }
  }
  return applicable
}
