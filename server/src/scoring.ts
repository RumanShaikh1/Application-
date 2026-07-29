/**
 * The shared scoring primitive behind every rubric-graded feature in this
 * app: given a set of weighted criteria and which ones matched, what
 * fraction of the available credit was earned. Decision Replay
 * (scenarios/rubricScoring.ts) combines this with a choice-quality half;
 * the trade simulator (simulator/tradeScoring.ts) uses it directly, since
 * there's no "choice list" for a live symbol - just the criteria.
 */
export function weightedCriteriaScore(criteria: { weight: number; matched: boolean }[]): number {
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0)
  if (totalWeight === 0) return 0
  const matchedWeight = criteria.filter((criterion) => criterion.matched).reduce((sum, criterion) => sum + criterion.weight, 0)
  return matchedWeight / totalWeight
}
