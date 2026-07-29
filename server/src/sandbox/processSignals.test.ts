import { describe, expect, it } from 'vitest'
import { detectConcentrationSignals, detectImprovementSignals, detectOvertrading, detectRunUpChasing } from './processSignals.js'
import type { DiversificationSummary, PositionSizeCheck, SandboxDailyClose, SandboxTrade } from '../../../shared/types.js'

const WITHIN: PositionSizeCheck = { symbol: 'RELIANCE.NS', percentOfPortfolio: 15, withinGuideline: true }
const OVER: PositionSizeCheck = { symbol: 'RELIANCE.NS', percentOfPortfolio: 42, withinGuideline: false }
const DIVERSIFIED: DiversificationSummary = { sectorAllocations: [{ sector: 'Energy', percentOfPortfolio: 15 }], concentratedSectorWarning: false }
const CONCENTRATED: DiversificationSummary = { sectorAllocations: [{ sector: 'Energy', percentOfPortfolio: 55 }], concentratedSectorWarning: true }

describe('detectConcentrationSignals', () => {
  it('fires nothing when both checks are clean', () => {
    expect(detectConcentrationSignals(WITHIN, DIVERSIFIED)).toEqual([])
  })

  it('fires a position_concentration nudge when the position check fails', () => {
    const signals = detectConcentrationSignals(OVER, DIVERSIFIED)
    expect(signals).toHaveLength(1)
    expect(signals[0].kind).toBe('position_concentration')
    expect(signals[0].tone).toBe('nudge')
  })

  it('fires a sector_concentration nudge naming the worst sector', () => {
    const signals = detectConcentrationSignals(WITHIN, CONCENTRATED)
    expect(signals).toHaveLength(1)
    expect(signals[0].kind).toBe('sector_concentration')
    expect(signals[0].message).toContain('Energy')
  })

  it('fires both at once when both checks fail', () => {
    const signals = detectConcentrationSignals(OVER, CONCENTRATED)
    expect(signals.map((s) => s.kind).sort()).toEqual(['position_concentration', 'sector_concentration'])
  })
})

describe('detectImprovementSignals', () => {
  it('celebrates trimming back within guideline on a sell', () => {
    const signals = detectImprovementSignals({ positionSizeCheck: OVER, diversification: DIVERSIFIED }, { positionSizeCheck: WITHIN, diversification: DIVERSIFIED }, 'sell')
    expect(signals).toHaveLength(1)
    expect(signals[0].kind).toBe('trimmed_winner')
    expect(signals[0].tone).toBe('celebrate')
  })

  it('does NOT celebrate the same transition on a buy - only a sell can "trim"', () => {
    const signals = detectImprovementSignals({ positionSizeCheck: OVER, diversification: DIVERSIFIED }, { positionSizeCheck: WITHIN, diversification: DIVERSIFIED }, 'buy')
    expect(signals.find((s) => s.kind === 'trimmed_winner')).toBeUndefined()
  })

  it('celebrates diversification improving', () => {
    const signals = detectImprovementSignals({ positionSizeCheck: WITHIN, diversification: CONCENTRATED }, { positionSizeCheck: WITHIN, diversification: DIVERSIFIED }, 'sell')
    expect(signals.find((s) => s.kind === 'diversification_improved')).toBeDefined()
  })

  it('never mentions price or return in its messages', () => {
    const signals = detectImprovementSignals({ positionSizeCheck: OVER, diversification: CONCENTRATED }, { positionSizeCheck: WITHIN, diversification: DIVERSIFIED }, 'sell')
    for (const signal of signals) {
      expect(signal.message.toLowerCase()).not.toMatch(/profit|loss|return|gain|₹/)
    }
  })

  it('fires nothing if nothing improved', () => {
    expect(detectImprovementSignals({ positionSizeCheck: WITHIN, diversification: DIVERSIFIED }, { positionSizeCheck: WITHIN, diversification: DIVERSIFIED }, 'sell')).toEqual([])
  })
})

describe('detectRunUpChasing', () => {
  const series: SandboxDailyClose[] = Array.from({ length: 60 }, (_, day) => ({
    day,
    date: `2020-day-${day}`,
    close: day < 40 ? 100 : 100 + (day - 40) * 5 // flat, then a sharp run-up starting day 40
  }))

  it('fires on a buy after a genuine run-up in the trailing lookback window', () => {
    const signal = detectRunUpChasing('buy', 'RELIANCE.NS', 50, series)
    expect(signal).not.toBeNull()
    expect(signal?.kind).toBe('run_up_chasing')
  })

  it('does not fire on a sell, regardless of run-up', () => {
    expect(detectRunUpChasing('sell', 'RELIANCE.NS', 50, series)).toBeNull()
  })

  it('does not fire when the trailing window was flat', () => {
    expect(detectRunUpChasing('buy', 'RELIANCE.NS', 20, series)).toBeNull()
  })

  it('never reads a close beyond the given day, even when later data exists in the series (no lookahead)', () => {
    // day 45 is mid-runup; a huge spike is planted further out at day 55,
    // which must never influence the day-45 evaluation.
    const withFutureSpike = series.map((point) => (point.day === 55 ? { ...point, close: 100000 } : point))
    const atDay45 = detectRunUpChasing('buy', 'RELIANCE.NS', 45, withFutureSpike)
    const atDay45Baseline = detectRunUpChasing('buy', 'RELIANCE.NS', 45, series)
    expect(atDay45).toEqual(atDay45Baseline)
  })
})

describe('detectOvertrading', () => {
  function tradeAt(day: number): SandboxTrade {
    return {
      id: `t-${day}`,
      symbol: 'RELIANCE.NS',
      side: 'buy',
      quantity: 1,
      price: 700,
      day,
      costBreakdown: { grossValue: 700, brokerageCost: 0, sttCost: 0, exchangeFees: 0, slippageCost: 0, netCashImpact: -700 },
      thesisTag: 'fits_mission_goal',
      timestamp: 0,
      positionSizeCheck: WITHIN,
      diversification: DIVERSIFIED
    }
  }

  it('does not fire for a normal trading pace', () => {
    const log = [tradeAt(10), tradeAt(50)]
    expect(detectOvertrading(log, 60)).toBeNull()
  })

  it('fires once the recent-window count exceeds the threshold', () => {
    const log = [tradeAt(41), tradeAt(42), tradeAt(43), tradeAt(44), tradeAt(45)]
    // 5 prior trades within the last 20 days + the trade being placed now = 6, over the threshold of 5.
    const signal = detectOvertrading(log, 50)
    expect(signal).not.toBeNull()
    expect(signal?.kind).toBe('overtrading')
  })

  it('ignores trades outside the trailing window', () => {
    const log = [tradeAt(1), tradeAt(2), tradeAt(3), tradeAt(4), tradeAt(5)]
    expect(detectOvertrading(log, 100)).toBeNull()
  })
})
