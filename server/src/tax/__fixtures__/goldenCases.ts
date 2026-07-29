import type { TaxTradeInput } from '../../../../shared/types.js'

/**
 * Hand-verified worked examples. Every expected figure here was computed
 * independently of computeTax.ts's implementation (a from-scratch
 * arithmetic script, not a refactor of the engine code) before being
 * locked in - see the plan's note on why: a first hand-calculation pass
 * caught itself with an arithmetic slip on the F&O case, which is exactly
 * the failure mode this cross-check exists to catch. "Wrong tax numbers
 * are a liability, not a bug."
 */
export interface GoldenCase {
  name: string
  trade: TaxTradeInput
  expected: {
    classification: string
    grandfatheringApplied: boolean
    grossGain: number
    exemptionConsumed: number | null
    taxableGain: number | null
    taxAmount: number | null
    cessAmount: number | null
    totalCharges: number
    netProceeds: number | null
  }
}

export const goldenCases: GoldenCase[] = [
  {
    name: 'LTCG gain fully under the ₹1.25L exemption',
    trade: { tradeType: 'equity_delivery', buyPrice: 100, sellPrice: 150, quantity: 1000, buyDate: '2023-01-10', sellDate: '2024-08-15' },
    expected: {
      classification: 'equity_delivery_long',
      grandfatheringApplied: false,
      grossGain: 50000,
      exemptionConsumed: 50000,
      taxableGain: 0,
      taxAmount: 0,
      cessAmount: 0,
      totalCharges: 273.791,
      netProceeds: 49726.209
    }
  },
  {
    name: 'LTCG gain straddling the ₹1.25L exemption',
    trade: { tradeType: 'equity_delivery', buyPrice: 100, sellPrice: 250, quantity: 1000, buyDate: '2023-02-01', sellDate: '2024-09-01' },
    expected: {
      classification: 'equity_delivery_long',
      grandfatheringApplied: false,
      grossGain: 150000,
      exemptionConsumed: 125000,
      taxableGain: 25000,
      taxAmount: 3125,
      cessAmount: 125,
      totalCharges: 377.3074,
      netProceeds: 146372.6926
    }
  },
  {
    name: 'STCG at 20%',
    trade: { tradeType: 'equity_delivery', buyPrice: 200, sellPrice: 240, quantity: 500, buyDate: '2024-08-01', sellDate: '2024-11-01' },
    expected: {
      classification: 'equity_delivery_short',
      grandfatheringApplied: false,
      grossGain: 20000,
      exemptionConsumed: 0,
      taxableGain: 20000,
      taxAmount: 4000,
      cessAmount: 160,
      totalCharges: 242.73608,
      netProceeds: 15597.26392
    }
  },
  {
    name: '87A rebate does not apply (small LTCG gain, fully exempt, warning must still be present)',
    trade: { tradeType: 'equity_delivery', buyPrice: 50, sellPrice: 60, quantity: 100, buyDate: '2022-05-01', sellDate: '2024-08-01' },
    expected: {
      classification: 'equity_delivery_long',
      grandfatheringApplied: false,
      grossGain: 1000,
      exemptionConsumed: 1000,
      taxableGain: 0,
      taxAmount: 0,
      cessAmount: 0,
      totalCharges: 12.136804,
      netProceeds: 987.863196
    }
  },
  {
    name: 'Pre-2018 grandfathered holding (FMV 150 capped at sale price 130, beating actual cost of 40)',
    trade: {
      tradeType: 'equity_delivery',
      buyPrice: 40,
      sellPrice: 130,
      quantity: 200,
      buyDate: '2015-06-01',
      sellDate: '2024-09-10',
      fairMarketValueJan312018: 150
    },
    expected: {
      classification: 'equity_delivery_long',
      grandfatheringApplied: true,
      grossGain: 0,
      exemptionConsumed: 0,
      taxableGain: 0,
      taxAmount: 0,
      cessAmount: 0,
      totalCharges: 36.395576,
      netProceeds: -36.395576
    }
  },
  {
    name: 'Intraday at slab (30%) - never STCG',
    trade: { tradeType: 'equity_intraday', buyPrice: 50, sellPrice: 55, quantity: 1000, buyDate: '2024-09-05', sellDate: '2024-09-05', incomeSlabRatePercent: 30 },
    expected: {
      classification: 'intraday',
      grandfatheringApplied: false,
      grossGain: 5000,
      exemptionConsumed: 0,
      taxableGain: 5000,
      taxAmount: 1500,
      cessAmount: 60,
      totalCharges: 56.11222,
      netProceeds: 3383.88778
    }
  },
  {
    name: 'F&O futures at slab (20%) - never STCG/LTCG',
    trade: {
      tradeType: 'fno',
      fnoInstrument: 'futures',
      buyPrice: 1000,
      sellPrice: 1050,
      quantity: 50,
      buyDate: '2024-09-01',
      sellDate: '2024-09-20',
      incomeSlabRatePercent: 20
    },
    expected: {
      classification: 'fno',
      grandfatheringApplied: false,
      grossGain: 2500,
      exemptionConsumed: 0,
      taxableGain: 2500,
      taxAmount: 500,
      cessAmount: 20,
      totalCharges: 49.88953,
      netProceeds: 1930.11047
    }
  },
  {
    name: 'Sell one day BEFORE the 12-month cutoff - still short-term (pre-Budget rate set: STCG 15%)',
    trade: { tradeType: 'equity_delivery', buyPrice: 300, sellPrice: 360, quantity: 100, buyDate: '2023-06-15', sellDate: '2024-06-15' },
    expected: {
      classification: 'equity_delivery_short',
      grandfatheringApplied: false,
      grossGain: 6000,
      exemptionConsumed: 0,
      taxableGain: 6000,
      taxAmount: 900,
      cessAmount: 36,
      totalCharges: 72.820824,
      netProceeds: 4991.179176
    }
  },
  {
    name: 'Sell one day AFTER the 12-month cutoff - now long-term (pre-Budget rate set: LTCG 10%/₹1L exemption)',
    trade: { tradeType: 'equity_delivery', buyPrice: 300, sellPrice: 360, quantity: 100, buyDate: '2023-06-15', sellDate: '2024-06-16' },
    expected: {
      classification: 'equity_delivery_long',
      grandfatheringApplied: false,
      grossGain: 6000,
      exemptionConsumed: 6000,
      taxableGain: 0,
      taxAmount: 0,
      cessAmount: 0,
      totalCharges: 72.820824,
      netProceeds: 5927.179176
    }
  }
]
