import { describe, expect, it } from 'vitest'
import { assertFundamentalsMatchPriceWindow, getSandboxFundamentals, getSandboxPriceWindow } from './loadSandboxData.js'

describe('sandbox fundamentals/price-window binding', () => {
  it('the real fundamentals fixture carries an asOfDate', () => {
    expect(getSandboxFundamentals().asOfDate).toBeTruthy()
  })

  it('the real fundamentals fixture carries a windowId that matches the served price window', () => {
    const fundamentals = getSandboxFundamentals()
    const priceWindow = getSandboxPriceWindow()
    expect(fundamentals.windowId).toBeTruthy()
    expect(fundamentals.windowId).toBe(priceWindow.id)
  })

  it('assertFundamentalsMatchPriceWindow does not throw when windowId matches', () => {
    const fundamentals = getSandboxFundamentals()
    const priceWindow = getSandboxPriceWindow()
    expect(() => assertFundamentalsMatchPriceWindow(fundamentals, priceWindow)).not.toThrow()
  })

  it('assertFundamentalsMatchPriceWindow throws loudly on a windowId mismatch', () => {
    const fundamentals = { ...getSandboxFundamentals(), windowId: 'some-other-window' }
    const priceWindow = getSandboxPriceWindow()
    expect(() => assertFundamentalsMatchPriceWindow(fundamentals, priceWindow)).toThrow(/does not match/)
  })

  it('assertFundamentalsMatchPriceWindow throws when the price window is the mismatched side', () => {
    const fundamentals = getSandboxFundamentals()
    const priceWindow = { ...getSandboxPriceWindow(), id: 'a-future-second-window' }
    expect(() => assertFundamentalsMatchPriceWindow(fundamentals, priceWindow)).toThrow(/does not match/)
  })
})
