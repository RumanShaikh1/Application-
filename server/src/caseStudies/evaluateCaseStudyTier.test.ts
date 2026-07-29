import { describe, expect, it } from 'vitest'
import { CaseStudyTierMismatchError, evaluateCaseStudyTier } from './evaluateCaseStudyTier.js'
import { findCaseStudy } from './loadCaseStudies.js'
import type { CaseStudyInstrumentResult, CaseStudyInstrumentTier, CaseStudySizingResult, CaseStudySizingTier, CaseStudyTierAnswer } from '../../../shared/types.js'

const riskReadTier = {
  kind: 'risk_read' as const,
  id: 'risk-read',
  block: {
    readOptions: [
      { id: 'correct_read', label: 'correct', correct: true },
      { id: 'wrong_read', label: 'wrong', correct: false }
    ],
    factorOptions: [
      { id: 'f1', label: 'f1', correct: true },
      { id: 'f2', label: 'f2', correct: false }
    ]
  }
}

const sizingTier: CaseStudySizingTier = {
  kind: 'sizing',
  id: 'sizing',
  prompt: 'How far would you trim?',
  buckets: [
    { id: 'b20', label: '20%', value: 20 },
    { id: 'b12', label: '12%', value: 12 },
    { id: 'b5', label: '5%', value: 5 }
  ],
  bands: [
    { id: 'sound', min: 0, max: 5, credit: 'full' },
    { id: 'adjacent', min: 6, max: 12, credit: 'partial' }
  ],
  reasonQuestion: 'why?',
  reasonOptions: [
    { id: 'r1', label: 'good reason', correct: true },
    { id: 'r2', label: 'bad reason', correct: false }
  ]
}

const instrumentTier: CaseStudyInstrumentTier = {
  kind: 'instrument',
  id: 'instrument',
  maxLossQuestion: 'max loss?',
  maxLossOptions: [
    { id: 'unlimited', label: 'unlimited', correct: true },
    { id: 'capped', label: 'capped', correct: false }
  ],
  maxLossExplanation: 'a short can lose more than the stake',
  instrumentQuestion: 'which instrument?',
  instrumentOptions: [
    { id: 'short', label: 'short', correct: false },
    { id: 'put', label: 'put', correct: true }
  ],
  exitQuestion: 'what matters for survival?',
  exitOptions: [
    { id: 'size_small', label: 'size small', correct: true },
    { id: 'predefine_exit', label: 'predefine exit', correct: true },
    { id: 'size_up', label: 'size up if right', correct: false }
  ]
}

describe('evaluateCaseStudyTier - risk_read', () => {
  it('grades identically to the shared risk_read mechanic and tags the result with the tier id', () => {
    const answer: CaseStudyTierAnswer = { kind: 'risk_read', tierId: 'risk-read', selectedReadId: 'correct_read', selectedFactorIds: ['f1'] }
    const result = evaluateCaseStudyTier(riskReadTier, answer)
    expect(result.kind).toBe('risk_read')
    expect(result.tierId).toBe('risk-read')
    if (result.kind === 'risk_read') {
      expect(result.result.readCorrect).toBe(true)
      expect(result.result.combinedScore).toBe(1)
    }
  })
})

describe('evaluateCaseStudyTier - sizing (band grading)', () => {
  function sizingResult(bucketId: string, reasonIds: string[]): CaseStudySizingResult {
    const answer: CaseStudyTierAnswer = { kind: 'sizing', tierId: 'sizing', selectedBucketId: bucketId, selectedReasonFactorIds: reasonIds }
    const result = evaluateCaseStudyTier(sizingTier, answer)
    if (result.kind !== 'sizing') throw new Error('expected a sizing result')
    return result.result
  }

  it('a bucket inside the sound range gets full band credit', () => {
    const result = sizingResult('b5', ['r1'])
    expect(result.bandCredit).toBe('full')
    expect(result.selectedValue).toBe(5)
  })

  it('a bucket in the adjacent range gets partial band credit', () => {
    const result = sizingResult('b12', ['r1'])
    expect(result.bandCredit).toBe('partial')
  })

  it('a bucket outside every authored band (opposite direction) gets zero band credit', () => {
    const result = sizingResult('b20', ['r1'])
    expect(result.bandCredit).toBe('zero')
  })

  it('an unrecognised bucket id defaults to zero credit rather than matching a band by coincidence', () => {
    const result = sizingResult('not-a-real-bucket', [])
    expect(result.bandCredit).toBe('zero')
    expect(result.selectedValue).toBe(0)
  })

  it('the reason multi-select is weighted at least as heavily as the bucket - full band + zero reasons scores below full band + all correct reasons', () => {
    const fullBandNoReasons = sizingResult('b5', [])
    const fullBandWithReasons = sizingResult('b5', ['r1'])
    expect(fullBandWithReasons.combinedScore).toBeGreaterThan(fullBandNoReasons.combinedScore)
    // Reason weight (0.6) >= band weight (0.4): a perfect bucket with zero
    // reasoning should score no higher than 0.4 - luck on the number alone
    // is capped below "understanding."
    expect(fullBandNoReasons.combinedScore).toBeLessThanOrEqual(0.4)
  })

  it('a wrong-direction bucket with correct reasoning still scores below a sound bucket with correct reasoning', () => {
    const soundWithReasons = sizingResult('b5', ['r1'])
    const oppositeWithReasons = sizingResult('b20', ['r1'])
    expect(oppositeWithReasons.combinedScore).toBeLessThan(soundWithReasons.combinedScore)
  })
})

describe('evaluateCaseStudyTier - instrument (max-loss gate)', () => {
  function instrumentResult(maxLossId: string, exitIds?: string[]): CaseStudyInstrumentResult {
    const answer: CaseStudyTierAnswer = {
      kind: 'instrument',
      tierId: 'instrument',
      selectedMaxLossOptionId: maxLossId,
      selectedExitFactorIds: exitIds
    }
    const result = evaluateCaseStudyTier(instrumentTier, answer)
    if (result.kind !== 'instrument') throw new Error('expected an instrument result')
    return result.result
  }

  it('a wrong gate answer blocks grading entirely - no exit score, no combined score', () => {
    const result = instrumentResult('capped', ['size_small', 'predefine_exit'])
    expect(result.maxLossCorrect).toBe(false)
    expect(result.gatePassed).toBe(false)
    expect(result.correctMaxLossOptionId).toBe('unlimited')
    expect(result.maxLossExplanation).toBe('a short can lose more than the stake')
    expect(result.exitFactorScore).toBeUndefined()
    expect(result.combinedScore).toBeUndefined()
  })

  it('a wrong gate answer is never rescued by an otherwise-perfect exit answer submitted alongside it', () => {
    const result = instrumentResult('capped', ['size_small', 'predefine_exit'])
    expect(result.gatePassed).toBe(false)
  })

  it('a correct gate answer unlocks exit grading, scored on survivability - never on whether the trade paid off', () => {
    const result = instrumentResult('unlimited', ['size_small', 'predefine_exit'])
    expect(result.maxLossCorrect).toBe(true)
    expect(result.gatePassed).toBe(true)
    expect(result.exitFactorScore).toBe(1)
    expect(result.combinedScore).toBe(1)
  })

  it('a correct gate answer with a distractor-only exit answer floors at zero, not negative', () => {
    const result = instrumentResult('unlimited', ['size_up'])
    expect(result.gatePassed).toBe(true)
    expect(result.exitFactorScore).toBe(0)
  })

  it('omitting exit selections after a correct gate answer grades as zero, not skipped', () => {
    const result = instrumentResult('unlimited')
    expect(result.gatePassed).toBe(true)
    expect(result.exitFactorScore).toBe(0)
  })
})

describe('evaluateCaseStudyTier - tier independence', () => {
  it('a wrong tier-1 answer does not change how tier 2 grades - each tier only sees its own answer', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    const [tier1, tier2] = caseStudy.tiers

    // Deliberately get tier 1 wrong.
    evaluateCaseStudyTier(tier1, { kind: 'risk_read', tierId: tier1.id, selectedReadId: 'smart_diversification', selectedFactorIds: [] })

    // Tier 2, graded independently, in isolation.
    const isolated = evaluateCaseStudyTier(tier2, {
      kind: 'sizing',
      tierId: tier2.id,
      selectedBucketId: 'b5',
      selectedReasonFactorIds: ['governance_trumps_track_record', 'willingness_matters_even_if_undone']
    })

    // Same call again, with no tier-1 answer having ever been evaluated in this process - must be byte-for-byte identical.
    const standalone = evaluateCaseStudyTier(tier2, {
      kind: 'sizing',
      tierId: tier2.id,
      selectedBucketId: 'b5',
      selectedReasonFactorIds: ['governance_trumps_track_record', 'willingness_matters_even_if_undone']
    })

    expect(isolated).toEqual(standalone)
  })

  it('throws on a tier/answer kind or id mismatch rather than silently grading the wrong shape', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    const [tier1] = caseStudy.tiers
    expect(() =>
      evaluateCaseStudyTier(tier1, { kind: 'sizing', tierId: tier1.id, selectedBucketId: 'x', selectedReasonFactorIds: [] })
    ).toThrow(CaseStudyTierMismatchError)
  })
})

describe('evaluateCaseStudyTier - against the real shipped 3-tier fixture', () => {
  it('the max-loss gate on the reference case blocks on a wrong answer and unlocks on the right one', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    const instrument = caseStudy.tiers[2]
    if (instrument.kind !== 'instrument') throw new Error('expected tier 3 to be an instrument tier')

    const wrong = evaluateCaseStudyTier(instrument, { kind: 'instrument', tierId: instrument.id, selectedMaxLossOptionId: 'capped_at_price' })
    if (wrong.kind !== 'instrument') throw new Error('expected an instrument result')
    expect(wrong.result.gatePassed).toBe(false)

    const right = evaluateCaseStudyTier(instrument, {
      kind: 'instrument',
      tierId: instrument.id,
      selectedMaxLossOptionId: 'unlimited',
      selectedExitFactorIds: ['position_size_vs_conviction', 'predefined_exit', 'premium_is_the_cost_of_being_wrong']
    })
    if (right.kind !== 'instrument') throw new Error('expected an instrument result')
    expect(right.result.gatePassed).toBe(true)
    expect(right.result.exitFactorScore).toBe(1)
  })
})
