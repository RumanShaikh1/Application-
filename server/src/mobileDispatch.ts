// The Android app has no embedded Node.js runtime (see mobile/README.md for
// why - nodejs-mobile-react-native, the obvious alternative, is unmaintained
// and a compatibility risk not worth taking). Instead, its WebView loads the
// same web/ build over a tiny local HTTP server (NanoHTTPD, a small native
// Java library - see mobile/android/app/src/main/java/.../MarketPaneHttpServer.kt)
// that serves static files directly and forwards every /api/* request to
// this file, running inside the app's own JS engine (Hermes) via the
// bridge in mobile/src/bridge/. web/src/lib/api.ts is completely unaware of
// the difference - it always just does fetch('http://localhost:8787/api/...'),
// on every platform.
//
// Every handler below calls the exact same business-logic functions
// server/src/index.ts's Express routes call (scoreDecision, computeTax,
// gradePortfolio, etc.) and the exact same validators (server/src/validators.ts)
// - this file only reimplements the "which function handles this method+path,
// and how do validation failures/success map to a status+body" glue, which
// Express normally provides. Keeping that glue in one shared file (rather
// than scattered per-platform) means a route's behavior can only drift from
// its Express counterpart if this file itself is wrong, not from two
// separately-hand-maintained copies of the same validation logic.
import { explainStockContext, translateTerm } from './gemini.js'
import { CachingProvider } from './providers/CachingProvider.js'
import { YahooProvider } from './providers/YahooProvider.js'
import type { MarketDataProvider } from './providers/MarketDataProvider.js'
import { getScenario, listScenarios } from './scenarios/loadScenarios.js'
import { getDecisionPrices, getScenarioSummary, getStagePayload } from './scenarios/stageGating.js'
import { scoreDecision } from './scenarios/rubricScoring.js'
import { calculateNetReturn, calculateTradeCost } from './scenarios/costModel.js'
import { applyTrade, canAffordBuy, checkDiversification, checkPositionSize, hasSufficientHolding, valuePortfolio } from './simulator/portfolioEngine.js'
import { TRADE_RUBRIC } from './simulator/tradeRubric.js'
import { scoreTradeProcess } from './simulator/tradeScoring.js'
import { evaluateTradeRationale } from './simulator/evaluateTradeRationale.js'
import { getRateSetForDate } from './tax/rateSetLoader.js'
import { computeTax } from './tax/computeTax.js'
import { computeLossHarvesting } from './tax/lossSetOff.js'
import { explainTaxResult } from './tax/explainTaxResult.js'
import { computeBreakevenMove } from './tax/breakeven.js'
import { daysUntilLongTerm, longTermEligibleDate } from './tax/holdingPeriod.js'
import { listPlacementMiniScenarios } from './placement/loadPlacement.js'
import { getPlacementPayload } from './placement/placementGating.js'
import { evaluatePlacement } from './placement/evaluatePlacement.js'
import { findCaseStudy, listCaseStudies } from './caseStudies/loadCaseStudies.js'
import { CASE_STUDY_LEVEL_TIER_CAP, getCaseStudyPayload, revealCaseStudyFact } from './caseStudies/caseStudyGating.js'
import { evaluateCaseStudyTier } from './caseStudies/evaluateCaseStudyTier.js'
import { findSandboxCompany, findStockAnalysis, getSandboxClose, getSandboxFundamentals, getSandboxPriceWindow, getSandboxWindowLastDay } from './sandbox/loadSandboxData.js'
import { findPositionMeta, updatePositionMeta } from './sandbox/positionMeta.js'
import { detectConcentrationSignals, detectImprovementSignals, detectOvertrading, detectRunUpChasing } from './sandbox/processSignals.js'
import { gradePortfolio } from './sandbox/portfolioGrader.js'
import { randomId } from './randomId.js'
import {
  DIFFICULTY_LEVELS,
  ISO_DATE_PATTERN,
  MAX_QUANTITY,
  MAX_RATIONALE_LENGTH,
  MAX_SELECTED_IDS,
  MAX_TEXT_LENGTH,
  MAX_URL_LENGTH,
  SANDBOX_FREEFORM_MISSION_ID,
  isValidPortfolio,
  isValidSandboxPortfolioState,
  isValidThesisTag,
  parseLevel,
  validateCaseStudyTierAnswer,
  validateOpenLossPositions,
  validatePlacementAnswers,
  validateRealizedGains,
  validateTaxTradeInput
} from './validators.js'
import type {
  CaseStudyTierAnswerResponse,
  ChartRange,
  OpenLossPosition,
  PlacementAnswer,
  Portfolio,
  RealizedGainsThisFY,
  RubricCriterionResult,
  SandboxCompanyDetail,
  SandboxDayPriceQuote,
  SandboxDayPricesResponse,
  SandboxPortfolioState,
  SandboxPositionCloseSummary,
  SandboxProcessSignal,
  SandboxTrade,
  SandboxTradeRequest,
  SandboxTradeResult,
  ScenarioAnswerRequest,
  ScenarioAnswerResponse,
  StockContextRequest,
  TaxTradeInput,
  ThesisTag,
  TradeRecord,
  TradeRequest,
  TradeResponse,
  TranslateRequest
} from '../../shared/types.js'

export interface DispatchRequest {
  method: string
  path: string
  query: Record<string, string>
  body: unknown
}

export interface DispatchResponse {
  status: number
  body: unknown
}

const CHART_RANGES: ChartRange[] = ['1w', '1mo', '3mo', '1y']

// Same CachingProvider(YahooProvider()) pairing as server/src/index.ts -
// its own module-level singleton isn't reachable from here (index.ts is
// never imported into the mobile bundle, only this file and what it itself
// imports are), so the Android app gets its own cache instance. Fine: a
// process-lifetime in-memory TTL cache has no cross-instance state to share
// in the first place.
const provider: MarketDataProvider = new CachingProvider(new YahooProvider())

type Handler = (params: Record<string, string>, query: Record<string, string>, body: unknown) => Promise<DispatchResponse>

interface Route {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: Handler
}

// Express-style ":param" path syntax compiled to a matching RegExp, so
// route definitions below read identically to their index.ts counterparts.
function compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = []
  const patternSource = path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1))
        return '([^/]+)'
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return { pattern: new RegExp(`^${patternSource}$`), paramNames }
}

const routes: Route[] = []

function route(method: string, path: string, handler: Handler): void {
  const { pattern, paramNames } = compilePath(path)
  routes.push({ method, pattern, paramNames, handler })
}

function ok(body: unknown): DispatchResponse {
  return { status: 200, body }
}

function badRequest(error: string): DispatchResponse {
  return { status: 400, body: { error } }
}

function notFound(error: string): DispatchResponse {
  return { status: 404, body: { error } }
}

// ---------------------------------------------------------------------------
// Translate / context (Gemini)
// ---------------------------------------------------------------------------

route('POST', '/api/translate', async (_params, _query, body) => {
  const { text, sourceUrl, simplifyFurther } = (body ?? {}) as Partial<TranslateRequest>
  if (typeof text !== 'string' || !text.trim()) return badRequest('Field "text" is required.')
  if (text.length > MAX_TEXT_LENGTH) return badRequest(`Field "text" must be ${MAX_TEXT_LENGTH} characters or fewer.`)
  if (typeof sourceUrl === 'string' && sourceUrl.length > MAX_URL_LENGTH) {
    return badRequest(`Field "sourceUrl" must be ${MAX_URL_LENGTH} characters or fewer.`)
  }
  const result = await translateTerm({ text, sourceUrl, simplifyFurther })
  return ok({ result })
})

route('POST', '/api/context', async (_params, _query, body) => {
  const { symbol, name, headlines } = (body ?? {}) as Partial<StockContextRequest>
  if (typeof symbol !== 'string' || !symbol.trim()) return badRequest('Field "symbol" is required.')
  const safeHeadlines = Array.isArray(headlines)
    ? headlines.filter((h): h is string => typeof h === 'string' && h.length <= MAX_TEXT_LENGTH).slice(0, 20)
    : []
  const result = await explainStockContext({ symbol, name: name ?? symbol, headlines: safeHeadlines })
  return ok({ result })
})

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

route('GET', '/api/stats', async (_params, query) => {
  const symbols = typeof query.symbols === 'string' ? query.symbols.split(',').filter(Boolean) : []
  return ok(await provider.getQuotes(symbols))
})

route('GET', '/api/profile/:symbol', async (params) => ok(await provider.getProfile(params.symbol)))

route('GET', '/api/news/:symbol', async (params) => ok(await provider.getNews(params.symbol)))

route('GET', '/api/chart/:symbol', async (params, query) => {
  const range = query.range
  if (typeof range !== 'string' || !CHART_RANGES.includes(range as ChartRange)) {
    return badRequest(`Query param "range" must be one of: ${CHART_RANGES.join(', ')}.`)
  }
  return ok(await provider.getHistoricalPrices(params.symbol, range as ChartRange))
})

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

route('GET', '/api/placement', async () => ok(getPlacementPayload(listPlacementMiniScenarios())))

route('POST', '/api/placement/answer', async (_params, _query, body) => {
  const { answers } = (body ?? {}) as { answers?: unknown }
  const validationError = validatePlacementAnswers(answers)
  if (validationError) return badRequest(validationError)
  return ok(evaluatePlacement(listPlacementMiniScenarios(), answers as PlacementAnswer[]))
})

// ---------------------------------------------------------------------------
// Case studies
// ---------------------------------------------------------------------------

route('GET', '/api/case-studies', async () => ok(listCaseStudies().map((caseStudy) => ({ id: caseStudy.id, title: caseStudy.title }))))

route('GET', '/api/case-studies/:id', async (params, query) => {
  const caseStudy = findCaseStudy(params.id)
  if (!caseStudy) return notFound(`Case study "${params.id}" was not found.`)
  const level = parseLevel(query.level)
  if (level === null) return badRequest(`Query param "level" must be one of: ${DIFFICULTY_LEVELS.join(', ')}.`)
  return ok(getCaseStudyPayload(caseStudy, level))
})

route('POST', '/api/case-studies/:id/facts/:factId/reveal', async (params, _query, body) => {
  const caseStudy = findCaseStudy(params.id)
  if (!caseStudy) return notFound(`Case study "${params.id}" was not found.`)
  const level = parseLevel((body as { level?: unknown } | undefined)?.level)
  if (level === null) return badRequest(`Field "level" must be one of: ${DIFFICULTY_LEVELS.join(', ')}.`)
  const fact = revealCaseStudyFact(caseStudy, level, params.factId)
  if (!fact) return notFound(`Fact "${params.factId}" is not available to look up at this level.`)
  return ok(fact)
})

route('POST', '/api/case-studies/:id/tiers/:tierId/answer', async (params, _query, body) => {
  const caseStudy = findCaseStudy(params.id)
  if (!caseStudy) return notFound(`Case study "${params.id}" was not found.`)

  const requestBody = (body ?? {}) as Record<string, unknown>
  const level = parseLevel(requestBody.level)
  if (level === null) return badRequest(`Field "level" must be one of: ${DIFFICULTY_LEVELS.join(', ')}.`)

  const tierIndex = caseStudy.tiers.findIndex((tier) => tier.id === params.tierId)
  if (tierIndex === -1) return notFound(`Tier "${params.tierId}" was not found on this case study.`)

  const visibleTierCount = Math.min(caseStudy.tiers.length, CASE_STUDY_LEVEL_TIER_CAP[level])
  if (tierIndex >= visibleTierCount) {
    return { status: 403, body: { error: `Tier "${params.tierId}" is not unlocked at the "${level}" level.` } }
  }

  const tier = caseStudy.tiers[tierIndex]
  if (requestBody.kind !== tier.kind) return badRequest(`Field "kind" must be "${tier.kind}" for this tier.`)

  const validated = validateCaseStudyTierAnswer(requestBody, tier)
  if ('error' in validated) return badRequest(validated.error)

  const tierResult = evaluateCaseStudyTier(tier, validated.answer)
  const isFinalTierForLevel = tierIndex === visibleTierCount - 1
  const tierGenuinelyComplete = tierResult.kind !== 'instrument' || tierResult.result.gatePassed
  const revealDebrief = isFinalTierForLevel && tierGenuinelyComplete

  const response: CaseStudyTierAnswerResponse = {
    tierResult,
    isFinalTierForLevel,
    ...(revealDebrief ? { identity: caseStudy.identity } : {})
  }
  return ok(response)
})

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

route('GET', '/api/sandbox/companies', async () => ok(getSandboxFundamentals()))

route('GET', '/api/sandbox/companies/:symbol', async (params) => {
  const company = findSandboxCompany(params.symbol)
  if (!company) return notFound(`No sandbox company found for symbol "${params.symbol}".`)
  const analysis = findStockAnalysis(company.symbol) ?? null
  const priceSeries = getSandboxPriceWindow().seriesBySymbol[company.symbol] ?? []
  const response: SandboxCompanyDetail = { company, analysis, priceSeries, fundamentalsAsOfDate: getSandboxFundamentals().asOfDate }
  return ok(response)
})

route('POST', '/api/sandbox/trade', async (_params, _query, body) => {
  const { state, symbol, side, quantity, thesisTag } = (body ?? {}) as Partial<SandboxTradeRequest>

  if (!isValidSandboxPortfolioState(state)) return badRequest('Field "state" is invalid.')
  if (typeof symbol !== 'string' || !symbol.trim()) return badRequest('Field "symbol" is required.')
  if (side !== 'buy' && side !== 'sell') return badRequest('Field "side" must be "buy" or "sell".')
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    return badRequest(`Field "quantity" must be a positive whole number up to ${MAX_QUANTITY}.`)
  }

  const upperSymbol = symbol.toUpperCase()
  const company = findSandboxCompany(upperSymbol)
  if (!company) return notFound(`No sandbox company found for symbol "${symbol}".`)

  const existingMeta = findPositionMeta(state.positionMeta, upperSymbol)
  if (side === 'buy' && !existingMeta && !isValidThesisTag(thesisTag)) {
    return badRequest('Field "thesisTag" is required to open a new position and must be one of the recognised reasons.')
  }

  const closePrice = getSandboxClose(upperSymbol, state.dayCursor)
  if (closePrice === undefined) return badRequest(`No price available for "${symbol}" on day ${state.dayCursor}.`)

  const cost = calculateTradeCost({ price: closePrice, quantity, side })

  if (side === 'buy' && !canAffordBuy(state.portfolio, cost)) return badRequest('Insufficient virtual cash for this trade.')
  if (side === 'sell' && !hasSufficientHolding(state.portfolio, upperSymbol, quantity)) {
    return badRequest(`You don't hold enough ${upperSymbol} to sell ${quantity} shares.`)
  }

  const pricesAndSectorsAsOfToday = (portfolio: Portfolio): { prices: Record<string, number>; sectors: Record<string, string | null> } => {
    const prices: Record<string, number> = { [upperSymbol]: closePrice }
    const sectors: Record<string, string | null> = { [upperSymbol]: company.sector }
    for (const holding of portfolio.holdings) {
      prices[holding.symbol] = getSandboxClose(holding.symbol, state.dayCursor) ?? holding.averageCost
      sectors[holding.symbol] = findSandboxCompany(holding.symbol)?.sector ?? null
    }
    return { prices, sectors }
  }

  const before = pricesAndSectorsAsOfToday(state.portfolio)
  const beforePositionCheck = checkPositionSize(state.portfolio, before.prices, upperSymbol)
  const beforeDiversification = checkDiversification(state.portfolio, before.prices, before.sectors)

  const updatedPortfolio = applyTrade(state.portfolio, upperSymbol, side, quantity, cost)
  const resultingQuantity = updatedPortfolio.holdings.find((holding) => holding.symbol === upperSymbol)?.quantity ?? 0

  const after = pricesAndSectorsAsOfToday(updatedPortfolio)
  const afterPositionCheck = checkPositionSize(updatedPortfolio, after.prices, upperSymbol)
  const afterDiversification = checkDiversification(updatedPortfolio, after.prices, after.sectors)

  const updatedPositionMeta = updatePositionMeta(
    state.positionMeta,
    upperSymbol,
    side,
    state.dayCursor,
    isValidThesisTag(thesisTag) ? thesisTag : undefined,
    resultingQuantity
  )

  const tradeThesisTag: ThesisTag = side === 'buy' ? (thesisTag as ThesisTag) : (existingMeta?.thesisTag ?? 'other')

  const priceSeriesForSymbol = getSandboxPriceWindow().seriesBySymbol[upperSymbol] ?? []
  const runUpSignal = detectRunUpChasing(side, upperSymbol, state.dayCursor, priceSeriesForSymbol)
  const overtradingSignal = detectOvertrading(state.tradeLog, state.dayCursor)
  const signals: SandboxProcessSignal[] = [
    ...detectConcentrationSignals(afterPositionCheck, afterDiversification),
    ...detectImprovementSignals(
      { positionSizeCheck: beforePositionCheck, diversification: beforeDiversification },
      { positionSizeCheck: afterPositionCheck, diversification: afterDiversification },
      side
    ),
    ...(runUpSignal ? [runUpSignal] : []),
    ...(overtradingSignal ? [overtradingSignal] : [])
  ]

  let closeSummary: SandboxPositionCloseSummary | undefined
  if (side === 'sell' && resultingQuantity === 0 && existingMeta) {
    const entryPrice = getSandboxClose(upperSymbol, existingMeta.entryDay) ?? closePrice
    closeSummary = {
      symbol: upperSymbol,
      thesisTag: existingMeta.thesisTag,
      entryDay: existingMeta.entryDay,
      exitDay: state.dayCursor,
      entryPrice,
      exitPrice: closePrice,
      netReturnPercent: entryPrice > 0 ? ((closePrice - entryPrice) / entryPrice) * 100 : 0
    }
  }

  const trade: SandboxTrade = {
    id: randomId(),
    symbol: upperSymbol,
    side,
    quantity,
    price: closePrice,
    day: state.dayCursor,
    costBreakdown: cost,
    thesisTag: tradeThesisTag,
    timestamp: Date.now(),
    positionSizeCheck: afterPositionCheck,
    diversification: afterDiversification
  }

  const updatedState: SandboxPortfolioState = {
    missionId: state.missionId,
    portfolio: updatedPortfolio,
    positionMeta: updatedPositionMeta,
    dayCursor: state.dayCursor,
    tradeLog: [...state.tradeLog, trade]
  }

  const response: SandboxTradeResult = {
    trade,
    state: updatedState,
    positionSizeCheck: afterPositionCheck,
    diversification: afterDiversification,
    signals,
    closeSummary
  }
  return ok(response)
})

route('POST', '/api/sandbox/portfolio/value', async (_params, _query, body) => {
  const { portfolio, day } = (body ?? {}) as { portfolio?: unknown; day?: unknown }
  if (!isValidPortfolio(portfolio)) return badRequest('Field "portfolio" is invalid.')
  const lastDay = getSandboxWindowLastDay()
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > lastDay) {
    return badRequest(`Field "day" must be a whole number between 0 and ${lastDay}.`)
  }
  const prices: Record<string, number> = {}
  for (const holding of portfolio.holdings) {
    prices[holding.symbol] = getSandboxClose(holding.symbol, day) ?? holding.averageCost
  }
  return ok(valuePortfolio(portfolio, prices))
})

route('POST', '/api/sandbox/portfolio/grade', async (_params, _query, body) => {
  const { state } = (body ?? {}) as { state?: unknown }
  if (!isValidSandboxPortfolioState(state)) return badRequest('Field "state" is invalid.')
  return ok(gradePortfolio({ missionId: state.missionId, asOfDay: state.dayCursor, trades: state.tradeLog }))
})

route('GET', '/api/sandbox/window-last-day', async () =>
  ok({ lastDay: getSandboxWindowLastDay(), freeformMissionId: SANDBOX_FREEFORM_MISSION_ID })
)

route('GET', '/api/sandbox/prices/:day', async (params) => {
  const day = Number(params.day)
  const lastDay = getSandboxWindowLastDay()
  if (!Number.isInteger(day) || day < 0 || day > lastDay) {
    return badRequest(`URL param "day" must be a whole number between 0 and ${lastDay}.`)
  }

  const window = getSandboxPriceWindow()
  const quotes: SandboxDayPriceQuote[] = []
  for (const symbol of Object.keys(window.seriesBySymbol)) {
    const series = window.seriesBySymbol[symbol]
    const point = series.find((candidate) => candidate.day === day)
    if (!point) continue
    const priorPoint = day > 0 ? series.find((candidate) => candidate.day === day - 1) : undefined
    const changePercent = priorPoint && priorPoint.close > 0 ? ((point.close - priorPoint.close) / priorPoint.close) * 100 : 0
    quotes.push({ symbol, close: point.close, date: point.date, changePercent })
  }

  const response: SandboxDayPricesResponse = { day, quotes }
  return ok(response)
})

// ---------------------------------------------------------------------------
// Decision Replay
// ---------------------------------------------------------------------------

route('GET', '/api/scenarios', async () => ok(listScenarios().map(getScenarioSummary)))

route('GET', '/api/scenarios/:id/stage/:n', async (params) => {
  const scenario = getScenario(params.id)
  if (!scenario) return notFound(`Scenario "${params.id}" was not found.`)
  const stageIndex = Number(params.n)
  const payload = getStagePayload(scenario, stageIndex)
  if (!payload) return notFound(`Stage "${params.n}" was not found for this scenario.`)
  return ok(payload)
})

route('POST', '/api/scenarios/:id/answer', async (params, _query, body) => {
  const scenario = getScenario(params.id)
  if (!scenario) return notFound(`Scenario "${params.id}" was not found.`)

  const { choiceId, selectedFactorIds, rationale } = (body ?? {}) as Partial<ScenarioAnswerRequest>
  if (typeof choiceId !== 'string' || !scenario.choices.some((choice) => choice.id === choiceId)) {
    return badRequest(`Field "choiceId" must be one of: ${scenario.choices.map((choice) => choice.id).join(', ')}.`)
  }
  if (!Array.isArray(selectedFactorIds) || selectedFactorIds.some((id) => typeof id !== 'string')) {
    return badRequest('Field "selectedFactorIds" must be an array of strings.')
  }
  if (selectedFactorIds.length > MAX_SELECTED_IDS) {
    return badRequest(`Field "selectedFactorIds" must contain ${MAX_SELECTED_IDS} or fewer entries.`)
  }
  if (rationale !== undefined && (typeof rationale !== 'string' || rationale.length > MAX_RATIONALE_LENGTH)) {
    return badRequest(`Field "rationale", if provided, must be a string of ${MAX_RATIONALE_LENGTH} characters or fewer.`)
  }

  const score = scoreDecision(scenario.rubric, choiceId, selectedFactorIds, rationale)
  const { entryPrice, exitPrice } = getDecisionPrices(scenario)
  const costBreakdown = calculateNetReturn({ entryPrice, exitPrice, quantity: 100 })

  const response: ScenarioAnswerResponse = {
    scoreTotal: score.scoreTotal,
    maxScore: score.maxScore,
    choiceQuality: score.choiceQuality,
    criteria: score.criteria,
    feedback: score.feedback,
    idealSummary: scenario.rubric.idealSummary,
    outcome: scenario.outcome,
    costBreakdown
  }
  return ok(response)
})

// ---------------------------------------------------------------------------
// Simulated Trading
// ---------------------------------------------------------------------------

route('POST', '/api/simulator/trade', async (_params, _query, body) => {
  const { portfolio, symbol, side, quantity, rationale } = (body ?? {}) as Partial<TradeRequest>

  if (!isValidPortfolio(portfolio)) return badRequest('Field "portfolio" is invalid.')
  if (typeof symbol !== 'string' || !symbol.trim()) return badRequest('Field "symbol" is required.')
  if (side !== 'buy' && side !== 'sell') return badRequest('Field "side" must be "buy" or "sell".')
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    return badRequest(`Field "quantity" must be a positive whole number up to ${MAX_QUANTITY}.`)
  }
  if (typeof rationale !== 'string' || !rationale.trim()) return badRequest('Field "rationale" is required.')
  if (rationale.length > MAX_RATIONALE_LENGTH) return badRequest(`Field "rationale" must be ${MAX_RATIONALE_LENGTH} characters or fewer.`)

  const upperSymbol = symbol.toUpperCase()
  const [quote] = await provider.getQuotes([upperSymbol])
  if (!quote) return notFound(`Symbol "${symbol}" was not found.`)

  const cost = calculateTradeCost({ price: quote.price, quantity, side })

  if (side === 'buy' && !canAffordBuy(portfolio, cost)) return badRequest('Insufficient virtual cash for this trade.')
  if (side === 'sell' && !hasSufficientHolding(portfolio, upperSymbol, quantity)) {
    return badRequest(`You don't hold enough ${upperSymbol} to sell ${quantity} shares.`)
  }

  const updatedPortfolio = applyTrade(portfolio, upperSymbol, side, quantity, cost)

  const profiles = await Promise.all(updatedPortfolio.holdings.map((holding) => provider.getProfile(holding.symbol)))
  const sectors: Record<string, string | null> = {}
  updatedPortfolio.holdings.forEach((holding, i) => {
    sectors[holding.symbol] = profiles[i]?.sector ?? null
  })

  const otherSymbols = updatedPortfolio.holdings.map((holding) => holding.symbol).filter((s) => s !== upperSymbol)
  const otherQuotes = otherSymbols.length > 0 ? await provider.getQuotes(otherSymbols) : []
  const prices: Record<string, number> = { [upperSymbol]: quote.price }
  otherQuotes.forEach((q) => {
    prices[q.symbol] = q.price
  })

  const positionSizeCheck = checkPositionSize(updatedPortfolio, prices, upperSymbol)
  const diversification = checkDiversification(updatedPortfolio, prices, sectors)

  const evaluation = await evaluateTradeRationale(rationale, upperSymbol, side)

  const criteria: RubricCriterionResult[] = TRADE_RUBRIC.map((criterion) => {
    if (criterion.id === 'position_sizing') {
      return {
        id: criterion.id,
        description: criterion.description,
        weight: criterion.weight,
        matched: positionSizeCheck.withinGuideline,
        evidence: `${positionSizeCheck.percentOfPortfolio.toFixed(1)}% of portfolio (guideline: ≤25%).`
      }
    }
    if (criterion.id === 'diversification') {
      return {
        id: criterion.id,
        description: criterion.description,
        weight: criterion.weight,
        matched: !diversification.concentratedSectorWarning,
        evidence: diversification.concentratedSectorWarning
          ? 'A single sector exceeds the 40% concentration guideline.'
          : 'No sector exceeds the concentration guideline.'
      }
    }
    const match = evaluation.criteriaMatches.find((m) => m.id === criterion.id)
    return { id: criterion.id, description: criterion.description, weight: criterion.weight, matched: match?.matched ?? false, evidence: match?.evidence }
  })

  const score = scoreTradeProcess(criteria)

  const trade: TradeRecord = {
    id: randomId(),
    symbol: upperSymbol,
    side,
    quantity,
    price: quote.price,
    costBreakdown: cost,
    rationale,
    timestamp: Date.now()
  }

  const response: TradeResponse = {
    trade,
    updatedPortfolio,
    positionSizeCheck,
    diversification,
    processScore: { scoreTotal: score.scoreTotal, maxScore: score.maxScore, criteria, feedback: evaluation.feedback }
  }
  return ok(response)
})

route('POST', '/api/simulator/portfolio/value', async (_params, _query, body) => {
  const { portfolio } = (body ?? {}) as { portfolio?: unknown }
  if (!isValidPortfolio(portfolio)) return badRequest('Field "portfolio" is invalid.')

  const symbols = portfolio.holdings.map((holding) => holding.symbol)
  const quotes = symbols.length > 0 ? await provider.getQuotes(symbols) : []
  const prices: Record<string, number> = {}
  quotes.forEach((quote) => {
    prices[quote.symbol] = quote.price
  })

  return ok(valuePortfolio(portfolio, prices))
})

// ---------------------------------------------------------------------------
// Tax Understanding
// ---------------------------------------------------------------------------

route('GET', '/api/tax/rate-set', async (_params, query) => {
  const date = typeof query.date === 'string' && query.date.trim() ? query.date : new Date().toISOString().slice(0, 10)
  if (!ISO_DATE_PATTERN.test(date)) return badRequest('Query param "date" must be an ISO date (YYYY-MM-DD).')
  const rateSet = getRateSetForDate(date)
  if (!rateSet) return badRequest(`No tax rate data is available for ${date}.`)
  return ok(rateSet)
})

route('POST', '/api/tax/compute', async (_params, _query, body) => {
  const validationError = validateTaxTradeInput((body as { trade?: unknown } | undefined)?.trade)
  if (validationError) return badRequest(validationError)
  const trade = (body as { trade: TaxTradeInput }).trade
  const rateSet = getRateSetForDate(trade.sellDate)
  if (!rateSet) return badRequest(`No tax rate data is available for ${trade.sellDate}.`)
  return ok(computeTax(trade, rateSet))
})

route('POST', '/api/tax/loss-harvesting', async (_params, _query, body) => {
  const { positions, realizedGains, asOfDate } = (body ?? {}) as { positions?: unknown; realizedGains?: unknown; asOfDate?: unknown }

  const positionsError = validateOpenLossPositions(positions)
  if (positionsError) return badRequest(positionsError)
  const gainsError = validateRealizedGains(realizedGains)
  if (gainsError) return badRequest(gainsError)
  if (typeof asOfDate !== 'string' || !ISO_DATE_PATTERN.test(asOfDate)) {
    return badRequest('Field "asOfDate" must be an ISO date (YYYY-MM-DD).')
  }
  const rateSet = getRateSetForDate(asOfDate)
  if (!rateSet) return badRequest(`No tax rate data is available for ${asOfDate}.`)
  return ok(computeLossHarvesting(positions as OpenLossPosition[], realizedGains as RealizedGainsThisFY, rateSet))
})

route('POST', '/api/tax/explain', async (_params, _query, body) => {
  const validationError = validateTaxTradeInput((body as { trade?: unknown } | undefined)?.trade)
  if (validationError) return badRequest(validationError)
  const trade = (body as { trade: TaxTradeInput }).trade
  const rateSet = getRateSetForDate(trade.sellDate)
  if (!rateSet) return badRequest(`No tax rate data is available for ${trade.sellDate}.`)
  const result = computeTax(trade, rateSet)
  const explanation = await explainTaxResult(trade, result)
  return ok({ result, explanation })
})

route('POST', '/api/tax/counterweight', async (_params, _query, body) => {
  const validationError = validateTaxTradeInput((body as { trade?: unknown } | undefined)?.trade)
  if (validationError) return badRequest(validationError)
  const trade = (body as { trade: TaxTradeInput }).trade
  if (trade.tradeType !== 'equity_delivery') {
    return badRequest('The days-to-long-term counter only applies to equity delivery trades - intraday and F&O never become long-term capital gains.')
  }

  const rateSetToday = getRateSetForDate(trade.sellDate)
  if (!rateSetToday) return badRequest(`No tax rate data is available for ${trade.sellDate}.`)

  const sellTodayResult = computeTax(trade, rateSetToday)
  if (sellTodayResult.classification === 'equity_delivery_long') {
    return badRequest('This position is already long-term - there is no cutoff left to wait for.')
  }

  const cutoffMonths = rateSetToday.holdingPeriod.listedEquityLongTermCutoffMonths
  const eligibleDate = longTermEligibleDate(trade.buyDate, cutoffMonths)
  const daysRemaining = daysUntilLongTerm(trade.buyDate, trade.sellDate, cutoffMonths)

  const rateSetAtEligibility = getRateSetForDate(eligibleDate) ?? rateSetToday
  const holdTrade: TaxTradeInput = { ...trade, sellDate: eligibleDate }
  const holdResult = computeTax(holdTrade, rateSetAtEligibility)
  const breakeven = computeBreakevenMove(trade, rateSetToday, holdTrade, rateSetAtEligibility)

  return ok({
    daysRemaining,
    longTermEligibleDate: eligibleDate,
    sellTodayResult,
    holdResult,
    breakeven,
    assumptionNote:
      'The "hold to long-term" figures assume tax rules stay the same between now and the eligibility date, and that the price does not move. Both can change - see the counterweight for what an adverse price move would cost.'
  })
})

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function dispatch(request: DispatchRequest): Promise<DispatchResponse> {
  if (request.method === 'GET' && request.path === '/health') {
    return ok({ ok: true, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) })
  }

  for (const candidate of routes) {
    if (candidate.method !== request.method) continue
    const match = candidate.pattern.exec(request.path)
    if (!match) continue
    const params: Record<string, string> = {}
    candidate.paramNames.forEach((name, i) => {
      params[name] = decodeURIComponent(match[i + 1])
    })
    try {
      return await candidate.handler(params, request.query, request.body)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected server error.'
      console.error('[mobileDispatch]', err)
      return { status: 500, body: { error: message } }
    }
  }

  return notFound('Not found.')
}
