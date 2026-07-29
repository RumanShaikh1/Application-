import { BAND_CREDIT_VALUE, evaluateRiskReadBlock, scoreBand, scoreMultiSelect, scoreSingleSelect } from '../grading/grader.js'
import type { CaseStudyInstrumentResult, CaseStudyInstrumentTier, CaseStudySizingResult, CaseStudySizingTier, CaseStudyTier, CaseStudyTierAnswer, CaseStudyTierResult, RiskReadResult } from '../../../shared/types.js'

/** Thrown for a kind/id mismatch between a tier and its answer - the route layer is expected to look the tier up by `answer.tierId` first, so this only fires on a genuinely malformed request. */
export class CaseStudyTierMismatchError extends Error {}

// The reason multi-select is weighted at least as heavily as the bucket
// itself - "a good number reached by luck is not understanding" (CLAUDE.md-
// adjacent product invariant from the original spec). 0.6/0.4 mirrors the
// same asymmetry evaluateRiskReadBlock uses for read-vs-factors.
const SIZING_REASON_WEIGHT = 0.6

function evaluateSizingTier(tier: CaseStudySizingTier, answer: Extract<CaseStudyTierAnswer, { kind: 'sizing' }>): CaseStudySizingResult {
  const bucket = tier.buckets.find((candidate) => candidate.id === answer.selectedBucketId)
  // An id naming no real bucket must never coincidentally land inside a real
  // band (e.g. a bucket genuinely valued at 0 would otherwise look
  // indistinguishable from "no valid bucket") - NaN never matches any band,
  // so this always grades as zero credit. The route layer validates the id
  // before this ever runs; this is the defensive second layer.
  const bandResult = scoreBand(tier.bands, bucket?.value ?? Number.NaN)
  const reasonResult = scoreMultiSelect(tier.reasonOptions, answer.selectedReasonFactorIds)

  const combinedScore = BAND_CREDIT_VALUE[bandResult.credit] * (1 - SIZING_REASON_WEIGHT) + reasonResult.score * SIZING_REASON_WEIGHT

  return {
    bandCredit: bandResult.credit,
    selectedValue: bucket?.value ?? 0,
    reasonFactorScore: reasonResult.score,
    correctReasonFactorIds: reasonResult.correctSelected,
    incorrectlySelectedReasonFactorIds: reasonResult.incorrectSelected,
    missedReasonFactorIds: reasonResult.missedCorrect,
    combinedScore
  }
}

function evaluateInstrumentTier(tier: CaseStudyInstrumentTier, answer: Extract<CaseStudyTierAnswer, { kind: 'instrument' }>): CaseStudyInstrumentResult {
  const maxLossCorrect = scoreSingleSelect(tier.maxLossOptions, answer.selectedMaxLossOptionId)
  const correctMaxLossOptionId = tier.maxLossOptions.find((option) => option.correct)?.id ?? ''

  if (!maxLossCorrect) {
    // The gate is the whole point of tier 3 - never skippable. Nothing past
    // this point is graded, no matter what the client also sent alongside
    // the wrong gate answer.
    return { maxLossCorrect: false, correctMaxLossOptionId, maxLossExplanation: tier.maxLossExplanation, gatePassed: false }
  }

  const exitResult = scoreMultiSelect(tier.exitOptions, answer.selectedExitFactorIds ?? [])

  return {
    maxLossCorrect: true,
    correctMaxLossOptionId,
    maxLossExplanation: tier.maxLossExplanation,
    gatePassed: true,
    exitFactorScore: exitResult.score,
    correctExitFactorIds: exitResult.correctSelected,
    incorrectlySelectedExitFactorIds: exitResult.incorrectSelected,
    missedExitFactorIds: exitResult.missedCorrect,
    combinedScore: exitResult.score
  }
}

function evaluateRiskReadTierResult(block: CaseStudyTier & { kind: 'risk_read' }, answer: Extract<CaseStudyTierAnswer, { kind: 'risk_read' }>): RiskReadResult {
  return { id: block.id, ...evaluateRiskReadBlock(block.block, answer.selectedReadId, answer.selectedFactorIds) }
}

/**
 * Pure. Grades exactly one tier against exactly one answer - tier
 * independence means this never looks at any other tier or any prior
 * answer, so a wrong tier-1 read can never make tier-2/3 grading
 * incoherent. Throws only on a kind/id mismatch (a malformed request the
 * route layer should have already rejected).
 */
export function evaluateCaseStudyTier(tier: CaseStudyTier, answer: CaseStudyTierAnswer): CaseStudyTierResult {
  if (tier.id !== answer.tierId || tier.kind !== answer.kind) {
    throw new CaseStudyTierMismatchError(`Answer for tier "${answer.tierId}" (${answer.kind}) does not match tier "${tier.id}" (${tier.kind}).`)
  }

  if (tier.kind === 'risk_read' && answer.kind === 'risk_read') {
    return { kind: 'risk_read', tierId: tier.id, result: evaluateRiskReadTierResult(tier, answer) }
  }
  if (tier.kind === 'sizing' && answer.kind === 'sizing') {
    return { kind: 'sizing', tierId: tier.id, result: evaluateSizingTier(tier, answer) }
  }
  if (tier.kind === 'instrument' && answer.kind === 'instrument') {
    return { kind: 'instrument', tierId: tier.id, result: evaluateInstrumentTier(tier, answer) }
  }
  throw new CaseStudyTierMismatchError(`Unhandled tier kind for tier "${tier.id}".`)
}
