import { describe, expect, it } from 'vitest'
import { BAND_CREDIT_VALUE, scoreBand, scoreMultiSelect, scoreSingleSelect } from './grader.js'
import type { Band, SelectOption } from '../../../shared/types.js'

describe('scoreSingleSelect', () => {
  const options: SelectOption[] = [
    { id: 'downside', label: 'Skewed downside', correct: true },
    { id: 'upside', label: 'Skewed upside', correct: false },
    { id: 'balanced', label: 'Roughly balanced', correct: false }
  ]

  it('returns true for a correct selection', () => {
    expect(scoreSingleSelect(options, 'downside')).toBe(true)
  })

  it('returns false for an incorrect selection', () => {
    expect(scoreSingleSelect(options, 'upside')).toBe(false)
  })

  it('returns false for an unrecognised id', () => {
    expect(scoreSingleSelect(options, 'not_a_real_option')).toBe(false)
  })

  it('returns false when nothing was selected', () => {
    expect(scoreSingleSelect(options, undefined)).toBe(false)
  })

  it('supports more than one correct option when a case is genuinely ambiguous', () => {
    const ambiguous: SelectOption[] = [
      { id: 'a', label: 'A', correct: true },
      { id: 'b', label: 'B', correct: true },
      { id: 'c', label: 'C', correct: false }
    ]
    expect(scoreSingleSelect(ambiguous, 'a')).toBe(true)
    expect(scoreSingleSelect(ambiguous, 'b')).toBe(true)
    expect(scoreSingleSelect(ambiguous, 'c')).toBe(false)
  })
})

describe('scoreMultiSelect', () => {
  // 3 genuine drivers, 2 distractors - mirrors a real risk_read factor list.
  const options: SelectOption[] = [
    { id: 'revenue_declining', label: 'Revenue has been declining', correct: true },
    { id: 'margin_compressing', label: 'Margins are compressing', correct: true },
    { id: 'valuation_stretched', label: 'Valuation looks stretched', correct: true },
    { id: 'social_media_buzz', label: 'Social media is excited about it', correct: false },
    { id: 'volume_spike', label: 'Trading volume has spiked', correct: false }
  ]

  it('selecting every genuine driver and no distractor scores full credit', () => {
    const result = scoreMultiSelect(options, ['revenue_declining', 'margin_compressing', 'valuation_stretched'])
    expect(result.score).toBe(1)
    expect(result.correctSelected).toEqual(['revenue_declining', 'margin_compressing', 'valuation_stretched'])
    expect(result.incorrectSelected).toEqual([])
    expect(result.missedCorrect).toEqual([])
  })

  it('selecting only distractors scores zero, not negative', () => {
    const result = scoreMultiSelect(options, ['social_media_buzz', 'volume_spike'])
    expect(result.score).toBe(0)
    expect(result.correctSelected).toEqual([])
    expect(result.incorrectSelected).toEqual(['social_media_buzz', 'volume_spike'])
  })

  it('selecting nothing scores zero', () => {
    const result = scoreMultiSelect(options, [])
    expect(result.score).toBe(0)
    expect(result.missedCorrect).toHaveLength(3)
  })

  it('is correct-minus-incorrect, floored at zero - guessing everything is never better than guessing nothing', () => {
    // 1 correct + 2 incorrect = -1 raw, floored to 0 - same as selecting nothing.
    const partial = scoreMultiSelect(options, ['revenue_declining', 'social_media_buzz', 'volume_spike'])
    expect(partial.score).toBe(0)

    const nothing = scoreMultiSelect(options, [])
    expect(partial.score).toBe(nothing.score)
  })

  it('a genuinely partial, honest answer earns partial credit rather than being punished to zero', () => {
    // 2 of 3 correct, 0 incorrect = 2/3.
    const result = scoreMultiSelect(options, ['revenue_declining', 'margin_compressing'])
    expect(result.score).toBeCloseTo(2 / 3, 10)
    expect(result.missedCorrect).toEqual(['valuation_stretched'])
  })

  it('two correct and one incorrect nets to partial, not zero', () => {
    // 2 correct - 1 incorrect = 1 raw, / 3 total correct = 1/3.
    const result = scoreMultiSelect(options, ['revenue_declining', 'margin_compressing', 'social_media_buzz'])
    expect(result.score).toBeCloseTo(1 / 3, 10)
  })

  it('ignores an id that matches no authored option, neither helping nor hurting', () => {
    const withUnknown = scoreMultiSelect(options, ['revenue_declining', 'margin_compressing', 'valuation_stretched', 'not_a_real_option'])
    const withoutUnknown = scoreMultiSelect(options, ['revenue_declining', 'margin_compressing', 'valuation_stretched'])
    expect(withUnknown.score).toBe(withoutUnknown.score)
    expect(withUnknown.correctSelected).toEqual(withoutUnknown.correctSelected)
    expect(withUnknown.incorrectSelected).toEqual([])
  })

  it('returns zero, not NaN, for a malformed option list with no correct options at all', () => {
    const allDistractors: SelectOption[] = [{ id: 'x', label: 'x', correct: false }]
    expect(scoreMultiSelect(allDistractors, ['x']).score).toBe(0)
  })
})

describe('scoreBand', () => {
  // Mirrors a real sizing tier: trim a 45% holding to somewhere sound (15-25%),
  // adjacent buckets get partial credit, and the opposite action (adding more) scores zero.
  const bands: Band[] = [
    { id: 'sell_all', min: 0, max: 4, credit: 'zero' },
    { id: 'trim_too_much', min: 5, max: 14, credit: 'partial' },
    { id: 'sound_trim', min: 15, max: 25, credit: 'full' },
    { id: 'trim_too_little', min: 26, max: 35, credit: 'partial' },
    { id: 'hold_or_add', min: 36, max: 100, credit: 'zero' }
  ]

  it('a value inside the authored sound band scores full credit', () => {
    expect(scoreBand(bands, 15).credit).toBe('full')
    expect(scoreBand(bands, 20).credit).toBe('full')
    expect(scoreBand(bands, 25).credit).toBe('full')
  })

  it('a value in an adjacent band scores partial credit', () => {
    expect(scoreBand(bands, 10).credit).toBe('partial')
    expect(scoreBand(bands, 30).credit).toBe('partial')
  })

  it('a value in the opposite-action band scores zero', () => {
    expect(scoreBand(bands, 45).credit).toBe('zero') // holding/adding when the sound move was to trim
    expect(scoreBand(bands, 0).credit).toBe('zero') // selling everything is also the wrong call
  })

  it('a value outside every authored band defaults to zero rather than being silently rewarded', () => {
    const gappedBands: Band[] = [{ id: 'only', min: 15, max: 25, credit: 'full' }]
    const result = scoreBand(gappedBands, 50)
    expect(result.credit).toBe('zero')
    expect(result.band).toBeUndefined()
  })

  it('band bounds are inclusive at both ends', () => {
    expect(scoreBand(bands, 15).band?.id).toBe('sound_trim')
    expect(scoreBand(bands, 25).band?.id).toBe('sound_trim')
    expect(scoreBand(bands, 14).band?.id).toBe('trim_too_much')
    expect(scoreBand(bands, 26).band?.id).toBe('trim_too_little')
  })
})

describe('BAND_CREDIT_VALUE', () => {
  it('maps the three credit tiers to fixed numeric values', () => {
    expect(BAND_CREDIT_VALUE.full).toBe(1)
    expect(BAND_CREDIT_VALUE.partial).toBe(0.5)
    expect(BAND_CREDIT_VALUE.zero).toBe(0)
  })
})
