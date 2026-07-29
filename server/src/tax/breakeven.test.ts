import { describe, expect, it } from 'vitest'
import { computeBreakevenMove } from './breakeven.js'
import { computeTax } from './computeTax.js'
import { getRateSetForDate } from './rateSetLoader.js'
import type { TaxRateSet, TaxTradeInput } from '../../../shared/types.js'

const todayRateSet = getRateSetForDate('2024-06-01')! // pre-Budget: STCG 15%
const holdRateSet = getRateSetForDate('2025-01-02')! // post-Budget: LTCG 12.5% / ₹1.25L exemption

const todayTrade: TaxTradeInput = { tradeType: 'equity_delivery', buyPrice: 100, sellPrice: 200, quantity: 1000, buyDate: '2024-01-01', sellDate: '2024-06-01' }
const holdTrade: TaxTradeInput = { ...todayTrade, sellDate: '2025-01-02' }

describe('computeBreakevenMove - worth waiting', () => {
  it('finds a positive breakeven price fall when waiting currently nets more', () => {
    const result = computeBreakevenMove(todayTrade, todayRateSet, holdTrade, holdRateSet)

    expect(result.worthWaitingAtCurrentPrice).toBe(true)
    expect(result.breakevenMoveRupees).toBeGreaterThan(0)
    expect(result.breakevenMoveRupees).toBeLessThan(todayTrade.sellPrice)
    expect(result.breakevenSellPrice).toBeCloseTo(todayTrade.sellPrice - result.breakevenMoveRupees, 6)
    expect(result.breakevenMovePercent).toBeCloseTo((result.breakevenMoveRupees / todayTrade.sellPrice) * 100, 6)
  })

  it('reconciles: net proceeds at the breakeven sell price match net proceeds of selling today, within a paisa', () => {
    const result = computeBreakevenMove(todayTrade, todayRateSet, holdTrade, holdRateSet)
    const todayNetProceeds = computeTax(todayTrade, todayRateSet).netProceeds!
    const holdNetProceedsAtBreakeven = computeTax({ ...holdTrade, sellPrice: result.breakevenSellPrice }, holdRateSet).netProceeds!

    expect(holdNetProceedsAtBreakeven).toBeCloseTo(todayNetProceeds, 2)
  })

  it('a hold price one rupee below breakeven nets less than selling today; one rupee above nets more (brackets the root correctly)', () => {
    const result = computeBreakevenMove(todayTrade, todayRateSet, holdTrade, holdRateSet)
    const todayNetProceeds = computeTax(todayTrade, todayRateSet).netProceeds!

    const belowNet = computeTax({ ...holdTrade, sellPrice: result.breakevenSellPrice - 1 }, holdRateSet).netProceeds!
    const aboveNet = computeTax({ ...holdTrade, sellPrice: result.breakevenSellPrice + 1 }, holdRateSet).netProceeds!

    expect(belowNet).toBeLessThan(todayNetProceeds)
    expect(aboveNet).toBeGreaterThan(todayNetProceeds)
  })
})

describe('computeBreakevenMove - not worth waiting at all', () => {
  it('returns zero breakeven move when holding already nets less at the current price, with no price change needed', () => {
    // Synthetic, deliberately unfavourable "future" rate set - not a real
    // rate, just enough to force hold-nets-less-than-today at zero price
    // move so the early-return branch is exercised.
    const punitiveHoldRateSet: TaxRateSet = {
      ...holdRateSet,
      capitalGains: {
        ...holdRateSet.capitalGains,
        longTerm: { ...holdRateSet.capitalGains.longTerm, rate: 0.5, exemptionAmountPerFY: 0 }
      }
    }

    const result = computeBreakevenMove(todayTrade, todayRateSet, holdTrade, punitiveHoldRateSet)

    expect(result.worthWaitingAtCurrentPrice).toBe(false)
    expect(result.breakevenMoveRupees).toBe(0)
    expect(result.breakevenMovePercent).toBe(0)
    expect(result.breakevenSellPrice).toBe(todayTrade.sellPrice)
  })
})

describe('computeBreakevenMove - reconciles across a spread of trade sizes', () => {
  it.each([
    { buyPrice: 50, sellPrice: 80, quantity: 200 },
    { buyPrice: 300, sellPrice: 310, quantity: 5000 },
    { buyPrice: 1000, sellPrice: 1500, quantity: 100 }
  ])('buy ₹%o', (overrides) => {
    const today: TaxTradeInput = { ...todayTrade, ...overrides }
    const hold: TaxTradeInput = { ...today, sellDate: '2025-01-02' }

    const result = computeBreakevenMove(today, todayRateSet, hold, holdRateSet)
    if (!result.worthWaitingAtCurrentPrice) return

    const todayNetProceeds = computeTax(today, todayRateSet).netProceeds!
    const holdNetProceedsAtBreakeven = computeTax({ ...hold, sellPrice: result.breakevenSellPrice }, holdRateSet).netProceeds!
    expect(holdNetProceedsAtBreakeven).toBeCloseTo(todayNetProceeds, 2)
  })
})
