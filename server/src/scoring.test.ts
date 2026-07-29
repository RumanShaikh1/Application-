import { describe, expect, it } from 'vitest'
import { weightedCriteriaScore } from './scoring.js'

describe('weightedCriteriaScore', () => {
  it('returns 1 when every criterion matched', () => {
    const score = weightedCriteriaScore([
      { weight: 50, matched: true },
      { weight: 50, matched: true }
    ])
    expect(score).toBe(1)
  })

  it('returns 0 when nothing matched', () => {
    const score = weightedCriteriaScore([
      { weight: 50, matched: false },
      { weight: 50, matched: false }
    ])
    expect(score).toBe(0)
  })

  it('weights unevenly-weighted criteria correctly', () => {
    const score = weightedCriteriaScore([
      { weight: 10, matched: true },
      { weight: 30, matched: false }
    ])
    expect(score).toBeCloseTo(10 / 40, 8)
  })

  it('returns 0 for an empty criteria list instead of NaN or a divide-by-zero', () => {
    expect(weightedCriteriaScore([])).toBe(0)
  })

  it('returns 0 when every weight is zero instead of NaN', () => {
    const score = weightedCriteriaScore([
      { weight: 0, matched: true },
      { weight: 0, matched: false }
    ])
    expect(Number.isNaN(score)).toBe(false)
    expect(score).toBe(0)
  })
})
