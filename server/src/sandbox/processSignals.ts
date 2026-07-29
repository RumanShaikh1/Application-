import type { DiversificationSummary, PositionSizeCheck, SandboxDailyClose, SandboxProcessSignal, SandboxTrade, TradeSide } from '../../../shared/types.js'

// Illustrative thresholds for this one educational window, not tuned risk
// limits - consistent with portfolioEngine.ts's own SINGLE_POSITION/SECTOR
// guideline philosophy (a reflection, never a block).
const OVERTRADING_WINDOW_DAYS = 20
const OVERTRADING_THRESHOLD = 5
const RUN_UP_LOOKBACK_DAYS = 10
const RUN_UP_THRESHOLD_PERCENT = 15

/** Fires on the trade that CROSSES the guideline, using only the just-computed post-trade checks - never a price/outcome field. */
export function detectConcentrationSignals(positionSizeCheck: PositionSizeCheck, diversification: DiversificationSummary): SandboxProcessSignal[] {
  const signals: SandboxProcessSignal[] = []

  if (!positionSizeCheck.withinGuideline) {
    signals.push({
      kind: 'position_concentration',
      tone: 'nudge',
      message: `${positionSizeCheck.symbol} is now ${positionSizeCheck.percentOfPortfolio.toFixed(1)}% of your portfolio - above the 25% guideline. Sure?`
    })
  }

  if (diversification.concentratedSectorWarning && diversification.sectorAllocations.length > 0) {
    const worst = diversification.sectorAllocations.reduce((max, allocation) => (allocation.percentOfPortfolio > max.percentOfPortfolio ? allocation : max))
    signals.push({
      kind: 'sector_concentration',
      tone: 'nudge',
      message: `${worst.sector} is now ${worst.percentOfPortfolio.toFixed(1)}% of your portfolio - above the 40% guideline.`
    })
  }

  return signals
}

/** Compares the SAME checks before vs. after this one trade - celebrates crossing back into guideline, never mentions price or P&L. */
export function detectImprovementSignals(
  before: { positionSizeCheck: PositionSizeCheck; diversification: DiversificationSummary },
  after: { positionSizeCheck: PositionSizeCheck; diversification: DiversificationSummary },
  side: TradeSide
): SandboxProcessSignal[] {
  const signals: SandboxProcessSignal[] = []

  if (side === 'sell' && !before.positionSizeCheck.withinGuideline && after.positionSizeCheck.withinGuideline) {
    signals.push({
      kind: 'trimmed_winner',
      tone: 'celebrate',
      message: `You brought ${after.positionSizeCheck.symbol} back within the position-size guideline - that's exactly the discipline that protects a portfolio, regardless of how the position goes from here.`
    })
  }

  if (before.diversification.concentratedSectorWarning && !after.diversification.concentratedSectorWarning) {
    signals.push({
      kind: 'diversification_improved',
      tone: 'celebrate',
      message: 'Unlocked: better diversified - no sector is over the concentration guideline anymore.'
    })
  }

  return signals
}

/**
 * Only ever reads closes at `day` and `day - lookback` - never a point past
 * `day`, so this can never see what the stock does after the trade being
 * evaluated (no lookahead, see CLAUDE.md's Sandbox invariants).
 */
export function detectRunUpChasing(side: TradeSide, symbol: string, day: number, series: SandboxDailyClose[]): SandboxProcessSignal | null {
  if (side !== 'buy') return null

  const lookbackDay = Math.max(day - RUN_UP_LOOKBACK_DAYS, 0)
  const currentClose = series.find((point) => point.day === day)?.close
  const pastClose = series.find((point) => point.day === lookbackDay)?.close
  if (currentClose == null || pastClose == null || pastClose <= 0) return null

  const percentChange = ((currentClose - pastClose) / pastClose) * 100
  if (percentChange < RUN_UP_THRESHOLD_PERCENT) return null

  return {
    kind: 'run_up_chasing',
    tone: 'nudge',
    message: `${symbol} is up ${percentChange.toFixed(1)}% over the last ${RUN_UP_LOOKBACK_DAYS} trading days - worth asking whether this buy is based on something you've checked, or the recent move itself.`
  }
}

/** `tradeLog` is the trade history BEFORE this trade - only past trades, so this never anticipates the trade currently being placed. */
export function detectOvertrading(tradeLog: SandboxTrade[], day: number): SandboxProcessSignal | null {
  const recentCount = tradeLog.filter((trade) => trade.day > day - OVERTRADING_WINDOW_DAYS && trade.day <= day).length + 1
  if (recentCount <= OVERTRADING_THRESHOLD) return null

  return {
    kind: 'overtrading',
    tone: 'nudge',
    message: `That's ${recentCount} trades in the last ${OVERTRADING_WINDOW_DAYS} trading days - a lot of activity for a single window like this one.`
  }
}
