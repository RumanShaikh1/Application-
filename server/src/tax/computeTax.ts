import type { ChargeLineItem, TaxBreakdownLineItem, TaxComputationResult, TaxRateSet, TaxTradeInput } from '../../../shared/types.js'
import { classifyTrade } from './classifyTrade.js'
import { computeCharges } from './computeCharges.js'
import { compareIsoDates } from './holdingPeriod.js'

function chargeBreakdownLines(charges: ChargeLineItem[]): TaxBreakdownLineItem[] {
  return charges.map((charge) => ({
    id: charge.id,
    label: charge.label,
    amount: charge.amount,
    explanation: charge.leg === 'buy' ? 'Charged on the buy order.' : 'Charged on the sell order.'
  }))
}

/**
 * Section 112A grandfathering (4th proviso), the corrected two-step
 * formula - see the plan's flag on this: cost of acquisition is the
 * higher of actual cost and the LOWER of (FMV on 31 Jan 2018, actual sale
 * price). The sale-price cap stops a stale, higher FMV from manufacturing
 * a loss that never happened when the price has fallen since 2018.
 */
function resolveCostOfAcquisitionPerUnit(trade: TaxTradeInput, rateSet: TaxRateSet): { costPerUnit: number; grandfatheringApplied: boolean } {
  const { grandfathering } = rateSet.capitalGains
  const isEligible =
    trade.tradeType === 'equity_delivery' &&
    compareIsoDates(trade.buyDate, grandfathering.cutoffDate) <= 0 &&
    trade.fairMarketValueJan312018 !== undefined

  if (!isEligible) {
    return { costPerUnit: trade.buyPrice, grandfatheringApplied: false }
  }

  const cappedFmv = Math.min(trade.fairMarketValueJan312018 as number, trade.sellPrice)
  const costPerUnit = Math.max(trade.buyPrice, cappedFmv)
  return { costPerUnit, grandfatheringApplied: true }
}

/**
 * Orchestrates classification, charges, tax, and cess into the full
 * result. Deterministic end to end - nothing here calls Gemini or does
 * I/O; the model only ever explains an already-computed result (see
 * explainTaxResult.ts), never produces one.
 */
export function computeTax(trade: TaxTradeInput, rateSet: TaxRateSet): TaxComputationResult {
  const classification = classifyTrade(trade, rateSet)
  const charges = computeCharges(trade, rateSet)
  const totalCharges = charges.reduce((sum, charge) => sum + charge.amount, 0)
  const warnings: string[] = []
  const breakdown: TaxBreakdownLineItem[] = []

  // --- Business income: intraday / F&O - never treated as a capital gain. ---
  if (classification === 'intraday' || classification === 'fno') {
    const rules = classification === 'intraday' ? rateSet.businessIncome.intraday : rateSet.businessIncome.fno
    const grossGain = (trade.sellPrice - trade.buyPrice) * trade.quantity

    warnings.push(
      `This is ${rules.classification.replaceAll('_', ' ')}, not a capital gain - it belongs in Schedule ${rules.schedule} and is taxed at your income slab rate, not the STCG/LTCG rate.`
    )
    breakdown.push({ id: 'gross_gain', label: 'Gross gain/loss', amount: grossGain, explanation: rules.description })

    if (trade.incomeSlabRatePercent === undefined) {
      warnings.push('Enter your income slab rate for an exact tax figure - this calculator will not guess it for you.')
      breakdown.push(...chargeBreakdownLines(charges))
      return {
        classification,
        rateSetId: rateSet.id,
        rateSetEffectiveFrom: rateSet.effectiveFrom,
        grossGain,
        costOfAcquisitionPerUnit: trade.buyPrice,
        grandfatheringApplied: false,
        taxableGain: null,
        exemptionConsumed: null,
        taxRatePercent: null,
        taxAmount: null,
        cessAmount: null,
        charges,
        totalCharges,
        totalTaxAndCharges: null,
        netProceeds: null,
        breakdown,
        warnings
      }
    }

    const taxRatePercent = trade.incomeSlabRatePercent
    const taxableGain = Math.max(0, grossGain)
    const taxAmount = taxableGain * (taxRatePercent / 100)
    const cessAmount = taxAmount * rateSet.cessRate
    const netProceeds = grossGain - taxAmount - cessAmount - totalCharges

    breakdown.push({
      id: 'tax',
      label: `Tax at your ${taxRatePercent}% slab rate`,
      amount: taxAmount,
      explanation: `Taxable gain × ${taxRatePercent}% slab rate. A loss here isn't taxed, but it also doesn't get an STCG/LTCG-style exemption - it is set off against other business income under separate Schedule BP rules, not modelled by this calculator.`
    })
    breakdown.push({ id: 'cess', label: 'Health and education cess', amount: cessAmount, explanation: `${(rateSet.cessRate * 100).toFixed(0)}% of the tax amount.` })
    breakdown.push(...chargeBreakdownLines(charges))
    breakdown.push({ id: 'net_proceeds', label: 'Net result', amount: netProceeds, explanation: 'Gross gain minus tax, cess, and every transaction charge above - what this trade actually nets you.' })

    return {
      classification,
      rateSetId: rateSet.id,
      rateSetEffectiveFrom: rateSet.effectiveFrom,
      grossGain,
      costOfAcquisitionPerUnit: trade.buyPrice,
      grandfatheringApplied: false,
      taxableGain,
      exemptionConsumed: 0,
      taxRatePercent,
      taxAmount,
      cessAmount,
      charges,
      totalCharges,
      totalTaxAndCharges: taxAmount + cessAmount + totalCharges,
      netProceeds,
      breakdown,
      warnings
    }
  }

  // --- Capital gains: equity delivery, short or long term. ---
  const { costPerUnit, grandfatheringApplied } = resolveCostOfAcquisitionPerUnit(trade, rateSet)
  const grossGain = (trade.sellPrice - costPerUnit) * trade.quantity

  breakdown.push({
    id: 'gross_gain',
    label: 'Gross capital gain/loss',
    amount: grossGain,
    explanation: grandfatheringApplied
      ? 'Computed using the grandfathered cost of acquisition below, not your actual purchase price.'
      : 'Sale price minus purchase price, times quantity.'
  })
  if (grandfatheringApplied) {
    breakdown.push({
      id: 'grandfathered_cost',
      label: 'Grandfathered cost of acquisition per share',
      amount: costPerUnit,
      explanation: rateSet.capitalGains.grandfathering.description
    })
    warnings.push('Grandfathering applied: this holding was acquired on or before the cutoff date, so cost of acquisition uses the higher of your actual cost and the FMV on 31 Jan 2018 (capped at the sale price).')
  }
  warnings.push(rateSet.capitalGains.section87ARebate.note)

  if (classification === 'equity_delivery_short') {
    const rule = rateSet.capitalGains.shortTerm
    const taxableGain = Math.max(0, grossGain)
    const taxAmount = taxableGain * rule.rate
    const cessAmount = taxAmount * rateSet.cessRate
    const netProceeds = grossGain - taxAmount - cessAmount - totalCharges

    breakdown.push({
      id: 'tax',
      label: `Short-term capital gains tax (Section ${rule.section})`,
      amount: taxAmount,
      explanation: `${(rule.rate * 100).toFixed(0)}% of the taxable gain - no exemption applies to short-term gains.`
    })
    breakdown.push({ id: 'cess', label: 'Health and education cess', amount: cessAmount, explanation: `${(rateSet.cessRate * 100).toFixed(0)}% of the tax amount.` })
    breakdown.push(...chargeBreakdownLines(charges))
    breakdown.push({ id: 'net_proceeds', label: 'Net result', amount: netProceeds, explanation: 'Gross gain minus tax, cess, and every transaction charge above - what this trade actually nets you.' })

    return {
      classification,
      rateSetId: rateSet.id,
      rateSetEffectiveFrom: rateSet.effectiveFrom,
      grossGain,
      costOfAcquisitionPerUnit: costPerUnit,
      grandfatheringApplied,
      taxableGain,
      exemptionConsumed: 0,
      taxRatePercent: rule.rate * 100,
      taxAmount,
      cessAmount,
      charges,
      totalCharges,
      totalTaxAndCharges: taxAmount + cessAmount + totalCharges,
      netProceeds,
      breakdown,
      warnings
    }
  }

  // equity_delivery_long
  const rule = rateSet.capitalGains.longTerm
  const priorGains = Math.max(0, trade.priorLongTermGainsThisFY ?? 0)
  const remainingExemption = Math.max(0, rule.exemptionAmountPerFY - priorGains)
  const positiveGain = Math.max(0, grossGain)
  const exemptionConsumed = Math.min(positiveGain, remainingExemption)
  const taxableGain = positiveGain - exemptionConsumed
  const taxAmount = taxableGain * rule.rate
  const cessAmount = taxAmount * rateSet.cessRate
  const netProceeds = grossGain - taxAmount - cessAmount - totalCharges

  breakdown.push({
    id: 'exemption',
    label: 'Exemption consumed',
    amount: exemptionConsumed,
    explanation: `Up to ₹${rule.exemptionAmountPerFY.toLocaleString('en-IN')} of LTCG is exempt per financial year, across all your LTCG combined - not per trade.${
      priorGains > 0 ? ` ₹${priorGains.toLocaleString('en-IN')} of that was already used by other gains this year, leaving ₹${remainingExemption.toLocaleString('en-IN')}.` : ''
    }`
  })
  breakdown.push({
    id: 'tax',
    label: `Long-term capital gains tax (Section ${rule.section})`,
    amount: taxAmount,
    explanation: `${(rule.rate * 100).toFixed(1)}% of the taxable gain, after the exemption above. Flat rate - no indexation.`
  })
  breakdown.push({ id: 'cess', label: 'Health and education cess', amount: cessAmount, explanation: `${(rateSet.cessRate * 100).toFixed(0)}% of the tax amount.` })
  breakdown.push(...chargeBreakdownLines(charges))
  breakdown.push({ id: 'net_proceeds', label: 'Net result', amount: netProceeds, explanation: 'Gross gain minus tax, cess, and every transaction charge above - what this trade actually nets you.' })

  return {
    classification,
    rateSetId: rateSet.id,
    rateSetEffectiveFrom: rateSet.effectiveFrom,
    grossGain,
    costOfAcquisitionPerUnit: costPerUnit,
    grandfatheringApplied,
    taxableGain,
    exemptionConsumed,
    taxRatePercent: rule.rate * 100,
    taxAmount,
    cessAmount,
    charges,
    totalCharges,
    totalTaxAndCharges: taxAmount + cessAmount + totalCharges,
    netProceeds,
    breakdown,
    warnings
  }
}
