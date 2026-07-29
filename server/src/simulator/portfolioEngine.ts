import type { DiversificationSummary, Portfolio, PortfolioValuation, PositionSizeCheck, TradeCostBreakdown, TradeSide } from '../../../shared/types.js'

// Illustrative beginner-education guidelines, not risk controls - a trade
// always executes if cash/holdings allow it. The point is honest feedback
// on the consequences of a choice, same philosophy as Decision Replay never
// blocking a "poor" choice.
const SINGLE_POSITION_GUIDELINE_PERCENT = 25
const SECTOR_CONCENTRATION_GUIDELINE_PERCENT = 40

export function canAffordBuy(portfolio: Portfolio, cost: TradeCostBreakdown): boolean {
  return portfolio.cashBalance + cost.netCashImpact >= 0
}

export function hasSufficientHolding(portfolio: Portfolio, symbol: string, quantity: number): boolean {
  const holding = portfolio.holdings.find((h) => h.symbol === symbol)
  return Boolean(holding) && holding!.quantity >= quantity
}

/**
 * Assumes the caller already validated affordability/holding via
 * canAffordBuy/hasSufficientHolding (the route does, before ever reaching
 * here) - this still throws rather than silently corrupting state if
 * called with a sell that isn't actually coverable, since a silent
 * mismatch between held and reported quantity would be a much worse bug
 * than a loud one.
 */
export function applyTrade(portfolio: Portfolio, symbol: string, side: TradeSide, quantity: number, cost: TradeCostBreakdown): Portfolio {
  const holdings = portfolio.holdings.map((holding) => ({ ...holding }))
  const index = holdings.findIndex((holding) => holding.symbol === symbol)

  if (side === 'buy') {
    const costBasisAdded = -cost.netCashImpact
    if (index >= 0) {
      const existing = holdings[index]
      const newQuantity = existing.quantity + quantity
      holdings[index] = {
        symbol,
        quantity: newQuantity,
        averageCost: (existing.averageCost * existing.quantity + costBasisAdded) / newQuantity
      }
    } else {
      holdings.push({ symbol, quantity, averageCost: costBasisAdded / quantity })
    }
    return { cashBalance: portfolio.cashBalance + cost.netCashImpact, holdings }
  }

  if (index < 0 || holdings[index].quantity < quantity) {
    throw new Error(`Cannot sell ${quantity} shares of ${symbol}: not enough held.`)
  }
  const existing = holdings[index]
  const remaining = existing.quantity - quantity
  const nextHoldings =
    remaining === 0 ? holdings.filter((_, i) => i !== index) : holdings.map((holding, i) => (i === index ? { ...holding, quantity: remaining } : holding))

  return { cashBalance: portfolio.cashBalance + cost.netCashImpact, holdings: nextHoldings }
}

export function valuePortfolio(portfolio: Portfolio, prices: Record<string, number>): PortfolioValuation {
  const rawPositions = portfolio.holdings.map((holding) => {
    const currentPrice = prices[holding.symbol] ?? holding.averageCost
    const marketValue = currentPrice * holding.quantity
    const unrealizedPnLPercent = holding.averageCost > 0 ? ((currentPrice - holding.averageCost) / holding.averageCost) * 100 : 0
    return { symbol: holding.symbol, quantity: holding.quantity, averageCost: holding.averageCost, currentPrice, marketValue, unrealizedPnLPercent }
  })

  const holdingsValue = rawPositions.reduce((sum, position) => sum + position.marketValue, 0)
  const totalValue = portfolio.cashBalance + holdingsValue

  const positions = rawPositions.map((position) => ({
    ...position,
    percentOfPortfolio: totalValue > 0 ? (position.marketValue / totalValue) * 100 : 0
  }))

  return { cashBalance: portfolio.cashBalance, holdingsValue, totalValue, positions }
}

export function checkPositionSize(portfolio: Portfolio, prices: Record<string, number>, symbol: string): PositionSizeCheck {
  const valuation = valuePortfolio(portfolio, prices)
  const percentOfPortfolio = valuation.positions.find((position) => position.symbol === symbol)?.percentOfPortfolio ?? 0
  return { symbol, percentOfPortfolio, withinGuideline: percentOfPortfolio <= SINGLE_POSITION_GUIDELINE_PERCENT }
}

export function checkDiversification(portfolio: Portfolio, prices: Record<string, number>, sectors: Record<string, string | null>): DiversificationSummary {
  const valuation = valuePortfolio(portfolio, prices)
  const bySector = new Map<string, number>()

  for (const position of valuation.positions) {
    const sector = sectors[position.symbol] ?? 'Unknown'
    bySector.set(sector, (bySector.get(sector) ?? 0) + position.percentOfPortfolio)
  }

  const sectorAllocations = Array.from(bySector.entries()).map(([sector, percentOfPortfolio]) => ({ sector, percentOfPortfolio }))
  const concentratedSectorWarning = sectorAllocations.some((allocation) => allocation.percentOfPortfolio > SECTOR_CONCENTRATION_GUIDELINE_PERCENT)

  return { sectorAllocations, concentratedSectorWarning }
}
