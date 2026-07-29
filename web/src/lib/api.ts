import type {
  ChartPoint,
  ChartRange,
  LossHarvestingResult,
  OpenLossPosition,
  PortfolioGradeReport,
  Portfolio,
  PortfolioValuation,
  RealizedGainsThisFY,
  SandboxCompanyDetail,
  SandboxDayPricesResponse,
  SandboxFundamentalsSnapshot,
  SandboxPortfolioState,
  SandboxTradeRequest,
  SandboxTradeResult,
  ScenarioAnswerRequest,
  ScenarioAnswerResponse,
  ScenarioStagePayload,
  ScenarioSummary,
  StockStats,
  TaxComputationResult,
  TaxRateSet,
  TaxTradeInput,
  TradeRequest,
  TradeResponse
} from '@shared/types'

// The server's own YahooProvider caps a single /api/stats call at 6 symbols
// (see server/src/providers/YahooProvider.ts) - the icon grid's curated
// basket is larger than that, so batching client-side is required, not
// just an optimisation.
const MAX_SYMBOLS_PER_QUOTES_REQUEST = 6

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// This is a normal webpage, not an extension content script, so it can call
// the local server's fetch API directly - no background-worker relay
// needed (see extension/src/lib/api.ts for why the extension needs one).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

interface ApiErrorBody {
  error?: string
}

export interface TaxExplainResponse {
  result: TaxComputationResult
  explanation: string
}

export interface TaxBreakeven {
  breakevenSellPrice: number
  breakevenMoveRupees: number
  breakevenMovePercent: number
  worthWaitingAtCurrentPrice: boolean
}

export interface TaxCounterweightResponse {
  daysRemaining: number
  longTermEligibleDate: string
  sellTodayResult: TaxComputationResult
  holdResult: TaxComputationResult
  breakeven: TaxBreakeven
  assumptionNote: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new Error(body?.error ?? `Request failed (${response.status}).`)
  }

  return (await response.json()) as T
}

export const api = {
  listScenarios: (): Promise<ScenarioSummary[]> => request('/api/scenarios'),

  getScenarioStage: (scenarioId: string, stageIndex: number): Promise<ScenarioStagePayload> =>
    request(`/api/scenarios/${encodeURIComponent(scenarioId)}/stage/${stageIndex}`),

  submitAnswer: (scenarioId: string, body: ScenarioAnswerRequest): Promise<ScenarioAnswerResponse> =>
    request(`/api/scenarios/${encodeURIComponent(scenarioId)}/answer`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),

  /** Live quote lookup for the trade ticket - reuses the same endpoint the extension's stat tiles use. */
  getQuote: async (symbol: string): Promise<StockStats | null> => {
    const results = await request<StockStats[]>(`/api/stats?symbols=${encodeURIComponent(symbol)}`)
    return results[0] ?? null
  },

  /** Batched to respect the server's per-request symbol cap - for the icon grid, which quotes more names at once than a single lookup. A failed batch degrades to fewer cards rather than failing the whole grid. */
  getQuotes: async (symbols: string[]): Promise<StockStats[]> => {
    const batches = await Promise.all(
      chunk(symbols, MAX_SYMBOLS_PER_QUOTES_REQUEST).map((batch) =>
        request<StockStats[]>(`/api/stats?symbols=${batch.map(encodeURIComponent).join(',')}`).catch(() => [] as StockStats[])
      )
    )
    return batches.flat()
  },

  /** Recent price history for a mini sparkline - same endpoint the extension's PriceChart uses. */
  getChart: (symbol: string, range: ChartRange): Promise<ChartPoint[]> =>
    request(`/api/chart/${encodeURIComponent(symbol)}?range=${range}`),

  simulator: {
    trade: (body: TradeRequest): Promise<TradeResponse> =>
      request('/api/simulator/trade', { method: 'POST', body: JSON.stringify(body) }),

    valuePortfolio: (portfolio: Portfolio): Promise<PortfolioValuation> =>
      request('/api/simulator/portfolio/value', { method: 'POST', body: JSON.stringify({ portfolio }) })
  },

  sandbox: {
    listCompanies: (): Promise<SandboxFundamentalsSnapshot> => request('/api/sandbox/companies'),

    getCompanyDetail: (symbol: string): Promise<SandboxCompanyDetail> => request(`/api/sandbox/companies/${encodeURIComponent(symbol)}`),

    trade: (body: SandboxTradeRequest): Promise<SandboxTradeResult> => request('/api/sandbox/trade', { method: 'POST', body: JSON.stringify(body) }),

    valuePortfolio: (portfolio: Portfolio, day: number): Promise<PortfolioValuation> =>
      request('/api/sandbox/portfolio/value', { method: 'POST', body: JSON.stringify({ portfolio, day }) }),

    gradePortfolio: (state: SandboxPortfolioState): Promise<PortfolioGradeReport> =>
      request('/api/sandbox/portfolio/grade', { method: 'POST', body: JSON.stringify({ state }) }),

    getWindowInfo: (): Promise<{ lastDay: number; freeformMissionId: string }> => request('/api/sandbox/window-last-day'),

    getPricesForDay: (day: number): Promise<SandboxDayPricesResponse> => request(`/api/sandbox/prices/${day}`)
  },

  tax: {
    getRateSet: (date?: string): Promise<TaxRateSet> => request(`/api/tax/rate-set${date ? `?date=${encodeURIComponent(date)}` : ''}`),

    compute: (trade: TaxTradeInput): Promise<TaxComputationResult> => request('/api/tax/compute', { method: 'POST', body: JSON.stringify({ trade }) }),

    /** Only ever called on request (a button click) - never automatically - per CLAUDE.md's Product Invariants. */
    explain: (trade: TaxTradeInput): Promise<TaxExplainResponse> => request('/api/tax/explain', { method: 'POST', body: JSON.stringify({ trade }) }),

    /** The days-to-long-term counter and its counterweight, in one call - only valid for a still-short-term equity delivery trade. */
    counterweight: (trade: TaxTradeInput): Promise<TaxCounterweightResponse> => request('/api/tax/counterweight', { method: 'POST', body: JSON.stringify({ trade }) }),

    lossHarvesting: (positions: OpenLossPosition[], realizedGains: RealizedGainsThisFY, asOfDate: string): Promise<LossHarvestingResult> =>
      request('/api/tax/loss-harvesting', { method: 'POST', body: JSON.stringify({ positions, realizedGains, asOfDate }) })
  }
}
