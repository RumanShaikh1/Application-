// Internal message protocol between the content script (UI, no network
// access to localhost without a page CORS/CSP risk) and the background
// service worker (privileged fetch to the local server). Not shared with
// server/ - that project only ever sees plain HTTP requests.
import type { ChartRange, StockContextRequest, TranslateRequest } from '@shared/types'

export type ApiRequestMessage =
  | { type: 'api-request'; endpoint: 'translate'; payload: TranslateRequest }
  | { type: 'api-request'; endpoint: 'context'; payload: StockContextRequest }
  | { type: 'api-request'; endpoint: 'stats'; payload: { symbols: string[] } }
  | { type: 'api-request'; endpoint: 'profile'; payload: { symbol: string } }
  | { type: 'api-request'; endpoint: 'news'; payload: { symbol: string } }
  | { type: 'api-request'; endpoint: 'chart'; payload: { symbol: string; range: ChartRange } }

export type ApiResponseMessage<T = unknown> = { ok: true; data: T } | { ok: false; error: string }
