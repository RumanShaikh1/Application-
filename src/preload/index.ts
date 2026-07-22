import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IPC,
  type ChartPoint,
  type ChartRange,
  type HighlightPayload,
  type NewsItem,
  type StockContextRequest,
  type StockProfile,
  type StockStats,
  type TickersPayload,
  type TranslateRequest
} from '../shared/ipc-channels'

const api = {
  /** Absolute file:// URL of the compiled webview-preload script. */
  getWebviewPreloadPath: (): string => ipcRenderer.sendSync(IPC.GET_WEBVIEW_PRELOAD_PATH) as string,

  /** Subscribe to text highlighted inside the <webview>. Returns an unsubscribe fn. */
  onHighlight: (callback: (payload: HighlightPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: HighlightPayload): void =>
      callback(payload)
    ipcRenderer.on(IPC.HIGHLIGHT_RELAY, listener)
    return () => ipcRenderer.removeListener(IPC.HIGHLIGHT_RELAY, listener)
  },

  /** Ask main to translate a highlighted term/passage via the Gemini API. */
  translateTerm: (request: TranslateRequest): Promise<string> =>
    ipcRenderer.invoke(IPC.TRANSLATE_REQUEST, request),

  /** Subscribe to stock tickers detected on the current page. Returns an unsubscribe fn. */
  onTickers: (callback: (payload: TickersPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TickersPayload): void => callback(payload)
    ipcRenderer.on(IPC.TICKERS_RELAY, listener)
    return () => ipcRenderer.removeListener(IPC.TICKERS_RELAY, listener)
  },

  /** Ask main to fetch live quote statistics for the given tickers. */
  getMarketStats: (symbols: string[]): Promise<StockStats[]> =>
    ipcRenderer.invoke(IPC.MARKET_STATS_REQUEST, symbols),

  /** Ask main for a stock's company profile / analyst insights. */
  getStockProfile: (symbol: string): Promise<StockProfile> =>
    ipcRenderer.invoke(IPC.STOCK_PROFILE_REQUEST, symbol),

  /** Ask main for recent real news headlines mentioning a stock. */
  getStockNews: (symbol: string): Promise<NewsItem[]> => ipcRenderer.invoke(IPC.STOCK_NEWS_REQUEST, symbol),

  /** Ask main for historical price points for a stock over a given range. */
  getStockChart: (symbol: string, range: ChartRange): Promise<ChartPoint[]> =>
    ipcRenderer.invoke(IPC.STOCK_CHART_REQUEST, symbol, range),

  /** Ask main to synthesize how a stock relates to current affairs, from real headlines. */
  getStockContext: (request: StockContextRequest): Promise<string> =>
    ipcRenderer.invoke(IPC.STOCK_CONTEXT_REQUEST, request)
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] failed to expose context bridge APIs', error)
  }
} else {
  // @ts-expect-error - contextIsolation disabled fallback, not used in this app
  window.electron = electronAPI
  // @ts-expect-error - contextIsolation disabled fallback, not used in this app
  window.api = api
}
