import { describe, expect, it } from 'vitest'
import { classifyTrade } from './classifyTrade.js'
import { getRateSetForDate } from './rateSetLoader.js'
import type { TaxTradeInput } from '../../../shared/types.js'

const rateSet = getRateSetForDate('2024-09-01')!

function trade(overrides: Partial<TaxTradeInput>): TaxTradeInput {
  return { tradeType: 'equity_delivery', buyPrice: 100, sellPrice: 110, quantity: 10, buyDate: '2024-01-01', sellDate: '2024-09-01', ...overrides }
}

describe('classifyTrade', () => {
  it('equity_intraday is always intraday, regardless of dates', () => {
    expect(classifyTrade(trade({ tradeType: 'equity_intraday', buyDate: '2010-01-01', sellDate: '2024-09-01' }), rateSet)).toBe('intraday')
  })

  it('fno is always fno, regardless of dates', () => {
    expect(classifyTrade(trade({ tradeType: 'fno', fnoInstrument: 'options', buyDate: '2010-01-01', sellDate: '2024-09-01' }), rateSet)).toBe('fno')
  })

  it('equity_delivery held 12 months or less is short-term', () => {
    expect(classifyTrade(trade({ buyDate: '2024-01-01', sellDate: '2024-06-01' }), rateSet)).toBe('equity_delivery_short')
  })

  it('equity_delivery held more than 12 months is long-term', () => {
    expect(classifyTrade(trade({ buyDate: '2022-01-01', sellDate: '2024-09-01' }), rateSet)).toBe('equity_delivery_long')
  })

  it('respects the rate set holdingPeriod.listedEquityLongTermCutoffMonths rather than a hardcoded 12', () => {
    const shorterCutoff = { ...rateSet, holdingPeriod: { listedEquityLongTermCutoffMonths: 6 } }
    // 8 months held - short-term under a 12-month cutoff, long-term under a 6-month one.
    const eightMonthTrade = trade({ buyDate: '2024-01-01', sellDate: '2024-09-01' })
    expect(classifyTrade(eightMonthTrade, rateSet)).toBe('equity_delivery_short')
    expect(classifyTrade(eightMonthTrade, shorterCutoff)).toBe('equity_delivery_long')
  })
})
