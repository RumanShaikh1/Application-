import { describe, expect, it } from 'vitest'
import { evaluateRationaleLocally, generateFeedback, matchAllCriteria, matchCriterion } from './matchRationale.js'
import { getScenario } from './loadScenarios.js'
import type { Rubric, RubricCriterion } from '../../../shared/types.js'

describe('matchCriterion - mechanics', () => {
  const criterion: RubricCriterion = {
    id: 'test_criterion',
    description: 'test',
    weight: 100,
    matchConcepts: [
      ['hype', 'buzz'],
      ['not a reason', 'on its own']
    ],
    minConceptsRequired: 2
  }

  it('matches case-insensitively', () => {
    expect(matchCriterion('There was a lot of HYPE but that is NOT A REASON to buy.', criterion).matched).toBe(true)
  })

  it('normalizes a hyphen to a space (two words) but a slash to nothing (one token, not two single letters)', () => {
    const c: RubricCriterion = { id: 'x', description: 'x', weight: 1, matchConcepts: [['p/e'], ['cash strain']], minConceptsRequired: 2 }
    const result = matchCriterion('The P/E is high and the business looks cash-strained.', c)
    expect(result.matched).toBe(true)
  })

  it("a short abbreviation keyword like 'p/e' doesn't turn into single-letter tokens that match almost any word", () => {
    // Regression test for a real false positive found in live testing: "P/E" normalizing to the two
    // single-character tokens "p" and "e" meant any rationale with a word starting with p (price) and a
    // word starting with e (even, earnings) satisfied the keyword, with no actual P/E mention at all.
    const c: RubricCriterion = { id: 'x', description: 'x', weight: 1, matchConcepts: [['p/e']], minConceptsRequired: 1 }
    expect(matchCriterion('The price keeps rising even though earnings are falling.', c).matched).toBe(false)
    expect(matchCriterion('The P/E ratio looks stretched here.', c).matched).toBe(true)
  })

  it('requires the configured number of distinct clusters, not just any hit', () => {
    expect(matchCriterion('There was a lot of hype around this.', criterion).matched).toBe(false)
    expect(matchCriterion('There was a lot of hype, but that is not a reason to buy.', criterion).matched).toBe(true)
  })

  it('defaults minConceptsRequired to "all clusters" when omitted', () => {
    const c: RubricCriterion = { id: 'x', description: 'x', weight: 1, matchConcepts: [['alpha'], ['beta']] }
    expect(matchCriterion('alpha only', c).matched).toBe(false)
    expect(matchCriterion('alpha and beta both', c).matched).toBe(true)
  })

  it('never claims a match for a criterion with no authored concepts', () => {
    const c: RubricCriterion = { id: 'x', description: 'x', weight: 1 }
    const result = matchCriterion('literally anything, even the exact criterion text', c)
    expect(result.matched).toBe(false)
    expect(result.evidence).toMatch(/not gradable locally/i)
  })

  it('partial stems catch morphological variants for free via substring matching', () => {
    const c: RubricCriterion = { id: 'x', description: 'x', weight: 1, matchConcepts: [['concentrat']], minConceptsRequired: 1 }
    expect(matchCriterion('This is a concentration issue.', c).matched).toBe(true)
    expect(matchCriterion('The position is too concentrated.', c).matched).toBe(true)
    expect(matchCriterion('I am concentrating on other things.', c).matched).toBe(true)
  })

  it("recognizes a synonym for a keyword - 'earnings' satisfies a keyword written as 'revenue'", () => {
    const c: RubricCriterion = { id: 'x', description: 'x', weight: 1, matchConcepts: [['revenue']], minConceptsRequired: 1 }
    expect(matchCriterion('Earnings are falling fast.', c).matched).toBe(true)
    expect(matchCriterion('Income has dropped sharply.', c).matched).toBe(true)
    expect(matchCriterion('Sales turnover is down.', c).matched).toBe(true)
  })

  it('a multi-word keyword matches regardless of the words being adjacent or in the authored order', () => {
    const c: RubricCriterion = { id: 'x', description: 'x', weight: 1, matchConcepts: [['revenue growth']], minConceptsRequired: 1 }
    // Authored order, adjacent - still works.
    expect(matchCriterion('Revenue growth has slowed.', c).matched).toBe(true)
    // Reversed order.
    expect(matchCriterion('Growth in revenue has slowed.', c).matched).toBe(true)
    // Not adjacent at all.
    expect(matchCriterion('Revenue has been the main driver of growth this year.', c).matched).toBe(true)
    // Synonym, not adjacent, reversed order.
    expect(matchCriterion('The growth in earnings was disappointing.', c).matched).toBe(true)
  })

  it("does not match a keyword's words scattered with no real overlap when synonyms genuinely differ", () => {
    const c: RubricCriterion = { id: 'x', description: 'x', weight: 1, matchConcepts: [['interest coverage']], minConceptsRequired: 1 }
    expect(matchCriterion('The company has no coverage of any kind and no interest in expanding.', c).matched).toBe(true)
    // (This is a known, accepted trade-off of bag-of-words matching - both words are present, even
    // though not in the financial sense intended. See matchRationale.ts's header comment.)
    expect(matchCriterion('The weather was nice today.', c).matched).toBe(false)
  })
})

describe('generateFeedback', () => {
  const rubric: Rubric = {
    soundChoiceIds: [],
    acceptableChoiceIds: [],
    factorOptions: [],
    idealSummary: '',
    criteria: [
      { id: 'a', description: 'A', weight: 40 },
      { id: 'b', description: 'B', weight: 35 },
      { id: 'c', description: 'C', weight: 25 }
    ]
  }

  it('reports full coverage when everything matched', () => {
    const matches = [
      { id: 'a', matched: true },
      { id: 'b', matched: true },
      { id: 'c', matched: true }
    ]
    expect(generateFeedback(rubric, matches)).toMatch(/covers every point/i)
  })

  it('reports zero coverage plainly, without pretending to grade anything', () => {
    const matches = [
      { id: 'a', matched: false },
      { id: 'b', matched: false },
      { id: 'c', matched: false }
    ]
    expect(generateFeedback(rubric, matches)).toMatch(/doesn't clearly touch/i)
  })

  it('reports a count for partial coverage', () => {
    const matches = [
      { id: 'a', matched: true },
      { id: 'b', matched: false },
      { id: 'c', matched: false }
    ]
    expect(generateFeedback(rubric, matches)).toMatch(/covers 1 of 3/i)
  })
})

// Realistic end-to-end rationale text against the real, shipped scenario
// fixtures - this is the actual thing being verified: do the hand-authored
// concept clusters in server/data/scenarios/*.json recognize a genuine
// attempt at sound reasoning, and correctly withhold credit from a shallow
// one, for every scenario currently shipped.
describe('evaluateRationaleLocally - realistic rationale against real scenario fixtures', () => {
  const cases: { scenarioId: string; good: string; poor: string }[] = [
    {
      scenarioId: 'chasing-runup-01',
      good: "Even as the price keeps rising, revenue growth and margins are deteriorating - that's a red flag. This looks like pure hype and social media buzz on forums, and a volume surge on its own isn't a reason to buy. The P/E is also way above the sector average and I don't see a fundamental reason for it, so it looks unjustified. I'll avoid this one.",
      poor: "This stock looks really strong right now, I think it'll keep going up so I'll buy some."
    },
    {
      scenarioId: 'value-trap-01',
      good: "This looks cheap on a low P/E and high dividend yield, but that might be a value trap rather than genuine value - the business seems to be in structural decline. Revenue has been declining for six consecutive quarters and circulation is shrinking, which matters more than just the valuation ratio. I'd also question whether the dividend is sustainable given how cash-strained the business looks - it might get cut.",
      poor: 'The dividend yield is really high so this looks like a good income stock to me.'
    },
    {
      scenarioId: 'concentration-risk-01',
      good: "The position has grown to a huge percentage of the portfolio - that's the real risk here, not a quality problem with the company. I still have conviction in the company, but that doesn't remove the need to manage position size regardless. The record quarter headline is not a reason to add more to an already oversized position, so I'll trim.",
      poor: 'This company had a great quarter so I will add more to my position.'
    },
    {
      scenarioId: 'survivorship-delisted-01',
      good: "This company is funding long-term loans with short-term borrowing that needs constant rollover - that mismatch is dangerous. The auditors flagged a going concern emphasis of matter about refinancing ability, which is a serious warning, not routine language. This isn't just the market overreacting to sector-wide worries - it's a genuine problem specific to this company. I'll sell the entire position.",
      poor: 'The whole sector is down so this is probably just a temporary overreaction, I will hold.'
    },
    {
      scenarioId: 'panic-selling-01',
      good: "This drop tracked a broad market-wide sell-off, not any company-specific news - nothing has actually changed about this business. Looking at its historical pullback-and-recovery pattern, this kind of drawdown isn't unusual for it. A sharp short-term price drop by itself isn't new information about the fundamentals, so I'll hold.",
      poor: 'The market dropped a lot this week so I am scared and want to sell everything.'
    },
    {
      scenarioId: 'disciplined-stoploss-01',
      good: "40% of revenue is at risk from losing this single customer - that's a major, concentrated hit. No replacement contract has been confirmed yet, and the cash runway is limited, so there isn't much room to absorb the gap. This is a genuine fundamental change to the business, not just sentiment or a market overreaction, so I'll sell the entire position.",
      poor: "The market is probably overreacting to this news, I'll wait it out."
    },
    {
      scenarioId: 'noise-headline-01',
      good: "This headline sounds alarming, but the actual quantified financial exposure is a tiny fraction of revenue - it's not material. The company also reaffirmed guidance and reported no impact to client contracts or the pipeline. The existence of a lawsuit by itself isn't a reason to change a long-term position, so I'll hold.",
      poor: 'That lawsuit headline sounds really bad, I think I should sell just in case.'
    },
    {
      scenarioId: 'derisking-winner-01',
      good: "This position has grown to a huge percentage of the portfolio purely through outperformance - nothing is wrong with the company, there's no red flag here at all. Trimming is portfolio-construction discipline, not a prediction that the stock will fall or a bet against it. Just because it's done well historically doesn't mean it has earned a permanently oversized allocation, so I'll trim.",
      poor: "It's my best idea and it keeps going up, so I'll keep adding to it."
    },
    {
      scenarioId: 'leverage-red-flag-01',
      good: 'Debt-to-equity has spiked sharply and interest coverage is falling, according to the filing - that is a real leverage problem. The expansion headline is exciting, but I should not let that override what the filing actually discloses about how it is being funded. A falling coverage ratio means a rate rise or a revenue miss could make it hard to service the debt, so I will sell the entire position.',
      poor: 'This expansion sounds really exciting so I will add more to my position.'
    }
  ]

  for (const { scenarioId, good, poor } of cases) {
    it(`${scenarioId}: a genuine, well-reasoned rationale matches every authored criterion`, () => {
      const scenario = getScenario(scenarioId)
      expect(scenario, `scenario "${scenarioId}" not found`).toBeDefined()
      const evaluation = evaluateRationaleLocally(scenario!.rubric, good)
      const unmatched = evaluation.criteriaMatches.filter((m) => !m.matched)
      expect(unmatched, `expected every criterion to match; unmatched: ${JSON.stringify(unmatched)}`).toHaveLength(0)
    })

    it(`${scenarioId}: a shallow, price-only rationale matches nothing`, () => {
      const scenario = getScenario(scenarioId)
      expect(scenario, `scenario "${scenarioId}" not found`).toBeDefined()
      const evaluation = evaluateRationaleLocally(scenario!.rubric, poor)
      const matched = evaluation.criteriaMatches.filter((m) => m.matched)
      expect(matched, `expected nothing to match; matched: ${JSON.stringify(matched)}`).toHaveLength(0)
    })
  }
})

describe('matchAllCriteria - every criterion in every shipped scenario has authored concepts', () => {
  it('no criterion is silently ungradable', () => {
    const ids = [
      'chasing-runup-01',
      'value-trap-01',
      'concentration-risk-01',
      'survivorship-delisted-01',
      'panic-selling-01',
      'disciplined-stoploss-01',
      'noise-headline-01',
      'derisking-winner-01',
      'leverage-red-flag-01'
    ]
    for (const id of ids) {
      const scenario = getScenario(id)
      expect(scenario, `scenario "${id}" not found`).toBeDefined()
      for (const criterion of scenario!.rubric.criteria) {
        expect(criterion.matchConcepts?.length, `criterion "${criterion.id}" in "${id}" has no matchConcepts`).toBeGreaterThan(0)
      }
    }
  })

  it('matchAllCriteria returns one result per rubric criterion, in order', () => {
    const scenario = getScenario('chasing-runup-01')!
    const results = matchAllCriteria('irrelevant text', scenario.rubric)
    expect(results.map((r) => r.id)).toEqual(scenario.rubric.criteria.map((c) => c.id))
  })
})
