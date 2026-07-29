import { describe, expect, it } from 'vitest'
import type { Portfolio, TradeCostBreakdown } from '../../../shared/types.js'
import { applyTrade, canAffordBuy, checkDiversification, checkPositionSize, hasSufficientHolding, valuePortfolio } from './portfolioEngine.js'

/** Minimal, fee-free cost object - portfolioEngine only ever reads netCashImpact/grossValue, so the rest can be zeroed for isolated arithmetic. */
function cost(netCashImpact: number, grossValue = Math.abs(netCashImpact)): TradeCostBreakdown {
  return { grossValue, brokerageCost: 0, sttCost: 0, exchangeFees: 0, slippageCost: 0, netCashImpact }
}

describe('applyTrade', () => {
  it('buying into an empty portfolio creates a new holding at the cash-basis average cost', () => {
    const portfolio: Portfolio = { cashBalance: 100_000, holdings: [] }
    const result = applyTrade(portfolio, 'ABC', 'buy', 10, cost(-1000))
    expect(result.cashBalance).toBe(99_000)
    expect(result.holdings).toEqual([{ symbol: 'ABC', quantity: 10, averageCost: 100 }])
  })

  it('buying more of an existing holding recomputes the weighted average cost basis', () => {
    const portfolio: Portfolio = { cashBalance: 99_000, holdings: [{ symbol: 'ABC', quantity: 10, averageCost: 100 }] }
    const result = applyTrade(portfolio, 'ABC', 'buy', 5, cost(-600))
    expect(result.cashBalance).toBe(98_400)
    expect(result.holdings[0].quantity).toBe(15)
    // (100*10 + 600) / 15
    expect(result.holdings[0].averageCost).toBeCloseTo(106.6667, 3)
  })

  it('selling part of a holding reduces quantity but leaves the average cost basis untouched', () => {
    const portfolio: Portfolio = { cashBalance: 98_400, holdings: [{ symbol: 'ABC', quantity: 15, averageCost: 106.6667 }] }
    const result = applyTrade(portfolio, 'ABC', 'sell', 5, cost(500))
    expect(result.cashBalance).toBe(98_900)
    expect(result.holdings[0].quantity).toBe(10)
    expect(result.holdings[0].averageCost).toBeCloseTo(106.6667, 3)
  })

  it('selling the entire remaining quantity removes the holding', () => {
    const portfolio: Portfolio = { cashBalance: 98_900, holdings: [{ symbol: 'ABC', quantity: 10, averageCost: 106.6667 }] }
    const result = applyTrade(portfolio, 'ABC', 'sell', 10, cost(1000))
    expect(result.holdings).toEqual([])
    expect(result.cashBalance).toBe(99_900)
  })

  it('throws rather than silently corrupting state when asked to sell more than is held', () => {
    const portfolio: Portfolio = { cashBalance: 0, holdings: [{ symbol: 'ABC', quantity: 5, averageCost: 100 }] }
    expect(() => applyTrade(portfolio, 'ABC', 'sell', 10, cost(0))).toThrow()
  })

  it('throws when asked to sell a symbol that is not held at all', () => {
    const portfolio: Portfolio = { cashBalance: 0, holdings: [] }
    expect(() => applyTrade(portfolio, 'XYZ', 'sell', 1, cost(0))).toThrow()
  })
})

describe('canAffordBuy / hasSufficientHolding', () => {
  it('affords a buy exactly at the cash boundary but not one rupee over', () => {
    const portfolio: Portfolio = { cashBalance: 1000, holdings: [] }
    expect(canAffordBuy(portfolio, cost(-1000))).toBe(true)
    expect(canAffordBuy(portfolio, cost(-1000.01))).toBe(false)
  })

  it('has sufficient holding exactly at the quantity boundary but not one share over', () => {
    const portfolio: Portfolio = { cashBalance: 0, holdings: [{ symbol: 'ABC', quantity: 10, averageCost: 100 }] }
    expect(hasSufficientHolding(portfolio, 'ABC', 10)).toBe(true)
    expect(hasSufficientHolding(portfolio, 'ABC', 11)).toBe(false)
  })

  it('reports insufficient holding for a symbol that is not held at all', () => {
    const portfolio: Portfolio = { cashBalance: 0, holdings: [] }
    expect(hasSufficientHolding(portfolio, 'XYZ', 1)).toBe(false)
  })
})

describe('valuePortfolio', () => {
  it('computes market value, unrealized P&L, and percent of portfolio correctly', () => {
    const portfolio: Portfolio = { cashBalance: 1000, holdings: [{ symbol: 'ABC', quantity: 10, averageCost: 100 }] }
    const result = valuePortfolio(portfolio, { ABC: 120 })

    expect(result.holdingsValue).toBe(1200)
    expect(result.totalValue).toBe(2200)
    expect(result.positions[0].marketValue).toBe(1200)
    expect(result.positions[0].unrealizedPnLPercent).toBeCloseTo(20, 8)
    expect(result.positions[0].percentOfPortfolio).toBeCloseTo((1200 / 2200) * 100, 8)
  })

  it('handles a cash-only portfolio (no holdings) without dividing by zero', () => {
    const portfolio: Portfolio = { cashBalance: 500, holdings: [] }
    const result = valuePortfolio(portfolio, {})
    expect(result.totalValue).toBe(500)
    expect(result.positions).toEqual([])
  })

  it('falls back to the cost basis instead of NaN when a live price is missing', () => {
    const portfolio: Portfolio = { cashBalance: 0, holdings: [{ symbol: 'ABC', quantity: 10, averageCost: 100 }] }
    const result = valuePortfolio(portfolio, {})
    expect(result.positions[0].currentPrice).toBe(100)
    expect(Number.isNaN(result.positions[0].unrealizedPnLPercent)).toBe(false)
  })
})

describe('checkPositionSize', () => {
  it('flags a position above the 25% guideline and clears one below it', () => {
    const overSized: Portfolio = { cashBalance: 700, holdings: [{ symbol: 'ABC', quantity: 1, averageCost: 300 }] }
    const overResult = checkPositionSize(overSized, { ABC: 300 }, 'ABC')
    expect(overResult.percentOfPortfolio).toBeCloseTo(30, 8)
    expect(overResult.withinGuideline).toBe(false)

    const underSized: Portfolio = { cashBalance: 800, holdings: [{ symbol: 'ABC', quantity: 1, averageCost: 200 }] }
    const underResult = checkPositionSize(underSized, { ABC: 200 }, 'ABC')
    expect(underResult.percentOfPortfolio).toBeCloseTo(20, 8)
    expect(underResult.withinGuideline).toBe(true)
  })
})

describe('checkDiversification', () => {
  it('warns when a single sector exceeds the 40% guideline', () => {
    const portfolio: Portfolio = {
      cashBalance: 0,
      holdings: [
        { symbol: 'A', quantity: 1, averageCost: 60 },
        { symbol: 'B', quantity: 1, averageCost: 40 }
      ]
    }
    const result = checkDiversification(portfolio, { A: 60, B: 40 }, { A: 'Tech', B: 'Tech' })
    expect(result.concentratedSectorWarning).toBe(true)
    expect(result.sectorAllocations).toEqual([{ sector: 'Tech', percentOfPortfolio: 100 }])
  })

  it('does not warn when holdings are spread across sectors under the guideline', () => {
    const portfolio: Portfolio = {
      cashBalance: 0,
      holdings: [
        { symbol: 'A', quantity: 1, averageCost: 30 },
        { symbol: 'B', quantity: 1, averageCost: 30 },
        { symbol: 'C', quantity: 1, averageCost: 40 }
      ]
    }
    const result = checkDiversification(portfolio, { A: 30, B: 30, C: 40 }, { A: 'Tech', B: 'Finance', C: 'Energy' })
    expect(result.concentratedSectorWarning).toBe(false)
  })

  it('groups holdings with no known sector under "Unknown" instead of dropping them', () => {
    const portfolio: Portfolio = { cashBalance: 0, holdings: [{ symbol: 'A', quantity: 1, averageCost: 100 }] }
    const result = checkDiversification(portfolio, { A: 100 }, {})
    expect(result.sectorAllocations).toEqual([{ sector: 'Unknown', percentOfPortfolio: 100 }])
  })
})
