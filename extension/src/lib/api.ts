import type {
  ChartPoint,
  ChartRange,
  NewsItem,
  StockContextRequest,
  StockProfile,
  StockStats,
  TranslateRequest
} from '@shared/types'
import type { ApiRequestMessage, ApiResponseMessage } from './messages'

/**
 * The content script has no direct network access to the local server -
 * fetching localhost from a page's content-script context can be blocked by
 * that page's own CSP. Every call here is relayed through the background
 * service worker instead, which fetches with extension-level privileges.
 */
async function send<T>(message: ApiRequestMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as ApiResponseMessage<T> | undefined
  if (!response) {
    throw new Error('No response from the MarketPane background worker. Try reloading the extension.')
  }
  if (!response.ok) {
    throw new Error(response.error)
  }
  return response.data
}

export const api = {
  translateTerm: (request: TranslateRequest): Promise<string> =>
    send({ type: 'api-request', endpoint: 'translate', payload: request }),

  getStockContext: (request: StockContextRequest): Promise<string> =>
    send({ type: 'api-request', endpoint: 'context', payload: request }),

  getMarketStats: (symbols: string[]): Promise<StockStats[]> =>
    send({ type: 'api-request', endpoint: 'stats', payload: { symbols } }),

  getStockProfile: (symbol: string): Promise<StockProfile> =>
    send({ type: 'api-request', endpoint: 'profile', payload: { symbol } }),

  getStockNews: (symbol: string): Promise<NewsItem[]> =>
    send({ type: 'api-request', endpoint: 'news', payload: { symbol } }),

  getStockChart: (symbol: string, range: ChartRange): Promise<ChartPoint[]> =>
    send({ type: 'api-request', endpoint: 'chart', payload: { symbol, range } })
}
