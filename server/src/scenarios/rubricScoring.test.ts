import { describe, expect, it } from 'vitest'
import type { Rubric } from '../../../shared/types.js'
import { normalizeCriteriaMatches, scoreDecision } from './rubricScoring.js'

const rubric: Rubric = {
  soundChoiceIds: ['sell_all'],
  acceptableChoiceIds: ['trim'],
  criteria: [
    { id: 'a', description: 'A', weight: 50, factorOptionIds: ['a_factor'] },
    { id: 'b', description: 'B', weight: 50, factorOptionIds: ['b_factor'] }
  ],
  factorOptions: [
    { id: 'a_factor', label: 'Supports A', correct: true },
    { id: 'b_factor', label: 'Supports B', correct: true },
    { id: 'distractor', label: 'A plausible distractor', correct: false }
  ],
  idealSummary: 'ideal'
}

describe('scoreDecision', () => {
  it('gives full marks for a sound choice with every factor selected', () => {
    const result = scoreDecision(rubric, 'sell_all', ['a_factor', 'b_factor'])
    expect(result.choiceQuality).toBe('sound')
    expect(result.scoreTotal).toBe(100)
    expect(result.criteria.every((c) => c.matched)).toBe(true)
  })

  it('gives zero for a poor choice with no factors selected', () => {
    const result = scoreDecision(rubric, 'buy_more', [])
    expect(result.choiceQuality).toBe('poor')
    expect(result.scoreTotal).toBe(0)
    expect(result.criteria.every((c) => !c.matched)).toBe(true)
  })

  it('gives partial credit for an acceptable choice with half the factors selected', () => {
    const result = scoreDecision(rubric, 'trim', ['a_factor'])
    expect(result.choiceQuality).toBe('acceptable')
    // 70/30 split: (0.6 acceptable-choice-credit * 0.7) + (0.5 criteria-credit * 0.3) = 0.57
    expect(result.scoreTotal).toBe(57)
    expect(result.criteria.find((c) => c.id === 'a')!.matched).toBe(true)
    expect(result.criteria.find((c) => c.id === 'b')!.matched).toBe(false)
  })

  it('selecting only the distractor scores the same as selecting nothing - never negative', () => {
    const withDistractor = scoreDecision(rubric, 'trim', ['distractor'])
    const withNothing = scoreDecision(rubric, 'trim', [])
    expect(withDistractor.scoreTotal).toBe(withNothing.scoreTotal)
    expect(withDistractor.criteria.every((c) => !c.matched)).toBe(true)
  })

  it('normalizes weights that do not sum to 100', () => {
    const skewedRubric: Rubric = {
      soundChoiceIds: ['sell_all'],
      acceptableChoiceIds: [],
      criteria: [
        { id: 'a', description: 'A', weight: 10, factorOptionIds: ['a_factor'] },
        { id: 'b', description: 'B', weight: 30, factorOptionIds: ['b_factor'] }
      ],
      factorOptions: [
        { id: 'a_factor', label: 'Supports A', correct: true },
        { id: 'b_factor', label: 'Supports B', correct: true }
      ],
      idealSummary: 'ideal'
    }
    const result = scoreDecision(skewedRubric, 'sell_all', ['a_factor'])
    // 70/30 split: (1 sound-choice-credit * 0.7) + (0.25 criteria-credit * 0.3) * 100.
    expect(result.scoreTotal).toBe(77)
  })

  it('never lets an unrecognised choice error out - unknown chosenId scores as poor, not an error', () => {
    const result = scoreDecision(rubric, 'not_a_real_choice', [])
    expect(result.choiceQuality).toBe('poor')
  })

  it('an evidence string names which selected factor satisfied a matched criterion', () => {
    const result = scoreDecision(rubric, 'sell_all', ['a_factor', 'b_factor'])
    expect(result.criteria.find((c) => c.id === 'a')!.evidence).toBe('Supports A')
  })

  describe('the optional free-text bonus', () => {
    // Reuses the chasing-runup-01-style matchConcepts so the bonus path has something to match against.
    const rubricWithBonus: Rubric = {
      ...rubric,
      criteria: [
        { id: 'a', description: 'A', weight: 50, factorOptionIds: ['a_factor'], matchConcepts: [['hype']], minConceptsRequired: 1 },
        { id: 'b', description: 'B', weight: 50, factorOptionIds: ['b_factor'], matchConcepts: [['leverage']], minConceptsRequired: 1 }
      ]
    }

    it('is never load-bearing: cannot change choiceQuality regardless of rationale text', () => {
      const withGreatRationale = scoreDecision(rubricWithBonus, 'buy_more', [], 'This is hype and leverage, textbook.')
      expect(withGreatRationale.choiceQuality).toBe('poor')
    })

    it('can only reclaim points up to the ceiling a perfect factor-select would already earn - never above 100', () => {
      const result = scoreDecision(rubricWithBonus, 'sell_all', ['a_factor', 'b_factor'], 'This is hype and leverage.')
      expect(result.scoreTotal).toBe(100)
    })

    it('nudges the score upward when factor-selection alone left points on the table', () => {
      const withoutRationale = scoreDecision(rubricWithBonus, 'sell_all', [])
      const withRationale = scoreDecision(rubricWithBonus, 'sell_all', [], 'This is hype and leverage.')
      expect(withRationale.scoreTotal).toBeGreaterThan(withoutRationale.scoreTotal)
      expect(withRationale.scoreTotal).toBeLessThanOrEqual(100)
    })

    it('an empty or missing rationale contributes no bonus at all', () => {
      const missing = scoreDecision(rubricWithBonus, 'trim', ['a_factor'])
      const empty = scoreDecision(rubricWithBonus, 'trim', ['a_factor'], '')
      const whitespace = scoreDecision(rubricWithBonus, 'trim', ['a_factor'], '   ')
      expect(missing.scoreTotal).toBe(empty.scoreTotal)
      expect(missing.scoreTotal).toBe(whitespace.scoreTotal)
    })

    it('does not affect which criteria are marked matched - that stays purely factor-driven', () => {
      const result = scoreDecision(rubricWithBonus, 'sell_all', [], 'This is hype and leverage, covering both criteria in prose only.')
      expect(result.criteria.every((c) => !c.matched)).toBe(true)
    })
  })

  it('produces a non-empty feedback summary', () => {
    const result = scoreDecision(rubric, 'sell_all', ['a_factor', 'b_factor'])
    expect(result.feedback.length).toBeGreaterThan(0)
  })
})

describe('normalizeCriteriaMatches', () => {
  it('drops ids the rubric does not recognize', () => {
    const result = normalizeCriteriaMatches(rubric, [
      { id: 'a', matched: true },
      { id: 'not_a_real_criterion', matched: true }
    ])
    expect(result).toHaveLength(2)
    expect(result.find((match) => match.id === 'not_a_real_criterion')).toBeUndefined()
  })

  it('fills in matched:false for any criterion the input omits', () => {
    const result = normalizeCriteriaMatches(rubric, [{ id: 'a', matched: true }])
    expect(result).toEqual([
      { id: 'a', matched: true, evidence: undefined },
      { id: 'b', matched: false }
    ])
  })

  it('handles null/undefined input safely', () => {
    const expected = [
      { id: 'a', matched: false },
      { id: 'b', matched: false }
    ]
    expect(normalizeCriteriaMatches(rubric, null)).toEqual(expected)
    expect(normalizeCriteriaMatches(rubric, undefined)).toEqual(expected)
  })
})
