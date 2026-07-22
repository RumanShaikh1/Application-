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

/**
 * Electron's contextBridge only exposes `window.api` inside the real app.
 * This installs a harmless stand-in when previewing the renderer alone in a
 * plain browser (e.g. `vite`'s dev server opened directly, or the Puppeteer
 * screenshot loop) so the UI can still be exercised. Dev-only, never bundled
 * into a production build.
 */
export function installDevApiFallbackIfNeeded(): void {
  if (!import.meta.env.DEV || window.api) return

  let highlightListener: ((payload: HighlightPayload) => void) | null = null
  let tickersListener: ((payload: TickersPayload) => void) | null = null

  window.api = {
    getWebviewPreloadPath: () => '',
    onHighlight: (callback) => {
      highlightListener = callback
      return () => {
        highlightListener = null
      }
    },
    translateTerm: async (request: TranslateRequest) => {
      if (window.__devTranslateOverride) {
        return window.__devTranslateOverride(request)
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      const variant = request.simplifyFurther ? ' (simplified further)' : ''
      return `[dev preview]${variant} Explaining "${request.text}". Run inside Electron with GEMINI_API_KEY set to see a real translation.`
    },
    onTickers: (callback) => {
      tickersListener = callback
      return () => {
        tickersListener = null
      }
    },
    getMarketStats: async (symbols: string[]) => {
      if (window.__devMarketStatsOverride) {
        return window.__devMarketStatsOverride(symbols)
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      return symbols.slice(0, 3).map(
        (symbol): StockStats => ({
          symbol,
          name: `${symbol} (dev preview)`,
          price: 123.45,
          changePercent: 1.23,
          currency: 'USD',
          bid: 123.4,
          ask: 123.5,
          marketCap: 123_000_000_000,
          beta: 1.1,
          dayLow: 120,
          dayHigh: 125,
          fiftyTwoWeekLow: 90,
          fiftyTwoWeekHigh: 140
        })
      )
    },
    getStockProfile: async (symbol: string): Promise<StockProfile> => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return {
        sector: 'Technology',
        industry: 'Software',
        description: `${symbol} (dev preview) is a placeholder company profile shown while previewing outside Electron.`,
        employees: 10_000,
        recommendationKey: 'buy',
        targetMeanPrice: 150,
        numberOfAnalystOpinions: 20,
        profitMargins: 0.25,
        revenueGrowth: 0.12
      }
    },
    getStockNews: async (symbol: string): Promise<NewsItem[]> => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return [
        {
          title: `${symbol} (dev preview) headline - run inside Electron for real news`,
          publisher: 'Dev Preview',
          link: 'https://finance.yahoo.com',
          publishedAt: Math.floor(Date.now() / 1000)
        }
      ]
    },
    getStockChart: async (_symbol: string, _range: ChartRange): Promise<ChartPoint[]> => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      const now = Math.floor(Date.now() / 1000)
      return Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (19 - i) * 86_400,
        close: 100 + Math.sin(i / 3) * 10 + i * 0.5
      }))
    },
    getStockContext: async (request: StockContextRequest): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return `[dev preview] ${request.symbol} context synthesis - run inside Electron with GEMINI_API_KEY set for a real answer.`
    }
  }

  // Lets an external driver (e.g. a Puppeteer screenshot script) simulate a
  // highlight or ticker detection arriving from the webview, without needing
  // a real Electron host.
  window.__devEmitHighlight = (text: string) => {
    highlightListener?.({ text, timestamp: Date.now() })
  }

  window.__devEmitTickers = (symbols: string[]) => {
    tickersListener?.({ symbols })
  }
}
