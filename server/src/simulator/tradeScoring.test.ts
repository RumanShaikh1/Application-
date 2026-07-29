import { describe, expect, it } from 'vitest'
import type { RubricCriterionResult } from '../../../shared/types.js'
import { scoreTradeProcess } from './tradeScoring.js'

function criterion(id: string, weight: number, matched: boolean): RubricCriterionResult {
  return { id, description: id, weight, matched }
}

describe('scoreTradeProcess', () => {
  it('scores 100 when every criterion matched', () => {
    const result = scoreTradeProcess([criterion('a', 30, true), criterion('b', 25, true), criterion('c', 25, true), criterion('d', 20, true)])
    expect(result.scoreTotal).toBe(100)
    expect(result.maxScore).toBe(100)
  })

  it('scores 0 when nothing matched', () => {
    const result = scoreTradeProcess([criterion('a', 30, false), criterion('b', 25, false)])
    expect(result.scoreTotal).toBe(0)
  })

  it('weights criteria correctly - a heavier unmatched criterion costs more than a lighter one', () => {
    const heavyUnmatched = scoreTradeProcess([criterion('position_sizing', 30, false), criterion('diversification', 25, true), criterion('rationale_grounded', 25, true), criterion('cost_awareness', 20, true)])
    const lightUnmatched = scoreTradeProcess([criterion('position_sizing', 30, true), criterion('diversification', 25, true), criterion('rationale_grounded', 25, true), criterion('cost_awareness', 20, false)])
    expect(heavyUnmatched.scoreTotal).toBeLessThan(lightUnmatched.scoreTotal)
  })

  it('never lets an empty criteria list produce NaN', () => {
    const result = scoreTradeProcess([])
    expect(Number.isNaN(result.scoreTotal)).toBe(false)
    expect(result.scoreTotal).toBe(0)
  })
})
