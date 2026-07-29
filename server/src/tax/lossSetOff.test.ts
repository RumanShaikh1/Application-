import { describe, expect, it } from 'vitest'
import { computeLossHarvesting } from './lossSetOff.js'
import { getRateSetForDate } from './rateSetLoader.js'
import type { OpenLossPosition, RealizedGainsThisFY } from '../../../shared/types.js'

const rateSet = getRateSetForDate('2024-09-01')! // post-Budget: ₹1.25L LTCG exemption

describe('computeLossHarvesting - golden case', () => {
  it('STCL fully absorbed by STCG, LTCL fully absorbed by LTCG, exemption headroom exhausted', () => {
    const positions: OpenLossPosition[] = [
      { id: 'p1', label: 'STCL position', unrealizedLossAmount: 30000, classification: 'short_term' },
      { id: 'p2', label: 'LTCL position', unrealizedLossAmount: 50000, classification: 'long_term' }
    ]
    const realizedGains: RealizedGainsThisFY = { shortTermGains: 80000, longTermGains: 200000 }

    const result = computeLossHarvesting(positions, realizedGains, rateSet)

    expect(result.suggestions).toEqual([
      {
        positionId: 'p1',
        label: 'STCL position',
        lossAmount: 30000,
        classification: 'short_term',
        offsetAppliedToShortTermGains: 30000,
        offsetAppliedToLongTermGains: 0,
        remainingUnoffsetLoss: 0
      },
      {
        positionId: 'p2',
        label: 'LTCL position',
        lossAmount: 50000,
        classification: 'long_term',
        offsetAppliedToShortTermGains: 0,
        offsetAppliedToLongTermGains: 50000,
        remainingUnoffsetLoss: 0
      }
    ])
    expect(result.totalShortTermGainsAfterOffset).toBe(50000)
    expect(result.totalLongTermGainsAfterOffset).toBe(150000)
    // net LTCG of 150,000 already exceeds the ₹1.25L exemption - no headroom left.
    expect(result.remainingLongTermExemption).toBe(0)
  })
})

describe('computeLossHarvesting - asymmetric set-off rules', () => {
  it('STCL spills into LTCG once STCG is exhausted', () => {
    const positions: OpenLossPosition[] = [{ id: 'p1', label: 'Big STCL', unrealizedLossAmount: 30000, classification: 'short_term' }]
    const realizedGains: RealizedGainsThisFY = { shortTermGains: 10000, longTermGains: 100000 }

    const result = computeLossHarvesting(positions, realizedGains, rateSet)

    expect(result.suggestions[0].offsetAppliedToShortTermGains).toBe(10000)
    expect(result.suggestions[0].offsetAppliedToLongTermGains).toBe(20000)
    expect(result.suggestions[0].remainingUnoffsetLoss).toBe(0)
    expect(result.totalShortTermGainsAfterOffset).toBe(0)
    expect(result.totalLongTermGainsAfterOffset).toBe(80000)
  })

  it('LTCL never offsets STCG, even when STCG is available and LTCG is not', () => {
    const positions: OpenLossPosition[] = [{ id: 'p1', label: 'LTCL', unrealizedLossAmount: 20000, classification: 'long_term' }]
    const realizedGains: RealizedGainsThisFY = { shortTermGains: 50000, longTermGains: 5000 }

    const result = computeLossHarvesting(positions, realizedGains, rateSet)

    expect(result.suggestions[0].offsetAppliedToLongTermGains).toBe(5000)
    expect(result.suggestions[0].offsetAppliedToShortTermGains).toBe(0)
    expect(result.suggestions[0].remainingUnoffsetLoss).toBe(15000)
    expect(result.totalShortTermGainsAfterOffset).toBe(50000) // untouched
  })

  it('warns about the carry-forward filing deadline only when a loss is left unoffset', () => {
    const fullyAbsorbed = computeLossHarvesting(
      [{ id: 'p1', label: 'Small STCL', unrealizedLossAmount: 1000, classification: 'short_term' }],
      { shortTermGains: 5000, longTermGains: 0 },
      rateSet
    )
    expect(fullyAbsorbed.warnings.some((w) => w.includes('carry forward') || w === rateSet.lossSetOff.note)).toBe(false)

    const leftover = computeLossHarvesting(
      [{ id: 'p1', label: 'Large STCL', unrealizedLossAmount: 10000, classification: 'short_term' }],
      { shortTermGains: 1000, longTermGains: 0 },
      rateSet
    )
    expect(leftover.warnings).toContain(rateSet.lossSetOff.note)
  })

  it('every warning is phrased as what the rules permit, never an instruction to sell', () => {
    const result = computeLossHarvesting(
      [{ id: 'p1', label: 'Position', unrealizedLossAmount: 1000, classification: 'short_term' }],
      { shortTermGains: 5000, longTermGains: 0 },
      rateSet
    )
    for (const warning of result.warnings) {
      expect(warning.toLowerCase()).not.toMatch(/\byou should\b|\bmust sell\b/)
      // "recommend" itself is fine ("this is not a recommendation") - only bare affirmative advice is banned.
      expect(warning.toLowerCase()).not.toMatch(/(?<!not a )\brecommend(s|ed)? (that )?you\b/)
    }
  })
})

describe('computeLossHarvesting - reconciliation property', () => {
  it('every suggestion accounts for its full loss amount across both offset targets and the remainder', () => {
    const positions: OpenLossPosition[] = [
      { id: 'p1', label: 'A', unrealizedLossAmount: 12345, classification: 'short_term' },
      { id: 'p2', label: 'B', unrealizedLossAmount: 6789, classification: 'long_term' },
      { id: 'p3', label: 'C', unrealizedLossAmount: 500, classification: 'short_term' }
    ]
    const realizedGains: RealizedGainsThisFY = { shortTermGains: 4000, longTermGains: 3000 }

    const result = computeLossHarvesting(positions, realizedGains, rateSet)

    for (const s of result.suggestions) {
      expect(s.offsetAppliedToShortTermGains + s.offsetAppliedToLongTermGains + s.remainingUnoffsetLoss).toBeCloseTo(s.lossAmount, 9)
    }

    const totalOffsetToShortTerm = result.suggestions.reduce((sum, s) => sum + s.offsetAppliedToShortTermGains, 0)
    const totalOffsetToLongTerm = result.suggestions.reduce((sum, s) => sum + s.offsetAppliedToLongTermGains, 0)
    expect(result.totalShortTermGainsAfterOffset).toBeCloseTo(result.totalShortTermGainsBeforeOffset - totalOffsetToShortTerm, 9)
    expect(result.totalLongTermGainsAfterOffset).toBeCloseTo(result.totalLongTermGainsBeforeOffset - totalOffsetToLongTerm, 9)
  })

  it('remainingLongTermExemption is never negative even when net LTCG far exceeds the exemption', () => {
    const result = computeLossHarvesting([], { shortTermGains: 0, longTermGains: 10000000 }, rateSet)
    expect(result.remainingLongTermExemption).toBe(0)
  })

  it('with no positions, gains pass through unchanged and exemption reflects gains alone', () => {
    const result = computeLossHarvesting([], { shortTermGains: 20000, longTermGains: 40000 }, rateSet)
    expect(result.suggestions).toEqual([])
    expect(result.totalShortTermGainsAfterOffset).toBe(20000)
    expect(result.totalLongTermGainsAfterOffset).toBe(40000)
    expect(result.remainingLongTermExemption).toBe(rateSet.capitalGains.longTerm.exemptionAmountPerFY - 40000)
  })
})
