import type { ChartPoint, ChartRange, NewsItem, StockProfile, StockStats } from '../../../shared/types.js'
import type { MarketDataProvider } from './MarketDataProvider.js'

/**
 * Pulls basic quote statistics from Yahoo Finance's public (unofficial,
 * no-API-key-required) endpoints. There's no official free API for this
 * data, so this uses the same session-cookie + crumb handshake the
 * finance.yahoo.com website itself relies on, and refreshes it if it's
 * ever rejected.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface YahooSession {
  cookie: string
  crumb: string
}

function num(field: unknown): number | null {
  if (field && typeof field === 'object' && 'raw' in field && typeof (field as { raw: unknown }).raw === 'number') {
    return (field as { raw: number }).raw
  }
  return null
}

interface QuoteSummaryField {
  raw?: number
}

interface QuoteSummaryResult {
  price?: {
    regularMarketPrice?: QuoteSummaryField
    regularMarketChangePercent?: QuoteSummaryField
    marketCap?: QuoteSummaryField
    shortName?: string
    longName?: string
    symbol?: string
    currency?: string
  }
  summaryDetail?: {
    bid?: QuoteSummaryField
    ask?: QuoteSummaryField
    beta?: QuoteSummaryField
    marketCap?: QuoteSummaryField
    regularMarketDayLow?: QuoteSummaryField
    regularMarketDayHigh?: QuoteSummaryField
    fiftyTwoWeekLow?: QuoteSummaryField
    fiftyTwoWeekHigh?: QuoteSummaryField
  }
}

interface QuoteSummaryResponse {
  quoteSummary?: {
    result?: QuoteSummaryResult[]
    error?: { code?: string; description?: string } | null
  }
}

const UNAUTHORIZED = Symbol('unauthorized')

interface AssetProfileResult {
  assetProfile?: {
    sector?: string
    industry?: string
    longBusinessSummary?: string
    fullTimeEmployees?: number
  }
  financialData?: {
    recommendationKey?: string
    targetMeanPrice?: QuoteSummaryField
    numberOfAnalystOpinions?: QuoteSummaryField
    profitMargins?: QuoteSummaryField
    revenueGrowth?: QuoteSummaryField
  }
}

interface AssetProfileResponse {
  quoteSummary?: { result?: AssetProfileResult[] }
}

interface NewsSearchResponse {
  news?: {
    title?: string
    publisher?: string
    link?: string
    providerPublishTime?: number
  }[]
}

const MAX_NEWS_ITEMS = 5
const MAX_SYMBOLS = 6

const CHART_PARAMS: Record<ChartRange, { range: string; interval: string }> = {
  '1w': { range: '5d', interval: '15m' },
  '1mo': { range: '1mo', interval: '1d' },
  '3mo': { range: '3mo', interval: '1d' },
  '1y': { range: '1y', interval: '1wk' }
}

interface ChartResponse {
  chart?: {
    result?: {
      timestamp?: number[]
      indicators?: {
        quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[]
      }
    }[]
    error?: { description?: string } | null
  }
}

export class YahooProvider implements MarketDataProvider {
  private cachedSession: YahooSession | null = null
  private pendingSession: Promise<YahooSession> | null = null

  private async fetchSession(): Promise<YahooSession> {
    const cookieResponse = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': USER_AGENT }
    })
    const cookie = cookieResponse.headers
      .getSetCookie()
      .map((entry) => entry.split(';')[0])
      .join('; ')

    const crumbResponse = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie }
    })
    const crumb = (await crumbResponse.text()).trim()

    if (!cookie || !crumb || crumb.includes('<')) {
      throw new Error('Could not establish a Yahoo Finance session.')
    }

    return { cookie, crumb }
  }

  private async getSession(forceRefresh = false): Promise<YahooSession> {
    if (!forceRefresh && this.cachedSession) return this.cachedSession
    if (!forceRefresh && this.pendingSession) return this.pendingSession

    this.pendingSession = this.fetchSession()
      .then((session) => {
        this.cachedSession = session
        return session
      })
      .finally(() => {
        this.pendingSession = null
      })

    return this.pendingSession
  }

  private async fetchOne(symbol: string, session: YahooSession): Promise<StockStats | null | typeof UNAUTHORIZED> {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,summaryDetail&crumb=${encodeURIComponent(session.crumb)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Cookie: session.cookie }
    })

    if (response.status === 401) return UNAUTHORIZED
    if (!response.ok) return null

    const data = (await response.json()) as QuoteSummaryResponse
    const result = data.quoteSummary?.result?.[0]
    const price = result?.price
    const detail = result?.summaryDetail

    if (!price?.regularMarketPrice) return null

    return {
      symbol: price.symbol ?? symbol,
      name: price.shortName ?? price.longName ?? symbol,
      price: num(price.regularMarketPrice) ?? 0,
      changePercent: num(price.regularMarketChangePercent) ?? 0,
      currency: price.currency ?? 'USD',
      bid: num(detail?.bid),
      ask: num(detail?.ask),
      marketCap: num(price.marketCap) ?? num(detail?.marketCap),
      beta: num(detail?.beta),
      dayLow: num(detail?.regularMarketDayLow),
      dayHigh: num(detail?.regularMarketDayHigh),
      fiftyTwoWeekLow: num(detail?.fiftyTwoWeekLow),
      fiftyTwoWeekHigh: num(detail?.fiftyTwoWeekHigh)
    }
  }

  async getQuotes(symbols: string[]): Promise<StockStats[]> {
    const unique = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase()))).slice(0, MAX_SYMBOLS)
    if (unique.length === 0) return []

    const fetchAll = async (session: YahooSession): Promise<StockStats[] | typeof UNAUTHORIZED> => {
      const settled = await Promise.all(unique.map((symbol) => this.fetchOne(symbol, session)))
      if (settled.some((entry) => entry === UNAUTHORIZED)) return UNAUTHORIZED
      return settled.filter((entry): entry is StockStats => entry !== null && entry !== UNAUTHORIZED)
    }

    const session = await this.getSession()
    const firstAttempt = await fetchAll(session)
    if (firstAttempt !== UNAUTHORIZED) return firstAttempt

    // The crumb can expire mid-session - refresh once and retry.
    const refreshedSession = await this.getSession(true)
    const secondAttempt = await fetchAll(refreshedSession)
    if (secondAttempt === UNAUTHORIZED) {
      throw new Error('Yahoo Finance rejected the request twice in a row. Try again shortly.')
    }
    return secondAttempt
  }

  private async fetchProfileOnce(symbol: string, session: YahooSession): Promise<StockProfile | typeof UNAUTHORIZED> {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,financialData&crumb=${encodeURIComponent(session.crumb)}`
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Cookie: session.cookie } })

    if (response.status === 401) return UNAUTHORIZED
    if (!response.ok) throw new Error(`Could not load company profile for ${symbol}.`)

    const data = (await response.json()) as AssetProfileResponse
    const result = data.quoteSummary?.result?.[0]
    const profile = result?.assetProfile
    const financials = result?.financialData

    return {
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,
      description: profile?.longBusinessSummary ?? null,
      employees: profile?.fullTimeEmployees ?? null,
      recommendationKey: financials?.recommendationKey ?? null,
      targetMeanPrice: num(financials?.targetMeanPrice),
      numberOfAnalystOpinions: num(financials?.numberOfAnalystOpinions),
      profitMargins: num(financials?.profitMargins),
      revenueGrowth: num(financials?.revenueGrowth)
    }
  }

  async getProfile(symbol: string): Promise<StockProfile> {
    const session = await this.getSession()
    const first = await this.fetchProfileOnce(symbol, session)
    if (first !== UNAUTHORIZED) return first

    const refreshed = await this.getSession(true)
    const second = await this.fetchProfileOnce(symbol, refreshed)
    if (second === UNAUTHORIZED) {
      throw new Error('Yahoo Finance rejected the request twice in a row. Try again shortly.')
    }
    return second
  }

  async getNews(symbol: string): Promise<NewsItem[]> {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=${MAX_NEWS_ITEMS}&quotesCount=0`
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })

    if (!response.ok) {
      throw new Error(`Could not load news for ${symbol}.`)
    }

    const data = (await response.json()) as NewsSearchResponse
    return (data.news ?? [])
      .filter((item) => item.title && item.link)
      .slice(0, MAX_NEWS_ITEMS)
      .map((item) => ({
        title: item.title as string,
        publisher: item.publisher ?? 'Unknown source',
        link: item.link as string,
        publishedAt: item.providerPublishTime ?? 0
      }))
  }

  async getHistoricalPrices(symbol: string, range: ChartRange): Promise<ChartPoint[]> {
    const { range: yahooRange, interval } = CHART_PARAMS[range]
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${yahooRange}&interval=${interval}`
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })

    if (!response.ok) {
      throw new Error(`Could not load chart data for ${symbol}.`)
    }

    const data = (await response.json()) as ChartResponse
    const result = data.chart?.result?.[0]
    const timestamps = result?.timestamp ?? []
    const quote = result?.indicators?.quote?.[0]

    const points: ChartPoint[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const close = quote?.close?.[i]
      if (typeof close === 'number') {
        points.push({
          timestamp: timestamps[i],
          close,
          open: typeof quote?.open?.[i] === 'number' ? (quote.open[i] as number) : undefined,
          high: typeof quote?.high?.[i] === 'number' ? (quote.high[i] as number) : undefined,
          low: typeof quote?.low?.[i] === 'number' ? (quote.low[i] as number) : undefined,
          volume: typeof quote?.volume?.[i] === 'number' ? (quote.volume[i] as number) : undefined
        })
      }
    }
    return points
  }
}
