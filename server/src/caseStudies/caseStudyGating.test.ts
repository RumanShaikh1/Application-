import { describe, expect, it } from 'vitest'
import { CASE_STUDY_LEVEL_TIER_CAP, getCaseStudyPayload, revealCaseStudyFact } from './caseStudyGating.js'
import { findCaseStudy, listCaseStudies } from './loadCaseStudies.js'
import type { DifficultyLevel } from '../../../shared/types.js'

const LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced']

describe('getCaseStudyPayload - identity masking', () => {
  it('never includes the `identity` field, at any level', () => {
    for (const caseStudy of listCaseStudies()) {
      for (const level of LEVELS) {
        const payload = getCaseStudyPayload(caseStudy, level)
        expect('identity' in payload).toBe(false)
      }
    }
  })

  it('the real company name and real dates never appear anywhere in the serialized payload, at any level - the integrity guarantee', () => {
    for (const caseStudy of listCaseStudies()) {
      for (const level of LEVELS) {
        const raw = JSON.stringify(getCaseStudyPayload(caseStudy, level))
        expect(raw).not.toContain(caseStudy.identity.companyName)
        expect(raw).not.toContain(caseStudy.identity.realDates)
        expect(raw).not.toContain(caseStudy.identity.whatActuallyHappened)
      }
    }
  })

  it('never leaks which option is correct - the answer key never appears in the served payload', () => {
    for (const caseStudy of listCaseStudies()) {
      for (const level of LEVELS) {
        const raw = JSON.stringify(getCaseStudyPayload(caseStudy, level))
        expect(raw).not.toContain('"correct"')
      }
    }
  })

  it("a withheld-but-lookup-eligible fact's real detail is never present in the initial payload - only the label is", () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    const payload = getCaseStudyPayload(caseStudy, 'intermediate')
    const lookupFacts = payload.facts.filter((fact) => fact.revealableViaLookup)
    expect(lookupFacts.length).toBeGreaterThan(0)
    for (const fact of lookupFacts) {
      expect(fact.detail).toBe('')
    }
  })
})

describe('getCaseStudyPayload - variant resolution (masking + tier gating)', () => {
  it('beginner sees every authored fact and only tier 1', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    const payload = getCaseStudyPayload(caseStudy, 'beginner')

    expect(payload.tiers).toHaveLength(1)
    expect(payload.tiers[0].kind).toBe('risk_read')
    expect(payload.facts.map((f) => f.id).sort()).toEqual(caseStudy.facts.map((f) => f.id).sort())
    expect(payload.facts.every((f) => !f.revealableViaLookup)).toBe(true)
  })

  it('intermediate sees tiers 1-2, one volunteered fact, and the rest as lookup-eligible teasers - no red herrings', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    const payload = getCaseStudyPayload(caseStudy, 'intermediate')

    expect(payload.tiers.map((t) => t.kind)).toEqual(['risk_read', 'sizing'])
    const volunteered = payload.facts.filter((f) => !f.revealableViaLookup)
    const lookup = payload.facts.filter((f) => f.revealableViaLookup)
    expect(volunteered).toHaveLength(1)
    expect(lookup.length).toBeGreaterThanOrEqual(1)
    expect(lookup.length).toBeLessThanOrEqual(2)
  })

  it('advanced sees all 3 tiers, volunteers little, and layers in red herrings instead', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    const payload = getCaseStudyPayload(caseStudy, 'advanced')

    expect(payload.tiers.map((t) => t.kind)).toEqual(['risk_read', 'sizing', 'instrument'])
    expect(payload.facts.every((f) => !f.revealableViaLookup)).toBe(true)
    const advancedFactIds = new Set(payload.facts.map((f) => f.id))
    const genuineFactIds = new Set(caseStudy.facts.map((f) => f.id))
    // Nothing genuinely withheld should sneak in unlabeled as a red herring.
    for (const id of advancedFactIds) {
      expect(genuineFactIds.has(id)).toBe(false)
    }
    expect(payload.facts.length).toBeGreaterThan(0)
  })

  it('the option-breadth tier (instrument, with shorting) is reachable only at advanced, by construction of the tier cap', () => {
    expect(CASE_STUDY_LEVEL_TIER_CAP.beginner).toBe(1)
    expect(CASE_STUDY_LEVEL_TIER_CAP.intermediate).toBe(2)
    expect(CASE_STUDY_LEVEL_TIER_CAP.advanced).toBe(3)
  })
})

describe('getCaseStudyPayload - a case with no tier 3 handles every level cleanly', () => {
  it('a 2-tier fixture never renders a phantom tier 3, even at advanced', () => {
    const caseStudy = findCaseStudy('bank-fraud-disclosure-01')
    if (!caseStudy) throw new Error('fixture not found')
    expect(caseStudy.tiers).toHaveLength(2)

    for (const level of LEVELS) {
      const payload = getCaseStudyPayload(caseStudy, level)
      expect(payload.tiers.length).toBeLessThanOrEqual(2)
      expect(payload.tiers.every((tier) => tier.kind !== 'instrument')).toBe(true)
    }

    const advancedPayload = getCaseStudyPayload(caseStudy, 'advanced')
    expect(advancedPayload.tiers).toHaveLength(2)
  })
})

describe('revealCaseStudyFact - the limited look-up mechanic', () => {
  it('reveals the real detail for a fact that is lookup-eligible at this level', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    const variant = caseStudy.variants.intermediate
    const lookupId = variant.lookupFactIds[0]
    const revealed = revealCaseStudyFact(caseStudy, 'intermediate', lookupId)
    const original = caseStudy.facts.find((f) => f.id === lookupId)!
    expect(revealed).toEqual({ id: original.id, label: original.label, detail: original.detail })
  })

  it('refuses to reveal a fact that is fully withheld (not lookup-eligible) at this level', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    // Advanced has zero lookup-eligible facts by design - no id should ever resolve.
    for (const fact of caseStudy.facts) {
      expect(revealCaseStudyFact(caseStudy, 'advanced', fact.id)).toBeUndefined()
    }
  })

  it('returns undefined for a fact id that does not exist on the case at all', () => {
    const caseStudy = findCaseStudy('related-party-buyout-01')
    if (!caseStudy) throw new Error('fixture not found')
    expect(revealCaseStudyFact(caseStudy, 'intermediate', 'not-a-real-fact-id')).toBeUndefined()
  })
})

describe('getCaseStudyPayload - against every real shipped fixture', () => {
  it('every fixture opens with a risk_read tier and has all three variants', () => {
    const caseStudies = listCaseStudies()
    expect(caseStudies.length).toBeGreaterThanOrEqual(2)
    for (const caseStudy of caseStudies) {
      expect(caseStudy.tiers[0]?.kind).toBe('risk_read')
      for (const level of LEVELS) {
        expect(caseStudy.variants[level]).toBeDefined()
      }
    }
  })
})
