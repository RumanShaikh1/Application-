import { describe, expect, it } from 'vitest'
import { computeCharges } from './computeCharges.js'
import { getRateSetForDate } from './rateSetLoader.js'
import type { TaxTradeInput } from '../../../shared/types.js'

const rateSet = getRateSetForDate('2024-09-01')!

function trade(overrides: Partial<TaxTradeInput>): TaxTradeInput {
  return { tradeType: 'equity_delivery', buyPrice: 100, sellPrice: 110, quantity: 100, buyDate: '2024-01-01', sellDate: '2024-09-01', ...overrides }
}

describe('computeCharges', () => {
  it('stamp duty only ever appears on the buy leg', () => {
    const charges = computeCharges(trade({}), rateSet)
    const stampDutyCharges = charges.filter((c) => c.id.startsWith('stamp_duty'))
    expect(stampDutyCharges).toHaveLength(1)
    expect(stampDutyCharges[0].leg).toBe('buy')
  })

  it('every other charge type appears on both legs', () => {
    const charges = computeCharges(trade({}), rateSet)
    for (const prefix of ['brokerage', 'stt', 'exchange_charge', 'sebi_fee', 'gst']) {
      const legs = charges.filter((c) => c.id.startsWith(prefix)).map((c) => c.leg)
      expect(legs.sort()).toEqual(['buy', 'sell'])
    }
  })

  it('equity delivery brokerage is zero (illustrative discount-broker figure)', () => {
    const charges = computeCharges(trade({}), rateSet)
    const brokerage = charges.filter((c) => c.id.startsWith('brokerage'))
    expect(brokerage.every((c) => c.amount === 0)).toBe(true)
  })

  it('intraday STT applies only on the sell leg, unlike delivery which applies on both', () => {
    const deliveryStt = computeCharges(trade({ tradeType: 'equity_delivery' }), rateSet).filter((c) => c.id.startsWith('stt'))
    const intradayStt = computeCharges(trade({ tradeType: 'equity_intraday' }), rateSet).filter((c) => c.id.startsWith('stt'))

    expect(deliveryStt.find((c) => c.leg === 'buy')!.amount).toBeGreaterThan(0)
    expect(intradayStt.find((c) => c.leg === 'buy')!.amount).toBe(0)
    expect(intradayStt.find((c) => c.leg === 'sell')!.amount).toBeGreaterThan(0)
  })

  it('futures and options use different STT/exchange-charge sub-rates for the same notional turnover', () => {
    const futuresCharges = computeCharges(trade({ tradeType: 'fno', fnoInstrument: 'futures' }), rateSet)
    const optionsCharges = computeCharges(trade({ tradeType: 'fno', fnoInstrument: 'options' }), rateSet)

    const futuresStt = futuresCharges.find((c) => c.id === 'stt_sell')!.amount
    const optionsStt = optionsCharges.find((c) => c.id === 'stt_sell')!.amount
    expect(futuresStt).not.toBe(optionsStt)
  })

  it('every charge amount is non-negative', () => {
    for (const tradeType of ['equity_delivery', 'equity_intraday'] as const) {
      const charges = computeCharges(trade({ tradeType }), rateSet)
      expect(charges.every((c) => c.amount >= 0)).toBe(true)
    }
  })

  it('scales linearly with quantity (doubling quantity doubles every charge)', () => {
    const base = computeCharges(trade({ quantity: 100 }), rateSet)
    const doubled = computeCharges(trade({ quantity: 200 }), rateSet)
    for (let i = 0; i < base.length; i++) {
      expect(doubled[i].amount).toBeCloseTo(base[i].amount * 2, 9)
    }
  })
})
