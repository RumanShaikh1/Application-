import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
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
import type {
  CaseStudyTier,
  CaseStudyTierAnswer,
  CaseStudyTierAnswerResponse,
  ChartRange,
  DifficultyLevel,
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

const PORT = Number(process.env.PORT) || 8787
const CHART_RANGES: ChartRange[] = ['1w', '1mo', '3mo', '1y']

// No route talks to Yahoo directly - everything goes through this interface,
// wrapped in a TTL cache, so the data source can be swapped or mocked
// without touching route code.
const provider: MarketDataProvider = new CachingProvider(new YahooProvider())

const app = express()
// A fully permissive CORS policy here would let ANY website the user has
// open call these endpoints directly via fetch() from the page itself -
// not just through the extension - since this server binds to localhost
// and a browser will happily let page JS reach it. That's a more direct
// route to the same risk as the prompt-fencing below: a page could burn
// the user's Gemini quota or feed it fully attacker-controlled input with
// no highlight/interaction gate at all. The extension's background service
// worker sends an Origin of chrome-extension://<id>; the standalone web
// app's Vite dev server sends WEB_ORIGIN (default below); non-browser
// tooling (curl, tests) sends no Origin header at all and is unaffected.
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173'
// Real Chrome extension ids are always exactly 32 lowercase letters from the
// a-p alphabet (derived from the extension's public key) - a loose
// `startsWith('chrome-extension://')` check would also accept a non-browser
// caller that simply sets that header prefix by hand (a real browser can't
// forge this; curl or any raw HTTP client can). Bounding it to the actual
// id shape is cheap, precise allowlisting instead of a prefix match.
const CHROME_EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/
// Scoped to /api only, not applied globally - this exists to stop an
// arbitrary open webpage's fetch() from reaching the API, which is a real
// risk only for the API surface itself. The packaged desktop/mobile shells
// (see the static-serving block below) load the web app's own JS/CSS from
// this same server with the <script crossorigin>/<link crossorigin>
// attributes Vite adds by default - that makes the browser send an Origin
// header and enforce CORS even for a same-origin request, so a blanket
// app.use(cors(...)) here would 403 the app's own assets in every packaged
// build (caught by testing an actual browser against it - curl doesn't send
// an Origin header, so this false-passed under curl alone).
app.use(
  '/api',
  cors({
    origin: (origin, callback) => {
      if (!origin || CHROME_EXTENSION_ORIGIN.test(origin) || origin === WEB_ORIGIN) {
        callback(null, true)
      } else {
        callback(new Error('Origin not allowed.'))
      }
    }
  })
)
app.use(express.json())

const MAX_TEXT_LENGTH = 2000
const MAX_URL_LENGTH = 2000
const MAX_RATIONALE_LENGTH = 1500
const MAX_HOLDINGS = 50
const MAX_QUANTITY = 100_000
const MAX_LOSS_POSITIONS = 50
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
// Bounded generously above the real fixture count (currently 4) - a
// mismatched or padded answer list is a client bug, not a reason to 500.
const MAX_PLACEMENT_ANSWERS = 20
const MAX_SELECTED_IDS = 20

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next)
  }
}

// The portfolio travels in the request body and back on every call (no
// server-side session/account, same "no accounts, no database" stance as
// Decision Replay's client-persisted progress) - so it's untrusted input
// like anything else the client sends, and gets validated the same way.
function isValidPortfolio(value: unknown): value is Portfolio {
  if (!value || typeof value !== 'object') return false
  const portfolio = value as Partial<Portfolio>
  if (typeof portfolio.cashBalance !== 'number' || !Number.isFinite(portfolio.cashBalance) || portfolio.cashBalance < 0) return false
  if (!Array.isArray(portfolio.holdings) || portfolio.holdings.length > MAX_HOLDINGS) return false
  return portfolio.holdings.every(
    (holding) =>
      holding &&
      typeof holding.symbol === 'string' &&
      holding.symbol.trim().length > 0 &&
      typeof holding.quantity === 'number' &&
      holding.quantity > 0 &&
      holding.quantity <= MAX_QUANTITY &&
      typeof holding.averageCost === 'number' &&
      holding.averageCost >= 0
  )
}

const VALID_THESIS_TAGS = new Set<ThesisTag>(['trending_up', 'looks_cheap', 'heard_about_it', 'fits_mission_goal', 'other'])
const MAX_SANDBOX_TRADE_LOG = 500
// No mission-gating engine exists yet (narrowed universe, drawdown
// constraints are future work - see build notes) - every sandbox trade this
// endpoint handles is freeform, so state.missionId is always this constant
// for now rather than a real authored mission id.
const SANDBOX_FREEFORM_MISSION_ID = 'freeform'

function isValidThesisTag(value: unknown): value is ThesisTag {
  return typeof value === 'string' && VALID_THESIS_TAGS.has(value as ThesisTag)
}

// Same "travels in the request body, no server session" stance as
// isValidPortfolio - see that comment. tradeLog entries are server-produced
// round-tripped data (the client never hand-authors one), so they're bounded
// but not deeply re-validated field by field, the same trust level
// TradeRecord[] would get if the Simulator persisted trade history server-side.
function isValidSandboxPortfolioState(value: unknown): value is SandboxPortfolioState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<SandboxPortfolioState>
  if (typeof state.missionId !== 'string' || !state.missionId.trim()) return false
  if (!isValidPortfolio(state.portfolio)) return false
  const lastDay = getSandboxWindowLastDay()
  if (typeof state.dayCursor !== 'number' || !Number.isInteger(state.dayCursor) || state.dayCursor < 0 || state.dayCursor > lastDay) return false
  if (!Array.isArray(state.positionMeta) || state.positionMeta.length > MAX_HOLDINGS) return false
  const validPositionMeta = state.positionMeta.every(
    (meta) =>
      meta &&
      typeof meta.symbol === 'string' &&
      meta.symbol.trim().length > 0 &&
      typeof meta.entryDay === 'number' &&
      Number.isInteger(meta.entryDay) &&
      meta.entryDay >= 0 &&
      isValidThesisTag(meta.thesisTag)
  )
  if (!validPositionMeta) return false
  if (!Array.isArray(state.tradeLog) || state.tradeLog.length > MAX_SANDBOX_TRADE_LOG) return false
  return true
}

// Named per-field messages (not just a blanket "invalid") because these are
// user-entered numbers feeding a tax calculation - CLAUDE.md requires
// rejecting malformed input with a message naming the bad field, and that
// matters more here than most endpoints given "wrong tax numbers are a
// liability, not a bug."
function validateTaxTradeInput(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Field "trade" is required.'
  const t = value as Partial<TaxTradeInput>

  if (t.tradeType !== 'equity_delivery' && t.tradeType !== 'equity_intraday' && t.tradeType !== 'fno') {
    return 'Field "trade.tradeType" must be one of: equity_delivery, equity_intraday, fno.'
  }
  if (t.tradeType === 'fno' && t.fnoInstrument !== 'futures' && t.fnoInstrument !== 'options') {
    return 'Field "trade.fnoInstrument" must be "futures" or "options" when tradeType is "fno".'
  }
  if (typeof t.buyPrice !== 'number' || !Number.isFinite(t.buyPrice) || t.buyPrice <= 0) {
    return 'Field "trade.buyPrice" must be a positive number.'
  }
  if (typeof t.sellPrice !== 'number' || !Number.isFinite(t.sellPrice) || t.sellPrice <= 0) {
    return 'Field "trade.sellPrice" must be a positive number.'
  }
  if (typeof t.quantity !== 'number' || !Number.isInteger(t.quantity) || t.quantity <= 0 || t.quantity > MAX_QUANTITY) {
    return `Field "trade.quantity" must be a positive whole number up to ${MAX_QUANTITY}.`
  }
  if (typeof t.buyDate !== 'string' || !ISO_DATE_PATTERN.test(t.buyDate)) {
    return 'Field "trade.buyDate" must be an ISO date (YYYY-MM-DD).'
  }
  if (typeof t.sellDate !== 'string' || !ISO_DATE_PATTERN.test(t.sellDate)) {
    return 'Field "trade.sellDate" must be an ISO date (YYYY-MM-DD).'
  }
  if (t.sellDate < t.buyDate) {
    return 'Field "trade.sellDate" cannot be before "trade.buyDate".'
  }
  if (t.fairMarketValueJan312018 !== undefined && (typeof t.fairMarketValueJan312018 !== 'number' || t.fairMarketValueJan312018 <= 0)) {
    return 'Field "trade.fairMarketValueJan312018" must be a positive number when provided.'
  }
  if (t.incomeSlabRatePercent !== undefined && (typeof t.incomeSlabRatePercent !== 'number' || t.incomeSlabRatePercent < 0 || t.incomeSlabRatePercent > 100)) {
    return 'Field "trade.incomeSlabRatePercent" must be between 0 and 100 when provided.'
  }
  if (t.priorLongTermGainsThisFY !== undefined && (typeof t.priorLongTermGainsThisFY !== 'number' || t.priorLongTermGainsThisFY < 0)) {
    return 'Field "trade.priorLongTermGainsThisFY" must be zero or a positive number when provided.'
  }
  return null
}

function validateOpenLossPositions(value: unknown): string | null {
  if (!Array.isArray(value)) return 'Field "positions" must be an array.'
  if (value.length > MAX_LOSS_POSITIONS) return `Field "positions" must contain ${MAX_LOSS_POSITIONS} or fewer entries.`
  for (let i = 0; i < value.length; i++) {
    const p = value[i] as Partial<OpenLossPosition>
    if (!p || typeof p !== 'object') return `Field "positions[${i}]" is invalid.`
    if (typeof p.id !== 'string' || !p.id.trim()) return `Field "positions[${i}].id" is required.`
    if (typeof p.label !== 'string' || !p.label.trim()) return `Field "positions[${i}].label" is required.`
    if (typeof p.unrealizedLossAmount !== 'number' || !Number.isFinite(p.unrealizedLossAmount) || p.unrealizedLossAmount < 0) {
      return `Field "positions[${i}].unrealizedLossAmount" must be zero or a positive number.`
    }
    if (p.classification !== 'short_term' && p.classification !== 'long_term') {
      return `Field "positions[${i}].classification" must be "short_term" or "long_term".`
    }
  }
  return null
}

function validateRealizedGains(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Field "realizedGains" is required.'
  const g = value as Partial<RealizedGainsThisFY>
  if (typeof g.shortTermGains !== 'number' || !Number.isFinite(g.shortTermGains) || g.shortTermGains < 0) {
    return 'Field "realizedGains.shortTermGains" must be zero or a positive number.'
  }
  if (typeof g.longTermGains !== 'number' || !Number.isFinite(g.longTermGains) || g.longTermGains < 0) {
    return 'Field "realizedGains.longTermGains" must be zero or a positive number.'
  }
  return null
}

function validatePlacementAnswers(value: unknown): string | null {
  if (!Array.isArray(value)) return 'Field "answers" must be an array.'
  if (value.length > MAX_PLACEMENT_ANSWERS) return `Field "answers" must contain ${MAX_PLACEMENT_ANSWERS} or fewer entries.`

  for (let i = 0; i < value.length; i++) {
    const a = value[i] as Partial<PlacementAnswer>
    if (!a || typeof a !== 'object') return `Field "answers[${i}]" is invalid.`
    if (typeof a.miniScenarioId !== 'string' || !a.miniScenarioId.trim()) return `Field "answers[${i}].miniScenarioId" is required.`
    if (typeof a.selectedReadId !== 'string' || !a.selectedReadId.trim()) return `Field "answers[${i}].selectedReadId" is required.`
    if (!Array.isArray(a.selectedFactorIds) || a.selectedFactorIds.some((id) => typeof id !== 'string')) {
      return `Field "answers[${i}].selectedFactorIds" must be an array of strings.`
    }
    if (a.selectedFactorIds.length > MAX_SELECTED_IDS) return `Field "answers[${i}].selectedFactorIds" must contain ${MAX_SELECTED_IDS} or fewer entries.`
  }
  return null
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) })
})

app.post(
  '/api/translate',
  asyncRoute(async (req, res) => {
    const { text, sourceUrl, simplifyFurther } = req.body as Partial<TranslateRequest>
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Field "text" is required.' })
      return
    }
    if (text.length > MAX_TEXT_LENGTH) {
      res.status(400).json({ error: `Field "text" must be ${MAX_TEXT_LENGTH} characters or fewer.` })
      return
    }
    if (typeof sourceUrl === 'string' && sourceUrl.length > MAX_URL_LENGTH) {
      res.status(400).json({ error: `Field "sourceUrl" must be ${MAX_URL_LENGTH} characters or fewer.` })
      return
    }
    const result = await translateTerm({ text, sourceUrl, simplifyFurther })
    res.json({ result })
  })
)

app.post(
  '/api/context',
  asyncRoute(async (req, res) => {
    const { symbol, name, headlines } = req.body as Partial<StockContextRequest>
    if (typeof symbol !== 'string' || !symbol.trim()) {
      res.status(400).json({ error: 'Field "symbol" is required.' })
      return
    }
    // Only string entries, and bounded - this endpoint trusts whatever
    // headlines the caller sends rather than refetching them itself, so a
    // direct caller (bypassing the extension's own Yahoo-sourced fetch)
    // could otherwise hand it an arbitrarily large or malformed array.
    const safeHeadlines = Array.isArray(headlines)
      ? headlines.filter((h): h is string => typeof h === 'string' && h.length <= MAX_TEXT_LENGTH).slice(0, 20)
      : []
    const result = await explainStockContext({
      symbol,
      name: name ?? symbol,
      headlines: safeHeadlines
    })
    res.json({ result })
  })
)

app.get(
  '/api/stats',
  asyncRoute(async (req, res) => {
    const symbolsParam = req.query.symbols
    const symbols = typeof symbolsParam === 'string' ? symbolsParam.split(',').filter(Boolean) : []
    const result = await provider.getQuotes(symbols)
    res.json(result)
  })
)

app.get(
  '/api/profile/:symbol',
  asyncRoute(async (req, res) => {
    const result = await provider.getProfile(req.params.symbol)
    res.json(result)
  })
)

app.get(
  '/api/news/:symbol',
  asyncRoute(async (req, res) => {
    const result = await provider.getNews(req.params.symbol)
    res.json(result)
  })
)

app.get(
  '/api/chart/:symbol',
  asyncRoute(async (req, res) => {
    const range = req.query.range
    if (typeof range !== 'string' || !CHART_RANGES.includes(range as ChartRange)) {
      res.status(400).json({ error: `Query param "range" must be one of: ${CHART_RANGES.join(', ')}.` })
      return
    }
    const result = await provider.getHistoricalPrices(req.params.symbol, range as ChartRange)
    res.json(result)
  })
)

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------
// Deterministic, local, instant - no Gemini call in this path, ever (see
// CLAUDE.md's Product Invariants). Stateless like everything else here: the
// client submits all mini-scenario answers in one request and gets a level
// back - there's no server-side placement "session" to track.

app.get('/api/placement', (_req, res) => {
  res.json(getPlacementPayload(listPlacementMiniScenarios()))
})

app.post(
  '/api/placement/answer',
  asyncRoute(async (req, res) => {
    const { answers } = req.body as { answers?: unknown }
    const validationError = validatePlacementAnswers(answers)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }
    const result = evaluatePlacement(listPlacementMiniScenarios(), answers as PlacementAnswer[])
    res.json(result)
  })
)

// ---------------------------------------------------------------------------
// Case studies (Part A)
// ---------------------------------------------------------------------------
// Same "no API in the grading path" rule as placement - every tier grades
// through evaluateCaseStudyTier -> the shared grader, never Gemini. The real
// identity/dates (the post-answer debrief) are attached to a response only
// once the caller has just answered the last tier their level unlocks -
// never in any GET response, and never before that final grading.

const DIFFICULTY_LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced']

/** Missing `level` defaults to beginner - "bias placement and re-leveling downward" (CLAUDE.md) extends to an unspecified level never being treated as anything higher. An explicitly invalid value is still a 400, not silently coerced. */
function parseLevel(value: unknown): DifficultyLevel | null {
  if (value === undefined) return 'beginner'
  return typeof value === 'string' && DIFFICULTY_LEVELS.includes(value as DifficultyLevel) ? (value as DifficultyLevel) : null
}

function validateCaseStudyTierAnswer(body: Record<string, unknown>, tier: CaseStudyTier): { answer: CaseStudyTierAnswer } | { error: string } {
  if (tier.kind === 'risk_read') {
    if (typeof body.selectedReadId !== 'string' || !body.selectedReadId.trim()) return { error: 'Field "selectedReadId" is required.' }
    if (!Array.isArray(body.selectedFactorIds) || body.selectedFactorIds.some((id) => typeof id !== 'string')) {
      return { error: 'Field "selectedFactorIds" must be an array of strings.' }
    }
    if (body.selectedFactorIds.length > MAX_SELECTED_IDS) return { error: `Field "selectedFactorIds" must contain ${MAX_SELECTED_IDS} or fewer entries.` }
    return { answer: { kind: 'risk_read', tierId: tier.id, selectedReadId: body.selectedReadId, selectedFactorIds: body.selectedFactorIds as string[] } }
  }

  if (tier.kind === 'sizing') {
    if (typeof body.selectedBucketId !== 'string' || !tier.buckets.some((bucket) => bucket.id === body.selectedBucketId)) {
      return { error: `Field "selectedBucketId" must be one of: ${tier.buckets.map((bucket) => bucket.id).join(', ')}.` }
    }
    if (!Array.isArray(body.selectedReasonFactorIds) || body.selectedReasonFactorIds.some((id) => typeof id !== 'string')) {
      return { error: 'Field "selectedReasonFactorIds" must be an array of strings.' }
    }
    if (body.selectedReasonFactorIds.length > MAX_SELECTED_IDS) {
      return { error: `Field "selectedReasonFactorIds" must contain ${MAX_SELECTED_IDS} or fewer entries.` }
    }
    return {
      answer: { kind: 'sizing', tierId: tier.id, selectedBucketId: body.selectedBucketId, selectedReasonFactorIds: body.selectedReasonFactorIds as string[] }
    }
  }

  // instrument
  if (typeof body.selectedMaxLossOptionId !== 'string' || !body.selectedMaxLossOptionId.trim()) {
    return { error: 'Field "selectedMaxLossOptionId" is required.' }
  }
  if (body.selectedInstrumentOptionId !== undefined && typeof body.selectedInstrumentOptionId !== 'string') {
    return { error: 'Field "selectedInstrumentOptionId", if provided, must be a string.' }
  }
  if (body.selectedExitFactorIds !== undefined) {
    if (!Array.isArray(body.selectedExitFactorIds) || body.selectedExitFactorIds.some((id) => typeof id !== 'string')) {
      return { error: 'Field "selectedExitFactorIds", if provided, must be an array of strings.' }
    }
    if (body.selectedExitFactorIds.length > MAX_SELECTED_IDS) {
      return { error: `Field "selectedExitFactorIds" must contain ${MAX_SELECTED_IDS} or fewer entries.` }
    }
  }
  return {
    answer: {
      kind: 'instrument',
      tierId: tier.id,
      selectedMaxLossOptionId: body.selectedMaxLossOptionId,
      selectedInstrumentOptionId: body.selectedInstrumentOptionId as string | undefined,
      selectedExitFactorIds: body.selectedExitFactorIds as string[] | undefined
    }
  }
}

app.get('/api/case-studies', (_req, res) => {
  res.json(listCaseStudies().map((caseStudy) => ({ id: caseStudy.id, title: caseStudy.title })))
})

app.get('/api/case-studies/:id', (req, res) => {
  const caseStudy = findCaseStudy(req.params.id)
  if (!caseStudy) {
    res.status(404).json({ error: `Case study "${req.params.id}" was not found.` })
    return
  }
  const level = parseLevel(req.query.level)
  if (level === null) {
    res.status(400).json({ error: `Query param "level" must be one of: ${DIFFICULTY_LEVELS.join(', ')}.` })
    return
  }
  res.json(getCaseStudyPayload(caseStudy, level))
})

app.post(
  '/api/case-studies/:id/facts/:factId/reveal',
  asyncRoute(async (req, res) => {
    const caseStudy = findCaseStudy(req.params.id)
    if (!caseStudy) {
      res.status(404).json({ error: `Case study "${req.params.id}" was not found.` })
      return
    }
    const level = parseLevel((req.body as { level?: unknown } | undefined)?.level)
    if (level === null) {
      res.status(400).json({ error: `Field "level" must be one of: ${DIFFICULTY_LEVELS.join(', ')}.` })
      return
    }
    const fact = revealCaseStudyFact(caseStudy, level, req.params.factId)
    if (!fact) {
      res.status(404).json({ error: `Fact "${req.params.factId}" is not available to look up at this level.` })
      return
    }
    res.json(fact)
  })
)

app.post(
  '/api/case-studies/:id/tiers/:tierId/answer',
  asyncRoute(async (req, res) => {
    const caseStudy = findCaseStudy(req.params.id)
    if (!caseStudy) {
      res.status(404).json({ error: `Case study "${req.params.id}" was not found.` })
      return
    }

    const body = (req.body ?? {}) as Record<string, unknown>
    const level = parseLevel(body.level)
    if (level === null) {
      res.status(400).json({ error: `Field "level" must be one of: ${DIFFICULTY_LEVELS.join(', ')}.` })
      return
    }

    const tierIndex = caseStudy.tiers.findIndex((tier) => tier.id === req.params.tierId)
    if (tierIndex === -1) {
      res.status(404).json({ error: `Tier "${req.params.tierId}" was not found on this case study.` })
      return
    }

    // Gated server-side, not just in the UI - a level never gets to grade a
    // tier its own placement hasn't unlocked, even by calling this directly.
    const visibleTierCount = Math.min(caseStudy.tiers.length, CASE_STUDY_LEVEL_TIER_CAP[level])
    if (tierIndex >= visibleTierCount) {
      res.status(403).json({ error: `Tier "${req.params.tierId}" is not unlocked at the "${level}" level.` })
      return
    }

    const tier = caseStudy.tiers[tierIndex]
    if (body.kind !== tier.kind) {
      res.status(400).json({ error: `Field "kind" must be "${tier.kind}" for this tier.` })
      return
    }

    const validated = validateCaseStudyTierAnswer(body, tier)
    if ('error' in validated) {
      res.status(400).json({ error: validated.error })
      return
    }

    const tierResult = evaluateCaseStudyTier(tier, validated.answer)
    const isFinalTierForLevel = tierIndex === visibleTierCount - 1
    // An instrument tier's gate is never skippable: a wrong max-loss answer
    // means the tier isn't actually done yet, even if it's positionally
    // last, so the debrief must wait for a real (gate-passed) completion -
    // otherwise revealing "what actually happened" right after a wrong
    // answer would short-circuit the whole point of making the user retry.
    const tierGenuinelyComplete = tierResult.kind !== 'instrument' || tierResult.result.gatePassed
    const revealDebrief = isFinalTierForLevel && tierGenuinelyComplete

    const response: CaseStudyTierAnswerResponse = {
      tierResult,
      isFinalTierForLevel,
      ...(revealDebrief ? { identity: caseStudy.identity } : {})
    }
    res.json(response)
  })
)

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------
// Fixtures + deterministic engine only - no live call, ever, anywhere in
// this section (see CLAUDE.md's Sandbox invariants). Stateless like the
// Simulator above: SandboxPortfolioState travels in the request body and
// back, no server-side session. Trading is currently freeform (no mission's
// narrowed universe or constraints enforced yet - see SANDBOX_FREEFORM_MISSION_ID).

app.get('/api/sandbox/companies', (_req, res) => {
  res.json(getSandboxFundamentals())
})

app.get('/api/sandbox/companies/:symbol', (req, res) => {
  const company = findSandboxCompany(req.params.symbol)
  if (!company) {
    res.status(404).json({ error: `No sandbox company found for symbol "${req.params.symbol}".` })
    return
  }
  // null, not a 404 or a fabricated placeholder - not every one of the 20
  // has in-depth analysis authored yet, and that's shown honestly. The
  // price series, unlike analysis, is real and available for all 20 -
  // prices.json already covers the whole basket.
  const analysis = findStockAnalysis(company.symbol) ?? null
  const priceSeries = getSandboxPriceWindow().seriesBySymbol[company.symbol] ?? []
  const response: SandboxCompanyDetail = { company, analysis, priceSeries, fundamentalsAsOfDate: getSandboxFundamentals().asOfDate }
  res.json(response)
})

app.post(
  '/api/sandbox/trade',
  asyncRoute(async (req, res) => {
    const { state, symbol, side, quantity, thesisTag } = req.body as Partial<SandboxTradeRequest>

    if (!isValidSandboxPortfolioState(state)) {
      res.status(400).json({ error: 'Field "state" is invalid.' })
      return
    }
    if (typeof symbol !== 'string' || !symbol.trim()) {
      res.status(400).json({ error: 'Field "symbol" is required.' })
      return
    }
    if (side !== 'buy' && side !== 'sell') {
      res.status(400).json({ error: 'Field "side" must be "buy" or "sell".' })
      return
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
      res.status(400).json({ error: `Field "quantity" must be a positive whole number up to ${MAX_QUANTITY}.` })
      return
    }

    const upperSymbol = symbol.toUpperCase()
    const company = findSandboxCompany(upperSymbol)
    if (!company) {
      res.status(404).json({ error: `No sandbox company found for symbol "${symbol}".` })
      return
    }

    const existingMeta = findPositionMeta(state.positionMeta, upperSymbol)
    if (side === 'buy' && !existingMeta && !isValidThesisTag(thesisTag)) {
      res.status(400).json({ error: 'Field "thesisTag" is required to open a new position and must be one of the recognised reasons.' })
      return
    }

    const closePrice = getSandboxClose(upperSymbol, state.dayCursor)
    if (closePrice === undefined) {
      res.status(400).json({ error: `No price available for "${symbol}" on day ${state.dayCursor}.` })
      return
    }

    const cost = calculateTradeCost({ price: closePrice, quantity, side })

    if (side === 'buy' && !canAffordBuy(state.portfolio, cost)) {
      res.status(400).json({ error: 'Insufficient virtual cash for this trade.' })
      return
    }
    if (side === 'sell' && !hasSufficientHolding(state.portfolio, upperSymbol, quantity)) {
      res.status(400).json({ error: `You don't hold enough ${upperSymbol} to sell ${quantity} shares.` })
      return
    }

    // Prices/sectors for every CURRENT holding at this day cursor - needed
    // both to price the trade's before/after snapshot for the process
    // signals, and because checkDiversification/checkPositionSize (reused
    // from the Simulator's portfolioEngine.ts unmodified) need a full map.
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

    // The trade record's own thesisTag is what was just submitted on a buy,
    // or the position's original entry thesis carried through on a sell -
    // there's no "why are you selling" prompt in this pass.
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
      id: randomUUID(),
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
    res.json(response)
  })
)

app.post(
  '/api/sandbox/portfolio/value',
  asyncRoute(async (req, res) => {
    const { portfolio, day } = req.body as { portfolio?: unknown; day?: unknown }
    if (!isValidPortfolio(portfolio)) {
      res.status(400).json({ error: 'Field "portfolio" is invalid.' })
      return
    }
    const lastDay = getSandboxWindowLastDay()
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > lastDay) {
      res.status(400).json({ error: `Field "day" must be a whole number between 0 and ${lastDay}.` })
      return
    }

    const prices: Record<string, number> = {}
    for (const holding of portfolio.holdings) {
      prices[holding.symbol] = getSandboxClose(holding.symbol, day) ?? holding.averageCost
    }
    res.json(valuePortfolio(portfolio, prices))
  })
)

app.post(
  '/api/sandbox/portfolio/grade',
  asyncRoute(async (req, res) => {
    const { state } = req.body as { state?: unknown }
    if (!isValidSandboxPortfolioState(state)) {
      res.status(400).json({ error: 'Field "state" is invalid.' })
      return
    }
    res.json(gradePortfolio({ missionId: state.missionId, asOfDay: state.dayCursor, trades: state.tradeLog }))
  })
)

app.get('/api/sandbox/window-last-day', (_req, res) => {
  res.json({ lastDay: getSandboxWindowLastDay(), freeformMissionId: SANDBOX_FREEFORM_MISSION_ID })
})

app.get('/api/sandbox/prices/:day', (req, res) => {
  const day = Number(req.params.day)
  const lastDay = getSandboxWindowLastDay()
  if (!Number.isInteger(day) || day < 0 || day > lastDay) {
    res.status(400).json({ error: `URL param "day" must be a whole number between 0 and ${lastDay}.` })
    return
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
  res.json(response)
})

// ---------------------------------------------------------------------------
// Decision Replay
// ---------------------------------------------------------------------------

app.get('/api/scenarios', (_req, res) => {
  res.json(listScenarios().map(getScenarioSummary))
})

app.get('/api/scenarios/:id/stage/:n', (req, res) => {
  const scenario = getScenario(req.params.id)
  if (!scenario) {
    res.status(404).json({ error: `Scenario "${req.params.id}" was not found.` })
    return
  }

  const stageIndex = Number(req.params.n)
  const payload = getStagePayload(scenario, stageIndex)
  if (!payload) {
    res.status(404).json({ error: `Stage "${req.params.n}" was not found for this scenario.` })
    return
  }

  res.json(payload)
})

app.post(
  '/api/scenarios/:id/answer',
  asyncRoute(async (req, res) => {
    const scenario = getScenario(req.params.id)
    if (!scenario) {
      res.status(404).json({ error: `Scenario "${req.params.id}" was not found.` })
      return
    }

    const { choiceId, selectedFactorIds, rationale } = req.body as Partial<ScenarioAnswerRequest>
    if (typeof choiceId !== 'string' || !scenario.choices.some((choice) => choice.id === choiceId)) {
      res.status(400).json({
        error: `Field "choiceId" must be one of: ${scenario.choices.map((choice) => choice.id).join(', ')}.`
      })
      return
    }
    if (!Array.isArray(selectedFactorIds) || selectedFactorIds.some((id) => typeof id !== 'string')) {
      res.status(400).json({ error: 'Field "selectedFactorIds" must be an array of strings.' })
      return
    }
    if (selectedFactorIds.length > MAX_SELECTED_IDS) {
      res.status(400).json({ error: `Field "selectedFactorIds" must contain ${MAX_SELECTED_IDS} or fewer entries.` })
      return
    }
    if (rationale !== undefined && (typeof rationale !== 'string' || rationale.length > MAX_RATIONALE_LENGTH)) {
      res.status(400).json({ error: `Field "rationale", if provided, must be a string of ${MAX_RATIONALE_LENGTH} characters or fewer.` })
      return
    }

    // Local, deterministic scoring - no Gemini call, no API cost. The
    // factor multi-select is the load-bearing rationale signal; free-text
    // rationale (optional) only contributes the small capped bonus inside
    // scoreDecision - see rubricScoring.ts.
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
    res.json(response)
  })
)

// ---------------------------------------------------------------------------
// Simulated Trading
// ---------------------------------------------------------------------------
// Stateless like everything above - the portfolio travels in the request
// body and back, no server-side session/account. Live quotes/profiles come
// from the same `provider` (and its TTL cache) the routes above already use.

app.post(
  '/api/simulator/trade',
  asyncRoute(async (req, res) => {
    const { portfolio, symbol, side, quantity, rationale } = req.body as Partial<TradeRequest>

    if (!isValidPortfolio(portfolio)) {
      res.status(400).json({ error: 'Field "portfolio" is invalid.' })
      return
    }
    if (typeof symbol !== 'string' || !symbol.trim()) {
      res.status(400).json({ error: 'Field "symbol" is required.' })
      return
    }
    if (side !== 'buy' && side !== 'sell') {
      res.status(400).json({ error: 'Field "side" must be "buy" or "sell".' })
      return
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
      res.status(400).json({ error: `Field "quantity" must be a positive whole number up to ${MAX_QUANTITY}.` })
      return
    }
    if (typeof rationale !== 'string' || !rationale.trim()) {
      res.status(400).json({ error: 'Field "rationale" is required.' })
      return
    }
    if (rationale.length > MAX_RATIONALE_LENGTH) {
      res.status(400).json({ error: `Field "rationale" must be ${MAX_RATIONALE_LENGTH} characters or fewer.` })
      return
    }

    const upperSymbol = symbol.toUpperCase()
    const [quote] = await provider.getQuotes([upperSymbol])
    if (!quote) {
      res.status(404).json({ error: `Symbol "${symbol}" was not found.` })
      return
    }

    const cost = calculateTradeCost({ price: quote.price, quantity, side })

    if (side === 'buy' && !canAffordBuy(portfolio, cost)) {
      res.status(400).json({ error: 'Insufficient virtual cash for this trade.' })
      return
    }
    if (side === 'sell' && !hasSufficientHolding(portfolio, upperSymbol, quantity)) {
      res.status(400).json({ error: `You don't hold enough ${upperSymbol} to sell ${quantity} shares.` })
      return
    }

    const updatedPortfolio = applyTrade(portfolio, upperSymbol, side, quantity, cost)

    // Sector data for every resulting holding (cached via CachingProvider already).
    const profiles = await Promise.all(updatedPortfolio.holdings.map((holding) => provider.getProfile(holding.symbol)))
    const sectors: Record<string, string | null> = {}
    updatedPortfolio.holdings.forEach((holding, i) => {
      sectors[holding.symbol] = profiles[i]?.sector ?? null
    })

    // Prices for valuation: the symbol just traded, plus every other current holding.
    const otherSymbols = updatedPortfolio.holdings.map((holding) => holding.symbol).filter((s) => s !== upperSymbol)
    const otherQuotes = otherSymbols.length > 0 ? await provider.getQuotes(otherSymbols) : []
    const prices: Record<string, number> = { [upperSymbol]: quote.price }
    otherQuotes.forEach((q) => {
      prices[q.symbol] = q.price
    })

    const positionSizeCheck = checkPositionSize(updatedPortfolio, prices, upperSymbol)
    const diversification = checkDiversification(updatedPortfolio, prices, sectors)

    // Gemini only ever classifies the two rationale-dependent criteria
    // (enforced by the response schema, then re-validated) - it never sees
    // or produces position_sizing/diversification, and never produces the
    // score itself. See scoreTradeProcess for the deterministic math.
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
      id: randomUUID(),
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
    res.json(response)
  })
)

app.post(
  '/api/simulator/portfolio/value',
  asyncRoute(async (req, res) => {
    const { portfolio } = req.body as { portfolio?: unknown }
    if (!isValidPortfolio(portfolio)) {
      res.status(400).json({ error: 'Field "portfolio" is invalid.' })
      return
    }

    const symbols = portfolio.holdings.map((holding) => holding.symbol)
    const quotes = symbols.length > 0 ? await provider.getQuotes(symbols) : []
    const prices: Record<string, number> = {}
    quotes.forEach((quote) => {
      prices[quote.symbol] = quote.price
    })

    res.json(valuePortfolio(portfolio, prices))
  })
)

// ---------------------------------------------------------------------------
// Tax Understanding
// ---------------------------------------------------------------------------
// Every number below comes from server/src/tax/ - deterministic, dependency-
// free, and driven entirely by server/data/tax-rates/*.json (see CLAUDE.md's
// Product Invariants). /api/tax/explain is the one route that calls Gemini,
// and only to phrase an already-computed result in plain English - it
// recomputes the result server-side from the validated trade rather than
// trusting a client-supplied result, so the explanation can never end up
// narrating a fabricated number.

app.get(
  '/api/tax/rate-set',
  asyncRoute(async (req, res) => {
    const dateParam = req.query.date
    const date = typeof dateParam === 'string' && dateParam.trim() ? dateParam : new Date().toISOString().slice(0, 10)
    if (!ISO_DATE_PATTERN.test(date)) {
      res.status(400).json({ error: 'Query param "date" must be an ISO date (YYYY-MM-DD).' })
      return
    }
    const rateSet = getRateSetForDate(date)
    if (!rateSet) {
      res.status(400).json({ error: `No tax rate data is available for ${date}.` })
      return
    }
    res.json(rateSet)
  })
)

app.post(
  '/api/tax/compute',
  asyncRoute(async (req, res) => {
    const validationError = validateTaxTradeInput((req.body as { trade?: unknown })?.trade)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }
    const trade = (req.body as { trade: TaxTradeInput }).trade
    const rateSet = getRateSetForDate(trade.sellDate)
    if (!rateSet) {
      res.status(400).json({ error: `No tax rate data is available for ${trade.sellDate}.` })
      return
    }
    res.json(computeTax(trade, rateSet))
  })
)

app.post(
  '/api/tax/loss-harvesting',
  asyncRoute(async (req, res) => {
    const { positions, realizedGains, asOfDate } = req.body as { positions?: unknown; realizedGains?: unknown; asOfDate?: unknown }

    const positionsError = validateOpenLossPositions(positions)
    if (positionsError) {
      res.status(400).json({ error: positionsError })
      return
    }
    const gainsError = validateRealizedGains(realizedGains)
    if (gainsError) {
      res.status(400).json({ error: gainsError })
      return
    }
    if (typeof asOfDate !== 'string' || !ISO_DATE_PATTERN.test(asOfDate)) {
      res.status(400).json({ error: 'Field "asOfDate" must be an ISO date (YYYY-MM-DD).' })
      return
    }
    const rateSet = getRateSetForDate(asOfDate)
    if (!rateSet) {
      res.status(400).json({ error: `No tax rate data is available for ${asOfDate}.` })
      return
    }
    res.json(computeLossHarvesting(positions as OpenLossPosition[], realizedGains as RealizedGainsThisFY, rateSet))
  })
)

app.post(
  '/api/tax/explain',
  asyncRoute(async (req, res) => {
    const validationError = validateTaxTradeInput((req.body as { trade?: unknown })?.trade)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }
    const trade = (req.body as { trade: TaxTradeInput }).trade
    const rateSet = getRateSetForDate(trade.sellDate)
    if (!rateSet) {
      res.status(400).json({ error: `No tax rate data is available for ${trade.sellDate}.` })
      return
    }
    const result = computeTax(trade, rateSet)
    const explanation = await explainTaxResult(trade, result)
    res.json({ result, explanation })
  })
)

app.post(
  '/api/tax/counterweight',
  asyncRoute(async (req, res) => {
    // "trade" here is the sell-today scenario: sellDate is treated as
    // "today" and sellPrice as the current price. The days-to-long-term
    // counter and its counterweight only mean anything for a still-short-
    // term equity delivery position - see CLAUDE.md's Product Invariants
    // ("do not ship the counter without the counterweight").
    const validationError = validateTaxTradeInput((req.body as { trade?: unknown })?.trade)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }
    const trade = (req.body as { trade: TaxTradeInput }).trade
    if (trade.tradeType !== 'equity_delivery') {
      res.status(400).json({ error: 'The days-to-long-term counter only applies to equity delivery trades - intraday and F&O never become long-term capital gains.' })
      return
    }

    const rateSetToday = getRateSetForDate(trade.sellDate)
    if (!rateSetToday) {
      res.status(400).json({ error: `No tax rate data is available for ${trade.sellDate}.` })
      return
    }

    const sellTodayResult = computeTax(trade, rateSetToday)
    if (sellTodayResult.classification === 'equity_delivery_long') {
      res.status(400).json({ error: 'This position is already long-term - there is no cutoff left to wait for.' })
      return
    }

    const cutoffMonths = rateSetToday.holdingPeriod.listedEquityLongTermCutoffMonths
    const eligibleDate = longTermEligibleDate(trade.buyDate, cutoffMonths)
    const daysRemaining = daysUntilLongTerm(trade.buyDate, trade.sellDate, cutoffMonths)

    // Best available rate set for the future eligibility date is today's
    // - we have no way to know a rate change that hasn't happened yet.
    // Flagged in the response rather than assumed silently.
    const rateSetAtEligibility = getRateSetForDate(eligibleDate) ?? rateSetToday
    const holdTrade: TaxTradeInput = { ...trade, sellDate: eligibleDate }
    const holdResult = computeTax(holdTrade, rateSetAtEligibility)
    const breakeven = computeBreakevenMove(trade, rateSetToday, holdTrade, rateSetAtEligibility)

    res.json({
      daysRemaining,
      longTermEligibleDate: eligibleDate,
      sellTodayResult,
      holdResult,
      breakeven,
      assumptionNote: 'The "hold to long-term" figures assume tax rules stay the same between now and the eligibility date, and that the price does not move. Both can change - see the counterweight for what an adverse price move would cost.'
    })
  })
)

// ---------------------------------------------------------------------------
// Packaged web app (desktop/mobile shells)
// ---------------------------------------------------------------------------
// Local dev never hits this: the web app is reached through Vite's own dev
// server on WEB_ORIGIN instead. This only activates for a packaged build
// (MarketPane.Desktop, the macOS launcher, the Android shell), each of which
// ships a `vite build` output alongside this bundled server and points
// WEB_DIST_PATH at it (or, for a from-source checkout with `web/dist`
// already built, this falls back to finding it next to the repo's own
// web/ folder) - letting one process serve both the API and the app on a
// single origin instead of requiring a second dev-server process.
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const webDistPath = process.env.WEB_DIST_PATH || path.join(currentDir, '..', '..', 'web', 'dist')
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath))
  app.get(/^(?!\/api|\/health).*/, (_req, res) => {
    res.sendFile(path.join(webDistPath, 'index.html'))
  })
}

// No route matched - Express's own default here is an HTML "Cannot GET
// /whatever" page, which breaks the "consistent JSON error shape across
// every endpoint" contract the moment a client hits a typo'd path or wrong
// method.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found.' })
})

// Keep error bodies safe/structured - the underlying error is logged
// server-side, but only a safe message (never a raw stack, and never a raw
// library error string) reaches the client.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unexpected server error.'
  // A rejected CORS origin is a policy decision, not a server malfunction -
  // 403 reflects that correctly instead of a misleading 500.
  if (message === 'Origin not allowed.') {
    res.status(403).json({ error: message })
    return
  }
  // express.json() throws for unparsable bodies (status 400) and
  // oversized ones (status 413) *before* any route handler runs - these are
  // client mistakes, not server malfunctions, and the thrown error's own
  // `.message` (e.g. a raw JSON-parser position string) is an internal
  // detail, not something to hand back verbatim.
  const bodyParserStatus = (err as { status?: unknown; statusCode?: unknown })?.status ?? (err as { statusCode?: unknown })?.statusCode
  if (bodyParserStatus === 400) {
    res.status(400).json({ error: 'Request body is not valid JSON.' })
    return
  }
  if (bodyParserStatus === 413) {
    res.status(413).json({ error: 'Request body is too large.' })
    return
  }
  console.error('[server]', err)
  res.status(500).json({ error: message })
})

app.listen(PORT, () => {
  console.log(`MarketPane server listening on http://localhost:${PORT}`)
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[server] GEMINI_API_KEY is not set - translation and context features will fail until it is added to server/.env')
  }
})
