import type { LossHarvestingResult, LossOffsetSuggestion, OpenLossPosition, RealizedGainsThisFY, TaxRateSet, LossClassification } from '../../../shared/types.js'

/**
 * Pure. Shows what the asymmetric set-off rules in `rateSet.lossSetOff` permit
 * if the given open loss positions were actually sold before the FY ends -
 * never an instruction to sell. Each position's loss is applied against gain
 * pools in the order listed in `rateSet.lossSetOff.<classification>LossOffsetsAgainst`
 * (data-driven, not hardcoded - e.g. short-term losses try short-term gains
 * before spilling into long-term gains only because that's the array order
 * in the rate-set JSON).
 */
export function computeLossHarvesting(
  positions: OpenLossPosition[],
  realizedGains: RealizedGainsThisFY,
  rateSet: TaxRateSet
): LossHarvestingResult {
  const pools: Record<LossClassification, number> = {
    short_term: realizedGains.shortTermGains,
    long_term: realizedGains.longTermGains
  }

  const suggestions: LossOffsetSuggestion[] = positions.map((position) => {
    const offsetTargets =
      position.classification === 'short_term'
        ? rateSet.lossSetOff.shortTermLossOffsetsAgainst
        : rateSet.lossSetOff.longTermLossOffsetsAgainst

    let remainingLoss = position.unrealizedLossAmount
    let offsetAppliedToShortTermGains = 0
    let offsetAppliedToLongTermGains = 0

    for (const target of offsetTargets) {
      if (remainingLoss <= 0) break
      const applied = Math.min(pools[target], remainingLoss)
      pools[target] -= applied
      remainingLoss -= applied
      if (target === 'short_term') offsetAppliedToShortTermGains += applied
      else offsetAppliedToLongTermGains += applied
    }

    return {
      positionId: position.id,
      label: position.label,
      lossAmount: position.unrealizedLossAmount,
      classification: position.classification,
      offsetAppliedToShortTermGains,
      offsetAppliedToLongTermGains,
      remainingUnoffsetLoss: remainingLoss
    }
  })

  const totalLongTermGainsAfterOffset = pools.long_term
  const remainingLongTermExemption = Math.max(0, rateSet.capitalGains.longTerm.exemptionAmountPerFY - totalLongTermGainsAfterOffset)

  const warnings: string[] = [
    'These figures show what the set-off rules permit if these positions are actually sold before the financial year ends. Nothing is booked yet, and this is not a recommendation to sell.'
  ]
  if (suggestions.some((s) => s.remainingUnoffsetLoss > 0)) {
    warnings.push(rateSet.lossSetOff.note)
  }

  return {
    suggestions,
    totalShortTermGainsBeforeOffset: realizedGains.shortTermGains,
    totalLongTermGainsBeforeOffset: realizedGains.longTermGains,
    totalShortTermGainsAfterOffset: pools.short_term,
    totalLongTermGainsAfterOffset,
    remainingLongTermExemption,
    warnings
  }
}
