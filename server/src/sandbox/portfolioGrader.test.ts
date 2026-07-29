import { describe, expect, it } from 'vitest'
import { COVID_CRASH_WINDOW, gradePortfolio } from './portfolioGrader.js'
import type { DiversificationSummary, PositionSizeCheck, SandboxTrade, ThesisTag, TradeCostBreakdown, TradeSide } from '../../../shared/types.js'

const NEUTRAL_COST: TradeCostBreakdown = { grossValue: 10000, brokerageCost: 3, sttCost: 10, exchangeFees: 0.3, slippageCost: 5, netCashImpact: -10018.3 }
const WITHIN_GUIDELINE: PositionSizeCheck = { symbol: 'RELIANCE.NS', percentOfPortfolio: 15, withinGuideline: true }
const DIVERSIFIED: DiversificationSummary = { sectorAllocations: [{ sector: 'Energy', percentOfPortfolio: 15 }], concentratedSectorWarning: false }

function buildTrade(overrides: Partial<SandboxTrade> & { day: number; side: TradeSide }): SandboxTrade {
  return {
    id: `trade-${overrides.day}-${overrides.side}-${Math.random()}`,
    symbol: 'RELIANCE.NS',
    quantity: 10,
    price: 700,
    costBreakdown: NEUTRAL_COST,
    thesisTag: 'fits_mission_goal' as ThesisTag,
    timestamp: 1_600_000_000_000 + overrides.day * 86_400_000,
    positionSizeCheck: WITHIN_GUIDELINE,
    diversification: DIVERSIFIED,
    ...overrides
  }
}

describe('gradePortfolio - no trades yet', () => {
  it('every dimension defaults to sound with a "nothing to assess" explanation', () => {
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 0, trades: [] })
    expect(report.dimensions).toHaveLength(5)
    for (const dimension of report.dimensions) {
      expect(dimension.level).toBe('sound')
    }
    expect(report.processScore).toBe(65)
  })
})

describe('gradePortfolio - diversification', () => {
  it('no concentration warnings across trades grades strong', () => {
    const trades = [buildTrade({ day: 10, side: 'buy' }), buildTrade({ day: 20, side: 'buy' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 30, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'diversification')!
    expect(dimension.level).toBe('strong')
  })

  it('a majority of trades flagged for sector concentration grades needs_attention', () => {
    const concentrated: DiversificationSummary = { sectorAllocations: [{ sector: 'Energy', percentOfPortfolio: 55 }], concentratedSectorWarning: true }
    const trades = [
      buildTrade({ day: 10, side: 'buy', diversification: concentrated }),
      buildTrade({ day: 20, side: 'buy', diversification: concentrated }),
      buildTrade({ day: 30, side: 'buy', diversification: DIVERSIFIED })
    ]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 40, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'diversification')!
    expect(dimension.level).toBe('needs_attention')
    expect(dimension.explanation).toContain('2 of your 3 trades')
  })
})

describe('gradePortfolio - position sizing', () => {
  it('a single-position breach above the guideline (at the 25% ratio boundary) grades sound, not strong, and cites the worst percentage', () => {
    const oversized: PositionSizeCheck = { symbol: 'RELIANCE.NS', percentOfPortfolio: 42, withinGuideline: false }
    const trades = [
      buildTrade({ day: 10, side: 'buy', positionSizeCheck: oversized }),
      buildTrade({ day: 20, side: 'buy' }),
      buildTrade({ day: 30, side: 'buy' }),
      buildTrade({ day: 40, side: 'buy' })
    ]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 50, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'position_sizing')!
    expect(dimension.level).toBe('sound')
    expect(dimension.explanation).toContain('42.0%')
  })

  it('a breach ratio above 25% grades needs_attention', () => {
    const oversized: PositionSizeCheck = { symbol: 'RELIANCE.NS', percentOfPortfolio: 42, withinGuideline: false }
    const trades = [buildTrade({ day: 10, side: 'buy', positionSizeCheck: oversized }), buildTrade({ day: 20, side: 'buy' }), buildTrade({ day: 30, side: 'buy' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 40, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'position_sizing')!
    expect(dimension.level).toBe('needs_attention')
  })
})

describe('gradePortfolio - crash discipline', () => {
  it('a sell inside the covid crash window grades needs_attention', () => {
    const trades = [buildTrade({ day: 10, side: 'buy' }), buildTrade({ day: COVID_CRASH_WINDOW.startDay + 5, side: 'sell' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 100, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'crash_discipline')!
    expect(dimension.level).toBe('needs_attention')
    expect(dimension.explanation).toContain('1 of your 1 sells')
  })

  it('a sell outside the crash window grades strong', () => {
    const trades = [buildTrade({ day: 10, side: 'buy' }), buildTrade({ day: 200, side: 'sell' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 220, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'crash_discipline')!
    expect(dimension.level).toBe('strong')
  })

  it('no sells at all grades sound, not strong or needs_attention', () => {
    const trades = [buildTrade({ day: 10, side: 'buy' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 20, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'crash_discipline')!
    expect(dimension.level).toBe('sound')
  })
})

describe('gradePortfolio - thesis consistency', () => {
  it('buys tagged as chasing a price move or a tip grade needs_attention', () => {
    const trades = [
      buildTrade({ day: 10, side: 'buy', thesisTag: 'trending_up' }),
      buildTrade({ day: 20, side: 'buy', thesisTag: 'heard_about_it' }),
      buildTrade({ day: 30, side: 'buy', thesisTag: 'fits_mission_goal' })
    ]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 40, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'thesis_consistency')!
    expect(dimension.level).toBe('needs_attention')
  })

  it('buys grounded in the mission goal or a valuation view grade strong', () => {
    const trades = [
      buildTrade({ day: 10, side: 'buy', thesisTag: 'fits_mission_goal' }),
      buildTrade({ day: 20, side: 'buy', thesisTag: 'looks_cheap' })
    ]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 30, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'thesis_consistency')!
    expect(dimension.level).toBe('strong')
  })
})

describe('gradePortfolio - trading frequency', () => {
  it('a high trade count relative to the days played grades needs_attention', () => {
    const trades = Array.from({ length: 20 }, (_, i) => buildTrade({ day: i, side: 'buy' }))
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 25, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'trading_frequency')!
    expect(dimension.level).toBe('needs_attention')
  })

  it('a handful of trades over a long window grades strong', () => {
    const trades = [buildTrade({ day: 10, side: 'buy' }), buildTrade({ day: 100, side: 'buy' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 250, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'trading_frequency')!
    expect(dimension.level).toBe('strong')
  })

  it('a single trade on day 0 does NOT read as overtrading - regression for the tiny-denominator rate blow-up', () => {
    const trades = [buildTrade({ day: 0, side: 'buy' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 0, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'trading_frequency')!
    expect(dimension.level).toBe('strong')
  })

  it('a couple of trades in the first week of the window does not read as needs_attention (floored rate, not the raw 4-day ratio)', () => {
    const trades = [buildTrade({ day: 0, side: 'buy' }), buildTrade({ day: 3, side: 'buy' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 4, trades })
    const dimension = report.dimensions.find((d) => d.dimension === 'trading_frequency')!
    expect(dimension.level).not.toBe('needs_attention')
  })
})

describe('gradePortfolio - process, never outcome (the load-bearing property)', () => {
  it('two identical decisions that differ ONLY in the eventual sell price/cost grade byte-for-byte identically', () => {
    const sharedFields = {
      day: COVID_CRASH_WINDOW.endDay + 10,
      side: 'sell' as TradeSide,
      quantity: 15,
      thesisTag: 'fits_mission_goal' as ThesisTag,
      positionSizeCheck: WITHIN_GUIDELINE,
      diversification: DIVERSIFIED
    }
    const boughtLow = buildTrade({ day: 5, side: 'buy' })
    const soldAtABigGain = buildTrade({
      ...sharedFields,
      price: 5000,
      costBreakdown: { grossValue: 75000, brokerageCost: 22.5, sttCost: 75, exchangeFees: 2.2, slippageCost: 37.5, netCashImpact: 74862.8 }
    })
    const soldAtABigLoss = buildTrade({
      ...sharedFields,
      price: 50,
      costBreakdown: { grossValue: 750, brokerageCost: 0.2, sttCost: 0.75, exchangeFees: 0.02, slippageCost: 0.4, netCashImpact: 748.63 }
    })

    const gainReport = gradePortfolio({ missionId: 'm1', asOfDay: 260, trades: [boughtLow, soldAtABigGain] })
    const lossReport = gradePortfolio({ missionId: 'm1', asOfDay: 260, trades: [boughtLow, soldAtABigLoss] })

    expect(gainReport.dimensions).toEqual(lossReport.dimensions)
    expect(gainReport.processScore).toBe(lossReport.processScore)
    expect(gainReport.summary).toBe(lossReport.summary)
  })

  it('an oversized, concentrated bet grades needs_attention even when every other field suggests it "worked out" is irrelevant - the function never sees a P&L field at all', () => {
    const oversized: PositionSizeCheck = { symbol: 'BAJFINANCE.NS', percentOfPortfolio: 60, withinGuideline: false }
    const concentrated: DiversificationSummary = { sectorAllocations: [{ sector: 'Financial Services', percentOfPortfolio: 60 }], concentratedSectorWarning: true }
    // A wildly profitable-looking price is irrelevant input - the type doesn't even expose a P&L field for this function to read.
    const trade = buildTrade({ day: 10, side: 'buy', price: 100000, positionSizeCheck: oversized, diversification: concentrated })
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 20, trades: [trade] })
    const sizing = report.dimensions.find((d) => d.dimension === 'position_sizing')!
    const diversification = report.dimensions.find((d) => d.dimension === 'diversification')!
    expect(sizing.level).toBe('needs_attention')
    expect(diversification.level).toBe('needs_attention')
  })
})

describe('gradePortfolio - composite score and summary', () => {
  it('the summary lists only the dimensions that need attention', () => {
    const oversized: PositionSizeCheck = { symbol: 'RELIANCE.NS', percentOfPortfolio: 80, withinGuideline: false }
    const trades = [
      buildTrade({ day: 10, side: 'buy', positionSizeCheck: oversized }),
      buildTrade({ day: 20, side: 'buy', positionSizeCheck: oversized })
    ]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 30, trades })
    expect(report.summary).toContain('position sizing')
    expect(report.summary).not.toContain('diversification,')
  })

  it('a fully clean portfolio gets a summary with no caveats and every dimension strong', () => {
    const trades = [buildTrade({ day: 10, side: 'buy' }), buildTrade({ day: 200, side: 'sell' })]
    const report = gradePortfolio({ missionId: 'm1', asOfDay: 220, trades })
    expect(report.dimensions.every((d) => d.level === 'strong' || d.level === 'sound')).toBe(true)
    expect(report.summary).toContain('sound across every dimension')
  })
})
