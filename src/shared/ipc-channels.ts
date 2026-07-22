// NOTE: 'webview:highlight' and 'webview:tickers' are intentionally duplicated
// as literals in src/preload/webview-preload.ts instead of importing
// IPC.WEBVIEW_HIGHLIGHT / IPC.WEBVIEW_TICKERS. That preload runs in the
// sandboxed <webview> guest, whose require() can't resolve the extra chunk
// this shared import would split into - importing it silently kills the
// whole script. Keep both in sync if you change either value.
export const IPC = {
  GET_WEBVIEW_PRELOAD_PATH: 'app:get-webview-preload-path',
  WEBVIEW_HIGHLIGHT: 'webview:highlight',
  HIGHLIGHT_RELAY: 'app:highlight-relay',
  TRANSLATE_REQUEST: 'app:translate-request',
  WEBVIEW_TICKERS: 'webview:tickers',
  TICKERS_RELAY: 'app:tickers-relay',
  MARKET_STATS_REQUEST: 'app:market-stats-request',
  STOCK_PROFILE_REQUEST: 'app:stock-profile-request',
  STOCK_NEWS_REQUEST: 'app:stock-news-request',
  STOCK_CHART_REQUEST: 'app:stock-chart-request',
  STOCK_CONTEXT_REQUEST: 'app:stock-context-request'
} as const

export interface HighlightPayload {
  text: string
  timestamp: number
  /** The guest page's URL at the time of selection, if available. */
  url?: string
}

export interface TranslateRequest {
  text: string
  sourceUrl?: string
  /** Set when the reader asked for an even simpler rephrase of the same term. */
  simplifyFurther?: boolean
}

export interface TickersPayload {
  symbols: string[]
}

export interface StockStats {
  symbol: string
  name: string
  price: number
  changePercent: number
  currency: string
  bid: number | null
  ask: number | null
  marketCap: number | null
  /** Beta - volatility relative to the overall market. */
  beta: number | null
  dayLow: number | null
  dayHigh: number | null
  fiftyTwoWeekLow: number | null
  fiftyTwoWeekHigh: number | null
}

export interface StockProfile {
  sector: string | null
  industry: string | null
  description: string | null
  employees: number | null
  recommendationKey: string | null
  targetMeanPrice: number | null
  numberOfAnalystOpinions: number | null
  profitMargins: number | null
  revenueGrowth: number | null
}

export interface NewsItem {
  title: string
  publisher: string
  link: string
  /** Unix seconds. */
  publishedAt: number
}

export type ChartRange = '1w' | '1mo' | '3mo' | '1y'

export interface ChartPoint {
  /** Unix seconds. */
  timestamp: number
  close: number
}

export interface StockContextRequest {
  symbol: string
  name: string
  headlines: string[]
}
