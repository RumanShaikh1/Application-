// Shared between server/ and extension/. Pure types only (no runtime code)
// so both projects can include this file directly in their own TS build
// without needing a package/workspace boundary.

export interface HighlightPayload {
  text: string
  timestamp: number
  /** The page's URL at the time of selection, if available. */
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
