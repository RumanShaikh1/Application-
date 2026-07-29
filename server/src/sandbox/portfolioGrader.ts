import type { PortfolioGradeDimension, PortfolioGradeDimensionResult, PortfolioGradeLevel, PortfolioGradeReport, SandboxTrade } from '../../../shared/types.js'

/**
 * The window's sharpest drawdown, for the crash_discipline dimension - see
 * server/data/sandbox/prices.json's description. Authored against this one
 * specific fixture (every one of the 20 names troughs within a few trading
 * days of day 56) rather than computed generically - revisit if/when a
 * second price window ships with a different shape.
 */
export const COVID_CRASH_WINDOW = { startDay: 40, endDay: 70 }

const LEVEL_SCORE: Record<PortfolioGradeLevel, number> = { strong: 100, sound: 65, needs_attention: 30 }

const SOUND_THESIS_TAGS = new Set(['fits_mission_goal', 'looks_cheap'])
const SPECULATIVE_THESIS_TAGS = new Set(['trending_up', 'heard_about_it'])

// Trades per 100 trading days above this suggests turnover well beyond
// "hold through a year-long window and make a handful of deliberate calls" -
// illustrative for this mode, not a real brokerage limit.
const OVERTRADING_TRADES_PER_100_DAYS = 8
// Same window processSignals.ts's detectOvertrading uses - see gradeTradingFrequency.
const MIN_DAYS_FOR_FREQUENCY_RATE = 20

function gradeDiversification(trades: SandboxTrade[]): PortfolioGradeDimensionResult {
  if (trades.length === 0) {
    return { dimension: 'diversification', level: 'sound', explanation: 'No trades placed yet - nothing to assess.' }
  }
  const flagged = trades.filter((trade) => trade.diversification.concentratedSectorWarning).length
  const ratio = flagged / trades.length
  const level: PortfolioGradeLevel = flagged === 0 ? 'strong' : ratio <= 0.25 ? 'sound' : 'needs_attention'
  const explanation =
    flagged === 0
      ? `No single sector exceeded the concentration guideline at any of your ${trades.length} trades.`
      : `Sector concentration was above the guideline at ${flagged} of your ${trades.length} trades.`
  return { dimension: 'diversification', level, explanation }
}

function gradePositionSizing(trades: SandboxTrade[]): PortfolioGradeDimensionResult {
  if (trades.length === 0) {
    return { dimension: 'position_sizing', level: 'sound', explanation: 'No trades placed yet - nothing to assess.' }
  }
  const breaches = trades.filter((trade) => !trade.positionSizeCheck.withinGuideline)
  const ratio = breaches.length / trades.length
  const level: PortfolioGradeLevel = breaches.length === 0 ? 'strong' : ratio <= 0.25 ? 'sound' : 'needs_attention'
  const worst = breaches.reduce<number>((max, trade) => Math.max(max, trade.positionSizeCheck.percentOfPortfolio), 0)
  const explanation =
    breaches.length === 0
      ? `Your single-position size stayed within the guideline at all ${trades.length} of your trades.`
      : `Your single-position size exceeded the guideline at ${breaches.length} of your ${trades.length} trades (largest: ${worst.toFixed(1)}% of the portfolio in one name).`
  return { dimension: 'position_sizing', level, explanation }
}

/**
 * Deliberately does NOT look at whether a sell was at a gain or a loss -
 * that would be reading the outcome. It only looks at WHEN a sell happened
 * relative to this window's sharpest drawdown - a pattern worth surfacing
 * for reflection, never a verdict (CLAUDE.md: the decision is the user's).
 */
function gradeCrashDiscipline(trades: SandboxTrade[]): PortfolioGradeDimensionResult {
  const sells = trades.filter((trade) => trade.side === 'sell')
  if (sells.length === 0) {
    return { dimension: 'crash_discipline', level: 'sound', explanation: "You haven't sold anything yet, so there's nothing to assess here." }
  }
  const sellsInCrashWindow = sells.filter((trade) => trade.day >= COVID_CRASH_WINDOW.startDay && trade.day <= COVID_CRASH_WINDOW.endDay)
  const level: PortfolioGradeLevel = sellsInCrashWindow.length === 0 ? 'strong' : 'needs_attention'
  const explanation =
    sellsInCrashWindow.length === 0
      ? `None of your ${sells.length} sells fell within this window's sharpest drawdown (days ${COVID_CRASH_WINDOW.startDay}-${COVID_CRASH_WINDOW.endDay}).`
      : `${sellsInCrashWindow.length} of your ${sells.length} sells happened during this window's sharpest drawdown (days ${COVID_CRASH_WINDOW.startDay}-${COVID_CRASH_WINDOW.endDay}). That's not automatically wrong - but it's worth asking yourself whether each of those decisions was driven by a real change in the business, or by the recent price move alone.`
  return { dimension: 'crash_discipline', level, explanation }
}

function gradeThesisConsistency(trades: SandboxTrade[]): PortfolioGradeDimensionResult {
  const buys = trades.filter((trade) => trade.side === 'buy')
  if (buys.length === 0) {
    return { dimension: 'thesis_consistency', level: 'sound', explanation: "You haven't bought anything yet, so there's nothing to assess here." }
  }
  const speculative = buys.filter((trade) => SPECULATIVE_THESIS_TAGS.has(trade.thesisTag)).length
  const sound = buys.filter((trade) => SOUND_THESIS_TAGS.has(trade.thesisTag)).length
  const ratio = sound / buys.length
  const level: PortfolioGradeLevel = ratio >= 0.75 ? 'strong' : ratio >= 0.4 ? 'sound' : 'needs_attention'
  const explanation = `${sound} of your ${buys.length} buys were tagged with a reasoning-grounded thesis (fits your mission's goal, or a valuation view); ${speculative} were tagged as following a price move or something you heard.`
  return { dimension: 'thesis_consistency', level, explanation }
}

function gradeTradingFrequency(trades: SandboxTrade[], asOfDay: number): PortfolioGradeDimensionResult {
  if (trades.length === 0) {
    return { dimension: 'trading_frequency', level: 'sound', explanation: 'No trades placed yet - nothing to assess.' }
  }
  // A rate needs some elapsed time to mean anything - dividing by a tiny
  // asOfDay (e.g. one trade on day 0) would otherwise extrapolate a single
  // early trade into a wildly overstated "pace" and falsely read as
  // overtrading. Floor at the same 20-day window the per-trade overtrading
  // signal already uses, so a normal handful of early trades never trips this.
  const tradesPer100Days = (trades.length / Math.max(asOfDay, MIN_DAYS_FOR_FREQUENCY_RATE)) * 100
  const level: PortfolioGradeLevel = tradesPer100Days <= OVERTRADING_TRADES_PER_100_DAYS ? 'strong' : tradesPer100Days <= OVERTRADING_TRADES_PER_100_DAYS * 1.5 ? 'sound' : 'needs_attention'
  const explanation = `You've placed ${trades.length} trades over ${asOfDay} trading days (about ${tradesPer100Days.toFixed(1)} per 100 days).`
  return { dimension: 'trading_frequency', level, explanation }
}

export interface PortfolioGraderInput {
  missionId: string
  asOfDay: number
  trades: SandboxTrade[]
}

/**
 * Pure and deterministic - no API call, and structurally incapable of
 * reading realized/unrealized P&L or any price after the trade day being
 * evaluated: the only per-trade fields ever read are day, side, thesisTag,
 * and the position-size/diversification snapshots already computed AT that
 * trade's time (see SandboxTrade). `trade.price` and `trade.costBreakdown`
 * are never referenced by any dimension - see portfolioGrader.test.ts's
 * dedicated proof.
 */
export function gradePortfolio({ missionId, asOfDay, trades }: PortfolioGraderInput): PortfolioGradeReport {
  const dimensions: PortfolioGradeDimensionResult[] = [
    gradeDiversification(trades),
    gradePositionSizing(trades),
    gradeCrashDiscipline(trades),
    gradeThesisConsistency(trades),
    gradeTradingFrequency(trades, asOfDay)
  ]

  const processScore = Math.round(dimensions.reduce((sum, dimension) => sum + LEVEL_SCORE[dimension.level], 0) / dimensions.length)

  const needsAttention = dimensions.filter((dimension) => dimension.level === 'needs_attention')
  const summary =
    needsAttention.length === 0
      ? "Your process looks sound across every dimension this grader checks - sizing, diversification, how you handled the window's sharpest drawdown, the reasoning behind your buys, and trading frequency."
      : `Worth a look: ${needsAttention.map((dimension) => DIMENSION_LABEL[dimension.dimension]).join(', ')}. This reflects how you made decisions, not whether your portfolio's value went up or down.`

  return { missionId, asOfDay, dimensions, processScore, summary }
}

const DIMENSION_LABEL: Record<PortfolioGradeDimension, string> = {
  diversification: 'diversification',
  position_sizing: 'position sizing',
  crash_discipline: 'how you handled the sharpest drawdown',
  thesis_consistency: 'the reasoning behind your buys',
  trading_frequency: 'trading frequency'
}
