import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ChartPoint,
  ChartRange,
  HighlightPayload,
  NewsItem,
  StockContextRequest,
  StockProfile,
  StockStats,
  TickersPayload,
  TranslateRequest
} from '@shared/ipc-channels'

export interface MarketPaneApi {
  getWebviewPreloadPath: () => string
  onHighlight: (callback: (payload: HighlightPayload) => void) => () => void
  translateTerm: (request: TranslateRequest) => Promise<string>
  onTickers: (callback: (payload: TickersPayload) => void) => () => void
  getMarketStats: (symbols: string[]) => Promise<StockStats[]>
  getStockProfile: (symbol: string) => Promise<StockProfile>
  getStockNews: (symbol: string) => Promise<NewsItem[]>
  getStockChart: (symbol: string, range: ChartRange) => Promise<ChartPoint[]>
  getStockContext: (request: StockContextRequest) => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: MarketPaneApi
    /** Dev-only test hook installed by devApiFallback; absent in the real app. */
    __devEmitHighlight?: (text: string) => void
    /** Dev-only: override the mocked translateTerm response, e.g. to force an error. */
    __devTranslateOverride?: (request: TranslateRequest) => Promise<string>
    /** Dev-only test hook installed by devApiFallback; absent in the real app. */
    __devEmitTickers?: (symbols: string[]) => void
    /** Dev-only: override the mocked getMarketStats response, e.g. to force an error. */
    __devMarketStatsOverride?: (symbols: string[]) => Promise<StockStats[]>
  }
}
