import type {
  CaseStudyTier,
  CaseStudyTierAnswer,
  DifficultyLevel,
  OpenLossPosition,
  PlacementAnswer,
  Portfolio,
  RealizedGainsThisFY,
  SandboxPortfolioState,
  TaxTradeInput,
  ThesisTag
} from '../../shared/types.js'
import { getSandboxWindowLastDay } from './sandbox/loadSandboxData.js'

export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced']

// Shared between server/src/index.ts (the Express app used by the web/
// desktop/Mac builds) and mobile/'s Android dispatch bridge (which calls the
// same underlying business-logic functions directly, with no Express/HTTP
// server in between - see server/src/mobileDispatch.ts). Kept in one place
// so a validation rule never has to be kept in sync by hand across two
// call sites.

export const MAX_TEXT_LENGTH = 2000
export const MAX_URL_LENGTH = 2000
export const MAX_RATIONALE_LENGTH = 1500
export const MAX_HOLDINGS = 50
export const MAX_QUANTITY = 100_000
export const MAX_LOSS_POSITIONS = 50
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
// Bounded generously above the real fixture count (currently 4) - a
// mismatched or padded answer list is a client bug, not a reason to error.
export const MAX_PLACEMENT_ANSWERS = 20
export const MAX_SELECTED_IDS = 20
export const MAX_SANDBOX_TRADE_LOG = 500
// No mission-gating engine exists yet (narrowed universe, drawdown
// constraints are future work - see build notes) - every sandbox trade
// handled here is freeform, so state.missionId is always this constant
// for now rather than a real authored mission id.
export const SANDBOX_FREEFORM_MISSION_ID = 'freeform'

const VALID_THESIS_TAGS = new Set<ThesisTag>(['trending_up', 'looks_cheap', 'heard_about_it', 'fits_mission_goal', 'other'])

// The portfolio travels in the request body and back on every call (no
// server-side session/account, same "no accounts, no database" stance as
// Decision Replay's client-persisted progress) - so it's untrusted input
// like anything else the client sends, and gets validated the same way.
export function isValidPortfolio(value: unknown): value is Portfolio {
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

export function isValidThesisTag(value: unknown): value is ThesisTag {
  return typeof value === 'string' && VALID_THESIS_TAGS.has(value as ThesisTag)
}

// Same "travels in the request body, no server session" stance as
// isValidPortfolio - see that comment. tradeLog entries are server-produced
// round-tripped data (the client never hand-authors one), so they're bounded
// but not deeply re-validated field by field, the same trust level
// TradeRecord[] would get if the Simulator persisted trade history server-side.
export function isValidSandboxPortfolioState(value: unknown): value is SandboxPortfolioState {
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
export function validateTaxTradeInput(value: unknown): string | null {
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

export function validateOpenLossPositions(value: unknown): string | null {
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

export function validateRealizedGains(value: unknown): string | null {
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

export function validatePlacementAnswers(value: unknown): string | null {
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

/** Missing `level` defaults to beginner - "bias placement and re-leveling downward" (CLAUDE.md) extends to an unspecified level never being treated as anything higher. An explicitly invalid value is still rejected, not silently coerced. */
export function parseLevel(value: unknown): DifficultyLevel | null {
  if (value === undefined) return 'beginner'
  return typeof value === 'string' && DIFFICULTY_LEVELS.includes(value as DifficultyLevel) ? (value as DifficultyLevel) : null
}

export function validateCaseStudyTierAnswer(body: Record<string, unknown>, tier: CaseStudyTier): { answer: CaseStudyTierAnswer } | { error: string } {
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
