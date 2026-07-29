import type { ChartPoint, ChartRange, NewsItem, StockProfile, StockStats } from '../../../shared/types.js'
import { TtlCache } from '../cache.js'
import type { MarketDataProvider } from './MarketDataProvider.js'

const MINUTE_MS = 60_000

/**
 * Decorates any MarketDataProvider with per-method TTL caching, so repeated
 * requests for the same symbol within the TTL window don't re-hit Yahoo.
 * TTLs reflect how fast each kind of data actually changes: quotes move
 * constantly, profiles/fundamentals barely move, historical series never
 * change once a period has closed (1h is just to bound memory, not because
 * the data goes stale).
 */
export class CachingProvider implements MarketDataProvider {
  private readonly quotesCache = new TtlCache<StockStats[]>(MINUTE_MS)
  private readonly profileCache = new TtlCache<StockProfile>(15 * MINUTE_MS)
  private readonly newsCache = new TtlCache<NewsItem[]>(5 * MINUTE_MS)
  private readonly historicalCache = new TtlCache<ChartPoint[]>(60 * MINUTE_MS)

  constructor(private readonly source: MarketDataProvider) {}

  getQuotes(symbols: string[]): Promise<StockStats[]> {
    const key = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase()))).sort().join(',')
    return this.quotesCache.get(key, () => this.source.getQuotes(symbols))
  }

  getProfile(symbol: string): Promise<StockProfile> {
    return this.profileCache.get(symbol.toUpperCase(), () => this.source.getProfile(symbol))
  }

  getNews(symbol: string): Promise<NewsItem[]> {
    return this.newsCache.get(symbol.toUpperCase(), () => this.source.getNews(symbol))
  }

  getHistoricalPrices(symbol: string, range: ChartRange): Promise<ChartPoint[]> {
    return this.historicalCache.get(`${symbol.toUpperCase()}:${range}`, () => this.source.getHistoricalPrices(symbol, range))
  }
}
