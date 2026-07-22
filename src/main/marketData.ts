import type { ChartPoint, ChartRange, NewsItem, StockProfile, StockStats } from '../shared/ipc-channels'

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

let cachedSession: YahooSession | null = null
let pendingSession: Promise<YahooSession> | null = null

async function fetchSession(): Promise<YahooSession> {
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

async function getSession(forceRefresh = false): Promise<YahooSession> {
  if (!forceRefresh && cachedSession) return cachedSession
  if (!forceRefresh && pendingSession) return pendingSession

  pendingSession = fetchSession()
    .then((session) => {
      cachedSession = session
      return session
    })
    .finally(() => {
      pendingSession = null
    })

  return pendingSession
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

async function fetchOne(symbol: string, session: YahooSession): Promise<StockStats | null | typeof UNAUTHORIZED> {
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

const MAX_SYMBOLS = 6

export async function getStockStats(symbols: string[]): Promise<StockStats[]> {
  const unique = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase()))).slice(0, MAX_SYMBOLS)
  if (unique.length === 0) return []

  async function fetchAll(session: YahooSession): Promise<StockStats[] | typeof UNAUTHORIZED> {
    const settled = await Promise.all(unique.map((symbol) => fetchOne(symbol, session)))
    if (settled.some((entry) => entry === UNAUTHORIZED)) return UNAUTHORIZED
    return settled.filter((entry): entry is StockStats => entry !== null && entry !== UNAUTHORIZED)
  }

  const session = await getSession()
  const firstAttempt = await fetchAll(session)
  if (firstAttempt !== UNAUTHORIZED) return firstAttempt

  // The crumb can expire mid-session - refresh once and retry.
  const refreshedSession = await getSession(true)
  const secondAttempt = await fetchAll(refreshedSession)
  if (secondAttempt === UNAUTHORIZED) {
    throw new Error('Yahoo Finance rejected the request twice in a row. Try again shortly.')
  }
  return secondAttempt
}

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

async function fetchProfileOnce(symbol: string, session: YahooSession): Promise<StockProfile | typeof UNAUTHORIZED> {
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

export async function getStockProfile(symbol: string): Promise<StockProfile> {
  const session = await getSession()
  const first = await fetchProfileOnce(symbol, session)
  if (first !== UNAUTHORIZED) return first

  const refreshed = await getSession(true)
  const second = await fetchProfileOnce(symbol, refreshed)
  if (second === UNAUTHORIZED) {
    throw new Error('Yahoo Finance rejected the request twice in a row. Try again shortly.')
  }
  return second
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

export async function getStockNews(symbol: string): Promise<NewsItem[]> {
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
      indicators?: { quote?: { close?: (number | null)[] }[] }
    }[]
    error?: { description?: string } | null
  }
}

export async function getStockChart(symbol: string, chartRange: ChartRange): Promise<ChartPoint[]> {
  const { range, interval } = CHART_PARAMS[chartRange]
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })

  if (!response.ok) {
    throw new Error(`Could not load chart data for ${symbol}.`)
  }

  const data = (await response.json()) as ChartResponse
  const result = data.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []

  const points: ChartPoint[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    if (typeof close === 'number') {
      points.push({ timestamp: timestamps[i], close })
    }
  }
  return points
}
