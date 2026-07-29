import { describe, expect, it } from 'vitest'
import { calculateNetReturn, calculateTradeCost } from './costModel.js'

describe('calculateNetReturn', () => {
  it('net return is always less than gross return on a profitable round trip', () => {
    const result = calculateNetReturn({ entryPrice: 100, exitPrice: 120, quantity: 10 })
    expect(result.grossReturnPercent).toBeCloseTo(20, 5)
    expect(result.netReturnPercent).toBeLessThan(result.grossReturnPercent)
    expect(result.brokerageCost + result.sttCost + result.exchangeFees + result.slippageCost).toBeGreaterThan(0)
  })

  it('net return is always less than gross return on a losing round trip too', () => {
    const result = calculateNetReturn({ entryPrice: 100, exitPrice: 80, quantity: 10 })
    expect(result.grossReturnPercent).toBeCloseTo(-20, 5)
    expect(result.netReturnPercent).toBeLessThan(result.grossReturnPercent)
  })

  it('never presents a frictionless number - net always strictly differs from gross', () => {
    const result = calculateNetReturn({ entryPrice: 250, exitPrice: 250, quantity: 5 })
    expect(result.grossReturnPercent).toBe(0)
    expect(result.netReturnPercent).toBeLessThan(0)
  })

  it('is quantity-independent as a percentage (costs and gains both scale with quantity)', () => {
    const small = calculateNetReturn({ entryPrice: 100, exitPrice: 120, quantity: 1 })
    const large = calculateNetReturn({ entryPrice: 100, exitPrice: 120, quantity: 10000 })
    expect(small.netReturnPercent).toBeCloseTo(large.netReturnPercent, 5)
  })

  it('handles zero quantity and zero entry price without NaN or a divide-by-zero', () => {
    const zeroQty = calculateNetReturn({ entryPrice: 100, exitPrice: 120, quantity: 0 })
    const zeroPrice = calculateNetReturn({ entryPrice: 0, exitPrice: 120, quantity: 10 })

    expect(Number.isNaN(zeroQty.netReturnPercent)).toBe(false)
    expect(Number.isNaN(zeroPrice.netReturnPercent)).toBe(false)
    expect(zeroQty.netReturnPercent).toBe(0)
    expect(zeroPrice.netReturnPercent).toBe(0)
  })
})

describe('calculateTradeCost', () => {
  it('a buy costs cash beyond the sticker price - net cash impact is negative and larger in magnitude than gross value', () => {
    const result = calculateTradeCost({ price: 100, quantity: 10, side: 'buy' })
    expect(result.grossValue).toBe(1000)
    expect(result.netCashImpact).toBeLessThan(-result.grossValue)
  })

  it('a sell nets less cash than the sticker price - net cash impact is positive but smaller than gross value', () => {
    const result = calculateTradeCost({ price: 100, quantity: 10, side: 'sell' })
    expect(result.grossValue).toBe(1000)
    expect(result.netCashImpact).toBeGreaterThan(0)
    expect(result.netCashImpact).toBeLessThan(result.grossValue)
  })

  it('costs are always positive and never zero for a real trade', () => {
    const result = calculateTradeCost({ price: 250, quantity: 5, side: 'buy' })
    expect(result.brokerageCost + result.sttCost + result.exchangeFees + result.slippageCost).toBeGreaterThan(0)
  })

  it('handles zero/invalid input without NaN or a divide-by-zero', () => {
    const zeroQty = calculateTradeCost({ price: 100, quantity: 0, side: 'buy' })
    const zeroPrice = calculateTradeCost({ price: 0, quantity: 10, side: 'sell' })
    expect(Number.isNaN(zeroQty.netCashImpact)).toBe(false)
    expect(Number.isNaN(zeroPrice.netCashImpact)).toBe(false)
    expect(zeroQty.netCashImpact).toBe(0)
    expect(zeroPrice.netCashImpact).toBe(0)
  })

  it('composing a buy leg and a matching sell leg reproduces the same total costs as the round-trip calculateNetReturn - one honest source of truth', () => {
    const entryPrice = 180
    const exitPrice = 210
    const quantity = 25

    const buyLeg = calculateTradeCost({ price: entryPrice, quantity, side: 'buy' })
    const sellLeg = calculateTradeCost({ price: exitPrice, quantity, side: 'sell' })
    const roundTrip = calculateNetReturn({ entryPrice, exitPrice, quantity })

    expect(buyLeg.sttCost + sellLeg.sttCost).toBeCloseTo(roundTrip.sttCost, 8)
    expect(buyLeg.exchangeFees + sellLeg.exchangeFees).toBeCloseTo(roundTrip.exchangeFees, 8)
    expect(buyLeg.brokerageCost + sellLeg.brokerageCost).toBeCloseTo(roundTrip.brokerageCost, 8)
    expect(buyLeg.slippageCost + sellLeg.slippageCost).toBeCloseTo(roundTrip.slippageCost, 8)
  })
})
