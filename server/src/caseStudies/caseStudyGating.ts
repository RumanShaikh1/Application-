import type {
  CaseStudy,
  CaseStudyFactPublic,
  CaseStudyPublic,
  CaseStudyTier,
  CaseStudyTierPublic,
  DifficultyLevel,
  PublicSelectOption,
  SelectOption
} from '../../../shared/types.js'

/** Beginner -> tier 1 only, intermediate -> tiers 1-2, advanced -> tiers 1-3 - capped by however many tiers the case actually has (see shared/types.ts's CaseStudy comment). A fixed engine rule, not per-case data. */
export const CASE_STUDY_LEVEL_TIER_CAP: Record<DifficultyLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3
}

/** How many withheld facts intermediate may reveal via look-up. Not server-enforced as a session counter (no accounts/DB - CLAUDE.md scope), since spending a look-up never affects grading integrity the way the max-loss gate does; the UI is expected to cap it at this count. */
export const CASE_STUDY_LOOKUP_LIMIT = 1

function stripCorrectness(options: SelectOption[]): PublicSelectOption[] {
  return options.map(({ id, label }) => ({ id, label }))
}

function resolveFacts(caseStudy: CaseStudy, level: DifficultyLevel): CaseStudyFactPublic[] {
  const variant = caseStudy.variants[level]
  const visible = new Set(variant.visibleFactIds)
  const lookup = new Set(variant.lookupFactIds)

  const facts: CaseStudyFactPublic[] = []
  for (const fact of caseStudy.facts) {
    if (visible.has(fact.id)) {
      facts.push({ ...fact, revealableViaLookup: false })
    } else if (lookup.has(fact.id)) {
      // Withheld until specifically looked up - detail is never sent up
      // front, the same discipline as identity masking: a real answer key
      // (here, the fact itself) doesn't belong in a payload the network tab
      // can already read.
      facts.push({ id: fact.id, label: fact.label, detail: '', revealableViaLookup: true })
    }
    // Neither visible nor lookup-eligible at this level: fully withheld, not included at all.
  }

  const redHerringIds = new Set(variant.redHerringFactIds)
  for (const fact of caseStudy.redHerringFacts) {
    if (redHerringIds.has(fact.id)) facts.push({ ...fact, revealableViaLookup: false })
  }

  return facts
}

function toPublicTier(tier: CaseStudyTier): CaseStudyTierPublic {
  if (tier.kind === 'risk_read') {
    return {
      kind: 'risk_read',
      id: tier.id,
      block: {
        question: tier.block.question,
        readOptions: stripCorrectness(tier.block.readOptions),
        factorQuestion: tier.block.factorQuestion,
        factorOptions: stripCorrectness(tier.block.factorOptions)
      }
    }
  }
  if (tier.kind === 'sizing') {
    return {
      kind: 'sizing',
      id: tier.id,
      prompt: tier.prompt,
      buckets: tier.buckets,
      reasonQuestion: tier.reasonQuestion,
      reasonOptions: stripCorrectness(tier.reasonOptions)
    }
  }
  return {
    kind: 'instrument',
    id: tier.id,
    maxLossQuestion: tier.maxLossQuestion,
    maxLossOptions: stripCorrectness(tier.maxLossOptions),
    instrumentQuestion: tier.instrumentQuestion,
    instrumentOptions: stripCorrectness(tier.instrumentOptions),
    exitQuestion: tier.exitQuestion,
    exitOptions: stripCorrectness(tier.exitOptions)
  }
}

/**
 * Never send `correct`, the real identity, or a withheld fact's detail to
 * the client before grading/look-up - the same reasoning as
 * getPlacementPayload and ScenarioStagePayload. `identity` never appears
 * anywhere in this return value, at any level - that's the integrity
 * guarantee the case-study feature exists to protect (see CLAUDE.md).
 */
export function getCaseStudyPayload(caseStudy: CaseStudy, level: DifficultyLevel): CaseStudyPublic {
  const tierCount = Math.min(caseStudy.tiers.length, CASE_STUDY_LEVEL_TIER_CAP[level])
  return {
    id: caseStudy.id,
    title: caseStudy.title,
    maskedContext: caseStudy.maskedContext,
    level,
    facts: resolveFacts(caseStudy, level),
    tiers: caseStudy.tiers.slice(0, tierCount).map(toPublicTier)
  }
}

/** Serves one previously-withheld fact's real detail on demand - the look-up mechanic. Returns undefined if the fact doesn't exist or isn't look-up-eligible at this level, so a client can't use this to read facts that are supposed to be fully withheld (e.g. at advanced). */
export function revealCaseStudyFact(caseStudy: CaseStudy, level: DifficultyLevel, factId: string): { id: string; label: string; detail: string } | undefined {
  const variant = caseStudy.variants[level]
  if (!variant.lookupFactIds.includes(factId)) return undefined
  const fact = caseStudy.facts.find((candidate) => candidate.id === factId)
  return fact ? { id: fact.id, label: fact.label, detail: fact.detail } : undefined
}
