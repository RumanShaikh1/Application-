import type { TaxRateSet, TaxTradeInput } from '../../../shared/types.js'
import { computeTax } from './computeTax.js'

export interface BreakevenResult {
  /** The sell price at which holding nets exactly what selling today nets. */
  breakevenSellPrice: number
  /** currentPrice - breakevenSellPrice. Positive means the price must fall by this much before waiting stops being worth it. */
  breakevenMoveRupees: number
  breakevenMovePercent: number
  /** False if waiting already nets less than selling today even with no price move at all - see the early-return case below. */
  worthWaitingAtCurrentPrice: boolean
}

/**
 * Pure. The counterweight to the days-to-long-term counter: "how far would
 * the price have to fall before the LTCG tax saving from waiting is wiped
 * out by that fall?" Deliberately not a closed-form formula - net proceeds
 * has a kink at the exemption threshold - so this does bisection over the
 * deterministic engine itself rather than re-deriving the tax math. See
 * computeTax.ts for why the search is safe: net proceeds is monotonically
 * non-decreasing in sell price for any fixed classification (gross gain
 * scales 1:1 with sell price; tax removes less than the full rate; charges
 * that scale with sell price are a few basis points, not enough to reverse
 * that).
 */
export function computeBreakevenMove(todayTrade: TaxTradeInput, todayRateSet: TaxRateSet, holdTrade: TaxTradeInput, holdRateSet: TaxRateSet): BreakevenResult {
  const currentPrice = todayTrade.sellPrice
  const todayResult = computeTax(todayTrade, todayRateSet)
  const targetNetProceeds = todayResult.netProceeds ?? 0

  const netProceedsAtHoldPrice = (sellPrice: number): number =>
    computeTax({ ...holdTrade, sellPrice }, holdRateSet).netProceeds ?? 0

  const atCurrentPrice = netProceedsAtHoldPrice(currentPrice)
  if (atCurrentPrice <= targetNetProceeds) {
    // Charges/tax on the hold leg already outweigh the saving with zero
    // price movement at all - there's no price fall left to "use up".
    return { breakevenSellPrice: currentPrice, breakevenMoveRupees: 0, breakevenMovePercent: 0, worthWaitingAtCurrentPrice: false }
  }

  let low = 0
  let high = currentPrice
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    if (netProceedsAtHoldPrice(mid) < targetNetProceeds) {
      low = mid
    } else {
      high = mid
    }
  }

  const breakevenSellPrice = high
  const breakevenMoveRupees = currentPrice - breakevenSellPrice
  const breakevenMovePercent = currentPrice > 0 ? (breakevenMoveRupees / currentPrice) * 100 : 0

  return { breakevenSellPrice, breakevenMoveRupees, breakevenMovePercent, worthWaitingAtCurrentPrice: true }
}
