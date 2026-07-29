import type { GainClassification, TaxRateSet, TaxTradeInput } from '../../../shared/types.js'
import { isLongTerm } from './holdingPeriod.js'

/**
 * Detects intraday/F&O and refuses to ever return an equity_delivery_short
 * or equity_delivery_long classification for them - this is the
 * highest-value correction the module makes. Only equity_delivery trades
 * go through the holding-period test at all; intraday and F&O are
 * business income regardless of how long the position was open.
 */
export function classifyTrade(trade: TaxTradeInput, rateSet: TaxRateSet): GainClassification {
  if (trade.tradeType === 'equity_intraday') return 'intraday'
  if (trade.tradeType === 'fno') return 'fno'

  const cutoffMonths = rateSet.holdingPeriod.listedEquityLongTermCutoffMonths
  return isLongTerm(trade.buyDate, trade.sellDate, cutoffMonths) ? 'equity_delivery_long' : 'equity_delivery_short'
}
