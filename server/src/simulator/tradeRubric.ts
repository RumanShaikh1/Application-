import type { RubricCriterion } from '../../../shared/types.js'

/**
 * A single generic rubric applied to every trade - unlike Decision
 * Replay, there's no per-scenario authoring here since a trade can be on
 * any real symbol. `position_sizing` and `diversification` are never sent
 * to Gemini - they're computed deterministically by portfolioEngine.ts and
 * slotted in as already-scored criteria (see index.ts). Only
 * `rationale_grounded` and `cost_awareness` are classified from the user's
 * free text, in evaluateTradeRationale.ts.
 */
export const TRADE_RUBRIC: RubricCriterion[] = [
  { id: 'position_sizing', description: 'Position size is proportionate - no single holding dominates the portfolio.', weight: 30 },
  {
    id: 'diversification',
    description: 'The trade maintains or improves diversification across sectors rather than concentrating further.',
    weight: 25
  },
  {
    id: 'rationale_grounded',
    description: 'The stated rationale is grounded in a specific, checkable reason (fundamentals, a catalyst, a valuation view) rather than hype, a tip, or FOMO.',
    weight: 25
  },
  {
    id: 'cost_awareness',
    description: 'The rationale or trade size reflects awareness that trading has real costs, not just potential upside.',
    weight: 20
  }
]

export const GEMINI_GRADED_CRITERION_IDS = ['rationale_grounded', 'cost_awareness'] as const
