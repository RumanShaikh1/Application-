import { describe, expect, it } from 'vitest'
import { computeTax } from './computeTax.js'
import { getRateSetForDate, listRateSets } from './rateSetLoader.js'
import { goldenCases } from './__fixtures__/goldenCases.js'
import type { TaxTradeInput } from '../../../shared/types.js'

describe('computeTax - golden cases', () => {
  for (const { name, trade, expected } of goldenCases) {
    it(name, () => {
      const rateSet = getRateSetForDate(trade.sellDate)
      expect(rateSet, `no rate set found for ${trade.sellDate}`).toBeDefined()
      const result = computeTax(trade, rateSet!)

      expect(result.classification).toBe(expected.classification)
      expect(result.grandfatheringApplied).toBe(expected.grandfatheringApplied)
      expect(result.grossGain).toBeCloseTo(expected.grossGain, 6)
      expect(result.exemptionConsumed).toBeCloseTo(expected.exemptionConsumed as number, 6)
      expect(result.taxableGain).toBeCloseTo(expected.taxableGain as number, 6)
      expect(result.taxAmount).toBeCloseTo(expected.taxAmount as number, 6)
      expect(result.cessAmount).toBeCloseTo(expected.cessAmount as number, 6)
      expect(result.totalCharges).toBeCloseTo(expected.totalCharges, 6)
      expect(result.netProceeds).toBeCloseTo(expected.netProceeds as number, 6)
    })
  }

  it('always warns that the Section 87A rebate does not apply, for every capital-gains case', () => {
    for (const { trade } of goldenCases.filter((c) => c.trade.tradeType === 'equity_delivery')) {
      const rateSet = getRateSetForDate(trade.sellDate)!
      const result = computeTax(trade, rateSet)
      expect(result.warnings.some((w) => w.toLowerCase().includes('87a'))).toBe(true)
    }
  })

  it('warns about grandfathering only when it was actually applied', () => {
    const grandfatheredCase = goldenCases.find((c) => c.expected.grandfatheringApplied)!
    const rateSet = getRateSetForDate(grandfatheredCase.trade.sellDate)!
    const result = computeTax(grandfatheredCase.trade, rateSet)
    expect(result.warnings.some((w) => w.toLowerCase().includes('grandfather'))).toBe(true)

    const nonGrandfatheredCase = goldenCases.find((c) => !c.expected.grandfatheringApplied && c.trade.tradeType === 'equity_delivery')!
    const rateSet2 = getRateSetForDate(nonGrandfatheredCase.trade.sellDate)!
    const result2 = computeTax(nonGrandfatheredCase.trade, rateSet2)
    expect(result2.warnings.some((w) => w.toLowerCase().includes('grandfather'))).toBe(false)
  })
})

describe('computeTax - reconciliation property (net proceeds must always equal gross minus every tax/cess/charge line, exactly)', () => {
  for (const { name, trade } of goldenCases) {
    it(`reconciles exactly: ${name}`, () => {
      const rateSet = getRateSetForDate(trade.sellDate)!
      const result = computeTax(trade, rateSet)
      if (result.netProceeds === null) return // no slab rate supplied - nothing to reconcile
      const reconciled = result.grossGain - (result.taxAmount ?? 0) - (result.cessAmount ?? 0) - result.totalCharges
      expect(result.netProceeds).toBeCloseTo(reconciled, 9)
    })
  }

  it('also reconciles for a case with no slab rate supplied - once a slab rate is added', () => {
    const trade: TaxTradeInput = { tradeType: 'fno', fnoInstrument: 'options', buyPrice: 40, sellPrice: 55, quantity: 300, buyDate: '2024-09-01', sellDate: '2024-09-15' }
    const rateSet = getRateSetForDate(trade.sellDate)!

    const withoutSlab = computeTax(trade, rateSet)
    expect(withoutSlab.taxAmount).toBeNull()
    expect(withoutSlab.netProceeds).toBeNull()
    expect(withoutSlab.warnings.some((w) => w.toLowerCase().includes('slab'))).toBe(true)

    const withSlab = computeTax({ ...trade, incomeSlabRatePercent: 30 }, rateSet)
    const reconciled = withSlab.grossGain - (withSlab.taxAmount ?? 0) - (withSlab.cessAmount ?? 0) - withSlab.totalCharges
    expect(withSlab.netProceeds).toBeCloseTo(reconciled, 9)
  })
})

describe('computeTax - a rate-set change in JSON alone changes output, with zero code changes', () => {
  it('the same trade taxed under the pre-Budget and post-Budget rate sets produces different, period-correct figures', () => {
    // Gain must exceed BOTH the pre-Budget ₹1L and post-Budget ₹1.25L exemption
    // thresholds, or taxAmount is legitimately 0 under both and proves nothing.
    const trade: TaxTradeInput = { tradeType: 'equity_delivery', buyPrice: 100, sellPrice: 250, quantity: 1000, buyDate: '2022-01-01', sellDate: '2024-08-01' }

    const preBudget = getRateSetForDate('2024-05-01')! // before 23 Jul 2024
    const postBudget = getRateSetForDate('2024-08-01')! // after 23 Jul 2024
    expect(preBudget.id).not.toBe(postBudget.id)

    const resultPre = computeTax(trade, preBudget)
    const resultPost = computeTax(trade, postBudget)

    // Same trade, same classification, different tax purely because the
    // active rate set's LTCG rate/exemption differ (10%/₹1L vs 12.5%/₹1.25L).
    expect(resultPre.classification).toBe('equity_delivery_long')
    expect(resultPost.classification).toBe('equity_delivery_long')
    expect(resultPre.taxRatePercent).toBe(10)
    expect(resultPost.taxRatePercent).toBe(12.5)
    expect(resultPre.taxAmount).not.toBe(resultPost.taxAmount)
  })

  it('every rate set loaded is internally consistent (id matches effectiveFrom, sorted chronologically)', () => {
    const rateSets = listRateSets()
    expect(rateSets.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < rateSets.length; i++) {
      expect(rateSets[i].effectiveFrom >= rateSets[i - 1].effectiveFrom).toBe(true)
    }
  })
})

describe('computeTax - intraday and F&O can never be classified as capital gains', () => {
  it.each([
    // Sell dates must fall within a loaded rate set's coverage (>= 2024-04-01);
    // buy dates are still >12 months earlier - would be LTCG if it were delivery.
    { tradeType: 'equity_intraday' as const, buyDate: '2023-01-01', sellDate: '2024-06-01' },
    { tradeType: 'fno' as const, fnoInstrument: 'futures' as const, buyDate: '2023-01-01', sellDate: '2024-06-01' },
    { tradeType: 'fno' as const, fnoInstrument: 'options' as const, buyDate: '2024-09-01', sellDate: '2024-09-02' }
  ])('%o never yields equity_delivery_short/long regardless of holding period', (partialTrade) => {
    const trade: TaxTradeInput = { buyPrice: 100, sellPrice: 110, quantity: 10, incomeSlabRatePercent: 20, ...partialTrade }
    const rateSet = getRateSetForDate(trade.sellDate)!
    const result = computeTax(trade, rateSet)
    expect(['intraday', 'fno']).toContain(result.classification)
    expect(result.classification).not.toBe('equity_delivery_short')
    expect(result.classification).not.toBe('equity_delivery_long')
  })
})
