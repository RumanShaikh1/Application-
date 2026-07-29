import type { ChartPoint, ChartRange, NewsItem, StockProfile, StockStats } from '../../../shared/types.js'

/**
 * Source of live market data. Routes depend on this interface, never on a
 * concrete implementation, so the data source can be swapped (or mocked in
 * tests) without touching route code. Historical scenario data for Decision
 * Replay deliberately does NOT go through this interface - it's served from
 * local fixtures (see scenarios/loadScenarios.ts) so it stays reproducible
 * and independent of Yahoo's unofficial endpoints.
 */
export interface MarketDataProvider {
  getQuotes(symbols: string[]): Promise<StockStats[]>
  getProfile(symbol: string): Promise<StockProfile>
  getNews(symbol: string): Promise<NewsItem[]>
  getHistoricalPrices(symbol: string, range: ChartRange): Promise<ChartPoint[]>
}
