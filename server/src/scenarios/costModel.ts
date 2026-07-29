import type { CostBreakdown, TradeCostBreakdown, TradeSide } from '../../../shared/types.js'

// Illustrative approximations of Indian equity delivery-trading friction,
// not a tax calculator - current SEBI/NSE rates drift over time and aren't
// the point here. The point is the invariant this backs: never show a
// frictionless return figure. Every cost is charged on both the buy and
// sell leg (round trip).
const STT_RATE = 0.001 // ~0.1% Securities Transaction Tax, delivery trades
const EXCHANGE_FEE_RATE = 0.0000297 // ~0.00297% NSE transaction charges
const BROKERAGE_RATE = 0.0003 // ~0.03% discount-broker approximation
const SLIPPAGE_RATE = 0.0005 // ~0.05% gap between decision price and realistic fill price

export interface NetReturnInput {
  entryPrice: number
  exitPrice: number
  quantity: number
}

export function calculateNetReturn({ entryPrice, exitPrice, quantity }: NetReturnInput): CostBreakdown {
  if (entryPrice <= 0 || exitPrice < 0 || quantity <= 0) {
    return { grossReturnPercent: 0, brokerageCost: 0, sttCost: 0, exchangeFees: 0, slippageCost: 0, netReturnPercent: 0 }
  }

  const buyValue = entryPrice * quantity
  const sellValue = exitPrice * quantity
  const turnover = buyValue + sellValue

  const sttCost = turnover * STT_RATE
  const exchangeFees = turnover * EXCHANGE_FEE_RATE
  const brokerageCost = turnover * BROKERAGE_RATE
  const slippageCost = turnover * SLIPPAGE_RATE
  const totalCosts = sttCost + exchangeFees + brokerageCost + slippageCost

  const grossReturnPercent = ((sellValue - buyValue) / buyValue) * 100
  const netReturnPercent = ((sellValue - buyValue - totalCosts) / buyValue) * 100

  return { grossReturnPercent, brokerageCost, sttCost, exchangeFees, slippageCost, netReturnPercent }
}

export interface TradeCostInput {
  price: number
  quantity: number
  side: TradeSide
}

/**
 * Single-leg version of calculateNetReturn, for the trade simulator (which
 * prices one order at a time, not a round trip). Uses the exact same rate
 * constants above - composing a buy leg and a matching sell leg through
 * this function reproduces the same total costs calculateNetReturn would
 * give for that round trip, so there's one honest source of truth for
 * "what does a trade cost" across both features.
 */
export function calculateTradeCost({ price, quantity, side }: TradeCostInput): TradeCostBreakdown {
  if (price <= 0 || quantity <= 0) {
    return { grossValue: 0, brokerageCost: 0, sttCost: 0, exchangeFees: 0, slippageCost: 0, netCashImpact: 0 }
  }

  const grossValue = price * quantity
  const sttCost = grossValue * STT_RATE
  const exchangeFees = grossValue * EXCHANGE_FEE_RATE
  const brokerageCost = grossValue * BROKERAGE_RATE
  const slippageCost = grossValue * SLIPPAGE_RATE
  const totalCosts = sttCost + exchangeFees + brokerageCost + slippageCost

  // Buying costs cash beyond the sticker price; selling nets less than the
  // sticker price - costs always work against the trader, never for them.
  const netCashImpact = side === 'buy' ? -(grossValue + totalCosts) : grossValue - totalCosts

  return { grossValue, brokerageCost, sttCost, exchangeFees, slippageCost, netCashImpact }
}
