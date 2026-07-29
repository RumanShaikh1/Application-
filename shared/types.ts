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
  /** Additive OHLCV fields - Yahoo returns these in the same response as `close`, so the MarketDataProvider interface can honestly serve "historical OHLC". Optional so nothing that only ever read `.close` (e.g. the extension's PriceChart) needs to change. */
  open?: number
  high?: number
  low?: number
  volume?: number
}

export interface StockContextRequest {
  symbol: string
  name: string
  headlines: string[]
}

// ---------------------------------------------------------------------------
// Decision Replay
// ---------------------------------------------------------------------------
// A scenario is an anonymised historical market situation, replayed to the
// user one stage at a time. The user is graded on the quality of the
// decision given only the information visible at that point - never on what
// the price did afterward. See server/data/scenarios/*.json for the actual
// fixture content and server/src/scenarios/ for the logic that serves it.

export type ScenarioDifficulty = 'beginner' | 'intermediate' | 'advanced'

export type ScenarioStageKind = 'price' | 'filing' | 'headline' | 'fundamentals'

/** How the scenario's real-world outcome eventually resolved. Every fixture must record this so the dataset can be audited for survivorship bias - the universe must include declines and delistings, not just present-day winners. */
export type OutcomeCategory = 'strong_gain' | 'modest_gain' | 'flat' | 'decline' | 'delisted'

export interface OHLCPoint {
  /** Normalised trading-day index from the scenario's start - never a real calendar date, so the period can't be identified. */
  day: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface ScenarioStage {
  index: number
  kind: ScenarioStageKind
  /** For kind: 'headline'. */
  headline?: string
  /** For kind: 'filing'. */
  filingSummary?: string
  /** For kind: 'fundamentals', e.g. { "P/E": 42, "Debt/Equity": 3.1 }. */
  fundamentals?: Record<string, string | number>
  /** For kind: 'price' - the day index this reveal extends the visible series through (for display/labelling). */
  priceThroughDay?: number
  /** For kind: 'price' - the actual new OHLC points being revealed at this stage (continuing on from priceSeed / any earlier price stage). */
  priceExtension?: OHLCPoint[]
  /** Short authored framing text shown alongside this reveal. */
  note?: string
}

export interface Choice {
  id: string
  label: string
  description?: string
}

export interface RubricCriterion {
  id: string
  /** Shown to the user after scoring - what a sound rationale addresses. */
  description: string
  /** Relative weight - need not sum to 100 across a rubric's criteria, normalised at scoring time. */
  weight: number
  /**
   * Which of the parent Rubric's `factorOptions` count as evidence this criterion was
   * addressed - selecting any one of these marks it matched. This is the load-bearing rationale
   * mechanic (see CLAUDE.md's Product Invariants: "grade judgment, not vocabulary").
   */
  factorOptionIds?: string[]
  /**
   * @deprecated Demoted to an optional, capped bonus only (see MAX_RATIONALE_BONUS in
   * rubricScoring.ts) - no longer load-bearing. Hand-authored "already built" concept clusters
   * used to grade free-text rationale locally, with no Gemini call - see
   * server/src/scenarios/matchRationale.ts. Each cluster is a set of alternative words/phrases
   * that all point at the same underlying idea.
   */
  matchConcepts?: string[][]
  /** @deprecated Bonus-only, see matchConcepts. How many distinct clusters must be satisfied to mark this criterion matched for bonus purposes. Defaults to all clusters if omitted. */
  minConceptsRequired?: number
}

export interface Rubric {
  /** Choice id(s) that represent the soundest decision given the visible information. */
  soundChoiceIds: string[]
  /** Choice id(s) that are defensible but not ideal. */
  acceptableChoiceIds: string[]
  criteria: RubricCriterion[]
  /** The "which of these support your decision?" multi-select - genuine drivers (referenced by criteria[].factorOptionIds) mixed with plausible distractors. Same shape/grader as placement and case-study tier 1. */
  factorOptions: SelectOption[]
  /** Authored explanation of the sound decision-making process, revealed after scoring. */
  idealSummary: string
}

export interface ScenarioOutcome {
  /** Anonymised "what happened" narrative - no ticker, company name, or real date, even post-answer. */
  summary: string
  /** Full price series including whatever was hidden during play, for the results chart. */
  priceSeries: OHLCPoint[]
  /** Frictionless return - always paired with a cost-adjusted figure before being shown to the user. */
  grossReturnPercent: number
  outcomeCategory: OutcomeCategory
}

export interface ScenarioSummary {
  id: string
  title: string
  difficulty: ScenarioDifficulty
  conceptTags: string[]
}

export interface Scenario extends ScenarioSummary {
  /** Anonymised sector/size blurb, e.g. "A mid-cap consumer goods company". No names/tickers/dates. */
  companyContext: string
  /** Price history visible from Day 0, before any stage-specific reveals. */
  priceSeed: OHLCPoint[]
  stages: ScenarioStage[]
  choices: Choice[]
  rubric: Rubric
  outcome: ScenarioOutcome
  /** Documents why this entry matters for survivorship-bias coverage in the dataset. */
  survivorshipNote: string
}

/** One stage's visible information, as served by GET /api/scenarios/:id/stage/:n. Never includes rubric, outcome, or any stage beyond stageIndex. */
export interface ScenarioStagePayload {
  scenarioId: string
  stageIndex: number
  totalStages: number
  isFinalStage: boolean
  companyContext: string
  priceSeed: OHLCPoint[]
  stage: ScenarioStage
  /** The action menu - only present on the final stage, since it's not a spoiler. */
  choices?: Choice[]
  /** The "which of these support your decision?" multi-select, options stripped of `correct` - only present on the final stage, same reasoning as `choices`. */
  factorOptions?: PublicSelectOption[]
}

export interface ScenarioAnswerRequest {
  choiceId: string
  /** Which of the rubric's factorOptions the user picked as supporting their decision - the load-bearing rationale signal. */
  selectedFactorIds: string[]
  /** Optional free-text reflection - contributes only a small, capped bonus (see MAX_RATIONALE_BONUS in rubricScoring.ts), never load-bearing. */
  rationale?: string
}

export interface RubricCriterionResult {
  id: string
  description: string
  weight: number
  matched: boolean
  /** Short evidence/quote from the rationale, or an explanation of why it wasn't matched. */
  evidence?: string
}

export type ChoiceQuality = 'sound' | 'acceptable' | 'poor'

export interface CostBreakdown {
  grossReturnPercent: number
  brokerageCost: number
  sttCost: number
  exchangeFees: number
  slippageCost: number
  netReturnPercent: number
}

export interface ScenarioAnswerResponse {
  scoreTotal: number
  maxScore: number
  choiceQuality: ChoiceQuality
  criteria: RubricCriterionResult[]
  /** Gemini-phrased feedback narrative, grounded only in the deterministic score above. */
  feedback: string
  idealSummary: string
  outcome: ScenarioOutcome
  costBreakdown: CostBreakdown
}

/** The reusable "user model" shape - kept generic enough that a server-side store can replace client-side localStorage later without changing shape (see web/src/lib/progressStore.ts). */
export interface ScenarioAttemptRecord {
  scenarioId: string
  choiceId: string
  scoreTotal: number
  maxScore: number
  choiceQuality: ChoiceQuality
  /** Unix ms. */
  answeredAt: number
}

// ---------------------------------------------------------------------------
// Simulated Trading
// ---------------------------------------------------------------------------
// A live-market companion to Decision Replay, reusing its data layer
// (MarketDataProvider), scoring shape (RubricCriterion/RubricCriterionResult),
// and user-model pattern (client-persisted, no accounts/db). Unlike Decision
// Replay, this trades real current symbols with virtual cash - the process
// score judges position sizing, diversification, and rationale quality, never
// price movement. See server/src/simulator/ for the logic that computes this.

export interface Holding {
  symbol: string
  quantity: number
  /** Cost basis per share, fees included. */
  averageCost: number
}

export interface Portfolio {
  cashBalance: number
  holdings: Holding[]
}

export type TradeSide = 'buy' | 'sell'

export interface TradeCostBreakdown {
  grossValue: number
  brokerageCost: number
  sttCost: number
  exchangeFees: number
  slippageCost: number
  /** Cash delta after all costs - negative for a buy, positive for a sell. */
  netCashImpact: number
}

export interface TradeRecord {
  id: string
  symbol: string
  side: TradeSide
  quantity: number
  price: number
  costBreakdown: TradeCostBreakdown
  rationale: string
  /** Unix ms. */
  timestamp: number
}

export interface TradeRequest {
  portfolio: Portfolio
  symbol: string
  side: TradeSide
  quantity: number
  rationale: string
}

export interface PositionSizeCheck {
  symbol: string
  percentOfPortfolio: number
  /** Illustrative guideline, not a hard limit - the trade always executes regardless. */
  withinGuideline: boolean
}

export interface DiversificationSummary {
  sectorAllocations: { sector: string; percentOfPortfolio: number }[]
  /** True if any single sector exceeds the concentration guideline. */
  concentratedSectorWarning: boolean
}

export interface TradeProcessScore {
  scoreTotal: number
  maxScore: number
  /** Reuses the exact Decision Replay type - two criteria are scored deterministically (sizing/diversification), two from Gemini's rationale classification (grounded/cost-awareness). */
  criteria: RubricCriterionResult[]
  /** Gemini-phrased feedback narrative, grounded only in the deterministic score above. */
  feedback: string
}

export interface TradeResponse {
  trade: TradeRecord
  updatedPortfolio: Portfolio
  positionSizeCheck: PositionSizeCheck
  diversification: DiversificationSummary
  processScore: TradeProcessScore
}

export interface PortfolioValuation {
  cashBalance: number
  holdingsValue: number
  totalValue: number
  positions: {
    symbol: string
    quantity: number
    averageCost: number
    currentPrice: number
    marketValue: number
    unrealizedPnLPercent: number
    percentOfPortfolio: number
  }[]
}

// ---------------------------------------------------------------------------
// Tax Understanding
// ---------------------------------------------------------------------------
// "What does this trade actually cost you?" - not just an LTCG calculator.
// No tax rate, threshold, exemption, cess, holding-period cutoff, or
// transaction charge is ever hardcoded in application code - every one of
// them lives in a server/data/tax-rates/<effective-date>.json rate set (see
// TaxRateSet below) and the engine (server/src/tax/) selects the correct
// one from the transaction date. See CLAUDE.md's Product Invariants.

export type TradeType = 'equity_delivery' | 'equity_intraday' | 'fno'
export type FnoInstrument = 'futures' | 'options'
export type GainClassification = 'equity_delivery_short' | 'equity_delivery_long' | 'intraday' | 'fno'

export interface TaxTradeInput {
  tradeType: TradeType
  /** Required when tradeType is 'fno' - futures and options carry different STT/exchange-charge sub-rates. */
  fnoInstrument?: FnoInstrument
  buyPrice: number
  sellPrice: number
  quantity: number
  /** ISO date (YYYY-MM-DD). */
  buyDate: string
  /** ISO date (YYYY-MM-DD). */
  sellDate: string
  /** Grandfathering (Section 112A) - only meaningful when buyDate is on/before the rate set's grandfathering cutoff date. */
  fairMarketValueJan312018?: number
  /** Needed to produce an exact tax figure for intraday/fno (slab-rate) income - as a percent, e.g. 30 for the 30% slab. Omitted -> the result explains why it can't give an exact number rather than guessing one. */
  incomeSlabRatePercent?: number
  /** LTCG exemption is per financial year, not per trade - this is how much of it earlier trades this FY have already used. Defaults to 0. */
  priorLongTermGainsThisFY?: number
}

export interface ChargeLineItem {
  id: string
  label: string
  leg: 'buy' | 'sell'
  amount: number
}

export interface TaxBreakdownLineItem {
  id: string
  label: string
  amount: number
  explanation: string
}

export interface TaxComputationResult {
  classification: GainClassification
  rateSetId: string
  rateSetEffectiveFrom: string
  grossGain: number
  /** Cost of acquisition actually used per unit - after grandfathering, if applied. */
  costOfAcquisitionPerUnit: number
  grandfatheringApplied: boolean
  /** null when classification is intraday/fno and no incomeSlabRatePercent was supplied. */
  taxableGain: number | null
  exemptionConsumed: number | null
  taxRatePercent: number | null
  taxAmount: number | null
  cessAmount: number | null
  charges: ChargeLineItem[]
  totalCharges: number
  totalTaxAndCharges: number | null
  /** null only when taxAmount is null - can't net proceeds without a tax figure. */
  netProceeds: number | null
  breakdown: TaxBreakdownLineItem[]
  /** e.g. "87A does not apply here", "grandfathering applied", "slab rate needed for an exact figure". */
  warnings: string[]
}

export interface BrokerageRule {
  flatFeeRupees: number
  percentOfTurnover: number
  /** When true, brokerage is the lower of the flat fee and the percentage; when false, they're not compared (e.g. delivery, where both are typically 0). */
  useLowerOf: boolean
}

/** The full shape of one server/data/tax-rates/<effective-date>.json file. Every numeric rule in the Tax Understanding module comes from here - see this file's header comment and CLAUDE.md's Product Invariants. */
export interface TaxRateSet {
  id: string
  financialYear: string
  /** ISO date (YYYY-MM-DD) - the engine picks the rate set with the latest effectiveFrom that is <= the transaction date. No effectiveTo field: it's derived from the next rate set's effectiveFrom, so adjacent files can't drift out of sync. */
  effectiveFrom: string
  description: string
  source: string
  cessRate: number
  holdingPeriod: {
    listedEquityLongTermCutoffMonths: number
  }
  capitalGains: {
    shortTerm: { section: string; rate: number; description: string }
    longTerm: { section: string; rate: number; exemptionAmountPerFY: number; indexationAllowed: boolean; description: string }
    section87ARebate: { applicable: boolean; note: string }
    grandfathering: { cutoffDate: string; formula: string; description: string }
  }
  businessIncome: {
    intraday: { classification: string; schedule: string; taxedAtSlabRate: boolean; description: string }
    fno: { classification: string; schedule: string; taxedAtSlabRate: boolean; description: string }
    availableSlabRatesPercent: number[]
  }
  lossSetOff: {
    shortTermLossOffsetsAgainst: LossClassification[]
    longTermLossOffsetsAgainst: LossClassification[]
    carryForwardYears: number
    carryForwardRequiresTimelyFiling: boolean
    note: string
  }
  transactionCharges: {
    brokerage: {
      delivery: BrokerageRule
      intraday: BrokerageRule
      fno: BrokerageRule
      description: string
    }
    stt: {
      equityDeliveryBuyPercent: number
      equityDeliverySellPercent: number
      equityIntradaySellPercent: number
      futuresSellPercent: number
      optionsSellOnPremiumPercent: number
    }
    exchangeTransactionChargePercent: {
      equity: number
      futures: number
      optionsOnPremium: number
    }
    sebiTurnoverFeePercent: number
    stampDutyPercent: {
      equityDeliveryBuy: number
      equityIntradayBuy: number
      futuresBuy: number
      optionsBuyOnPremium: number
    }
    gstRateOnBrokerageAndFees: number
    note: string
  }
}

// --- Loss-harvesting checker (deliverable #5) ---

export type LossClassification = 'short_term' | 'long_term'

export interface OpenLossPosition {
  id: string
  label: string
  /** Positive number - the loss that would be realised if this position were sold today. */
  unrealizedLossAmount: number
  classification: LossClassification
}

export interface RealizedGainsThisFY {
  shortTermGains: number
  longTermGains: number
}

export interface LossOffsetSuggestion {
  positionId: string
  label: string
  lossAmount: number
  classification: LossClassification
  offsetAppliedToShortTermGains: number
  offsetAppliedToLongTermGains: number
  remainingUnoffsetLoss: number
}

export interface LossHarvestingResult {
  suggestions: LossOffsetSuggestion[]
  totalShortTermGainsBeforeOffset: number
  totalLongTermGainsBeforeOffset: number
  totalShortTermGainsAfterOffset: number
  totalLongTermGainsAfterOffset: number
  remainingLongTermExemption: number
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Placement & Case Studies - shared grading primitives
// ---------------------------------------------------------------------------
// One option shape and one band shape underlie every gradeable input across
// placement, the tiered case-study ladder, and the existing-scenario factor
// cleanup - see server/src/grading/grader.ts, the one deterministic grader
// all three consume. No free-text scoring lives here; matchRationale.ts
// remains a separate, capped, optional bonus only (see CLAUDE.md's Product
// Invariants). More types (RiskReadBlock, CaseStudy, PlacementMiniScenario,
// etc.) land in later build steps as each part is implemented.

export interface SelectOption {
  id: string
  label: string
  /** True = genuine (correct read / genuine driver / correct max-loss answer). False = a plausible-looking distractor. */
  correct: boolean
}

export type BandCredit = 'full' | 'partial' | 'zero'

export interface Band {
  id: string
  /** Inclusive bounds, in the same unit as the slider/bucket value (e.g. percent). */
  min: number
  max: number
  credit: BandCredit
}

/** A single-select risk read plus a distractor-aware "which of these support that read?" multi-select - one reusable block, one grader. Used by placement, case-study tier 1, and (as an option) the existing-scenario factor cleanup. */
export interface RiskReadBlock {
  question?: string
  readOptions: SelectOption[]
  factorQuestion?: string
  factorOptions: SelectOption[]
}

/** What actually gets sent to the client before grading - `correct` is never present, the same way ScenarioStagePayload never includes the rubric. */
export type PublicSelectOption = Omit<SelectOption, 'correct'>

export interface PublicRiskReadBlock {
  question?: string
  readOptions: PublicSelectOption[]
  factorQuestion?: string
  factorOptions: PublicSelectOption[]
}

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

// ---------------------------------------------------------------------------
// Placement (Part B)
// ---------------------------------------------------------------------------
// 3-4 short, single-tier "read the risk" mini-scenarios - no staged reveal,
// no free text. See server/src/placement/. Two escape hatches exist at the
// product level (the first real scenario is playable without taking this
// test; the test itself offers a visible "skip, start at beginner" option) -
// this is a front door, not a toll.

export interface PlacementMiniScenario {
  id: string
  context: string
  block: RiskReadBlock
}

/** Served to the client - see PublicRiskReadBlock. */
export interface PlacementMiniScenarioPublic {
  id: string
  context: string
  block: PublicRiskReadBlock
}

export interface PlacementAnswer {
  miniScenarioId: string
  selectedReadId: string
  selectedFactorIds: string[]
}

export interface PlacementAnswerRequest {
  answers: PlacementAnswer[]
}

/** Result of grading one risk_read block - reused as-is for a case study's tier-1 result, not just placement. */
export interface RiskReadResult {
  id: string
  readCorrect: boolean
  correctReadIds: string[]
  factorScore: number
  correctFactorIds: string[]
  incorrectlySelectedFactorIds: string[]
  missedFactorIds: string[]
  /** 0-1, the read weighted more heavily than the factor list - the read is the primary judgment under test. */
  combinedScore: number
}

export interface PlacementResult {
  level: DifficultyLevel
  totalScore: number
  perScenario: RiskReadResult[]
}

// ---------------------------------------------------------------------------
// Case studies (Part A) - tiered ladder over real, large index-name episodes
// ---------------------------------------------------------------------------
// Applies only to real historical large-cap/index-name episodes - never the
// general 9-scenario set (server/data/scenarios/*.json), which only gets the
// Part C factor cleanup above. Kept in its own data model and directory
// (server/data/case-studies/*.json) rather than folded into scenarios, since
// the shape (masked identity, tiers, level variants) doesn't fit Scenario at
// all. Grading reuses the one shared grader (server/src/grading/grader.ts) -
// nothing here duplicates scoreSingleSelect/scoreMultiSelect/scoreBand.
//
// One case fixture is authored ONCE and rendered at all three levels via
// three parameters, never as three fixture clones:
//   (a) information masking - which `facts` are volunteered vs. withheld
//       (some withheld facts are revealable via a limited look-up) vs.
//       layered with red herrings - see CaseStudyVariant.
//   (b) tier gating - beginner sees tier 1 only, intermediate tiers 1-2,
//       advanced tiers 1-3, capped by how many tiers the case actually has
//       (CASE_STUDY_LEVEL_TIER_CAP in caseStudyGating.ts). This is a fixed
//       rule applied by the gating engine, not per-case data.
//   (c) option breadth - the wider action/instrument set (shorting, options)
//       lives only in tier 3, which only advanced ever reaches under (b) -
//       so breadth follows directly from tier gating rather than needing its
//       own per-case configuration.

/** Real-world facts, held server-side only until the post-answer debrief. Identity masking is a hard product invariant (see CLAUDE.md) - this must never appear in any payload served before grading. See caseStudyGating.ts and its identity-masking test. */
export interface CaseStudyIdentity {
  companyName: string
  realDates: string
  whatActuallyHappened: string
}

/** A single withholdable fact. Genuine supporting facts and red herrings are kept in separate arrays on CaseStudy (never one flag on a shared list) so a filtering bug can't accidentally serve a red herring to beginner/intermediate. */
export interface CaseStudyFact {
  id: string
  label: string
  detail: string
}

/** Per-level rendering of the same case - see the (a)/(b)/(c) parameters above. */
export interface CaseStudyVariant {
  /** Fact ids proactively shown at this level; everything else in `facts` is withheld. */
  visibleFactIds: string[]
  /** Withheld fact ids the user may reveal on demand, a limited number of times (see CASE_STUDY_LOOKUP_LIMIT). Always empty for advanced - the hardest level gets no lookups. */
  lookupFactIds: string[]
  /** Ids into `redHerringFacts` shown at this level, layered in alongside whatever's genuinely visible. Empty at beginner and intermediate - red herrings are an advanced-only pressure test. */
  redHerringFactIds: string[]
}

/** Tier 1 - identical mechanic to placement, reusing RiskReadBlock directly. Present on every case. */
export interface CaseStudyRiskReadTier {
  kind: 'risk_read'
  id: string
  block: RiskReadBlock
}

export interface CaseStudySizingBucket {
  id: string
  label: string
  /** The numeric value this bucket resolves to for band grading (e.g. a trim-to percentage) - fed straight into scoreBand. */
  value: number
}

/** Tier 2 - present on most cases. A bucketed (not continuous) position-sizing slider, band-graded, plus a distractor-aware "why this size?" multi-select explicitly weighted at least as heavily as the bucket itself - a good number reached by luck is not understanding. */
export interface CaseStudySizingTier {
  kind: 'sizing'
  id: string
  prompt: string
  buckets: CaseStudySizingBucket[]
  /** Author-defined sound/adjacent/opposite ranges, in the same unit as bucket `value`. */
  bands: Band[]
  reasonQuestion: string
  reasonOptions: SelectOption[]
}

/** Tier 3 - authored only where it genuinely fits (see CLAUDE.md: never author a tier 3 that doesn't genuinely exist). The max-loss gate is the whole point of this tier and is never skippable: instrumentOptions/exitOptions are never graded, and per the CaseStudyInstrumentResult contract are never even scored, until `selectedMaxLossOptionId` has been answered correctly - enforced server-side in evaluateCaseStudyTier.ts regardless of what the client sends. A wrong gate answer returns maxLossExplanation and nothing else. Grading covers the gate plus survivability/exit discipline - never whether the trade would have paid off (never grade on outcome, CLAUDE.md). */
export interface CaseStudyInstrumentTier {
  kind: 'instrument'
  id: string
  maxLossQuestion: string
  maxLossOptions: SelectOption[]
  /** Shown alongside a wrong gate answer - states the real max loss so the user corrects and retries; never a dead end. */
  maxLossExplanation: string
  instrumentQuestion: string
  instrumentOptions: SelectOption[]
  exitQuestion: string
  exitOptions: SelectOption[]
}

export type CaseStudyTier = CaseStudyRiskReadTier | CaseStudySizingTier | CaseStudyInstrumentTier

export interface CaseStudy {
  id: string
  title: string
  /** The masked scenario framing shown at every level, e.g. "A large private-sector bank, [Year 0]." Never the real name or date - see CaseStudyIdentity. */
  maskedContext: string
  facts: CaseStudyFact[]
  redHerringFacts: CaseStudyFact[]
  /** Ordered - tier N's array index is tier N's position; there is no separate tier-number field. */
  tiers: CaseStudyTier[]
  variants: Record<DifficultyLevel, CaseStudyVariant>
  identity: CaseStudyIdentity
}

// --- Served/public shapes - masked identity, level-resolved facts and tier
// subset, `correct` stripped everywhere. Mirrors PublicRiskReadBlock/
// ScenarioStagePayload's never-leak-the-answer-key pattern. ---

export interface CaseStudyFactPublic {
  id: string
  label: string
  detail: string
  /** True if this fact was withheld at the requested level but is still eligible for a limited look-up (see CASE_STUDY_LOOKUP_LIMIT). */
  revealableViaLookup: boolean
}

export type CaseStudyRiskReadTierPublic = { kind: 'risk_read'; id: string; block: PublicRiskReadBlock }

export interface CaseStudySizingTierPublic {
  kind: 'sizing'
  id: string
  prompt: string
  buckets: CaseStudySizingBucket[]
  reasonQuestion: string
  reasonOptions: PublicSelectOption[]
}

export interface CaseStudyInstrumentTierPublic {
  kind: 'instrument'
  id: string
  maxLossQuestion: string
  maxLossOptions: PublicSelectOption[]
  instrumentQuestion: string
  /** Present in the payload for layout purposes, but the UI must keep this disabled until the gate is passed - and the server enforces the same rule independently of the client, since "never skippable" has to hold even against a client that ignores its own UI. */
  instrumentOptions: PublicSelectOption[]
  exitQuestion: string
  exitOptions: PublicSelectOption[]
}

export type CaseStudyTierPublic = CaseStudyRiskReadTierPublic | CaseStudySizingTierPublic | CaseStudyInstrumentTierPublic

export interface CaseStudyPublic {
  id: string
  title: string
  maskedContext: string
  level: DifficultyLevel
  facts: CaseStudyFactPublic[]
  tiers: CaseStudyTierPublic[]
}

// --- Answers and results ---

export type CaseStudyTierAnswer =
  | { kind: 'risk_read'; tierId: string; selectedReadId: string; selectedFactorIds: string[] }
  | { kind: 'sizing'; tierId: string; selectedBucketId: string; selectedReasonFactorIds: string[] }
  | {
      kind: 'instrument'
      tierId: string
      selectedMaxLossOptionId: string
      /** Omitted on a gate-check-only submission (see CaseStudyInstrumentTier). */
      selectedInstrumentOptionId?: string
      selectedExitFactorIds?: string[]
    }

export interface CaseStudySizingResult {
  bandCredit: BandCredit
  selectedValue: number
  reasonFactorScore: number
  correctReasonFactorIds: string[]
  incorrectlySelectedReasonFactorIds: string[]
  missedReasonFactorIds: string[]
  combinedScore: number
}

export interface CaseStudyInstrumentResult {
  maxLossCorrect: boolean
  correctMaxLossOptionId: string
  maxLossExplanation: string
  /** Mirrors the never-skippable gate: false means nothing below was graded, regardless of what the client submitted. */
  gatePassed: boolean
  /** Instrument choice itself is never scored - "never grade on outcome" (CLAUDE.md) extends to not rewarding/penalizing which instrument was picked, only survivability/exit discipline once one was. */
  exitFactorScore?: number
  correctExitFactorIds?: string[]
  incorrectlySelectedExitFactorIds?: string[]
  missedExitFactorIds?: string[]
  combinedScore?: number
}

export type CaseStudyTierResult =
  | { kind: 'risk_read'; tierId: string; result: RiskReadResult }
  | { kind: 'sizing'; tierId: string; result: CaseStudySizingResult }
  | { kind: 'instrument'; tierId: string; result: CaseStudyInstrumentResult }

/** Response to answering one tier. `identity` - the post-answer debrief - is present only once `isFinalTierForLevel` is true AND the tier is genuinely complete: for an instrument tier that means the max-loss gate was passed, not merely attempted, since a wrong gate answer means the tier isn't done yet even though it's positionally last. Never present earlier, and never in any GET response. */
export interface CaseStudyTierAnswerResponse {
  tierResult: CaseStudyTierResult
  isFinalTierForLevel: boolean
  identity?: CaseStudyIdentity
}

/** One tier's worth of attempt history, kept client-side (no accounts/DB - see CLAUDE.md scope) and fed back into adaptive re-leveling. `corrected` is true when the first answer was wrong and the user was shown the right read and continued - a wrong answer never locks anyone out of later tiers or later attempts. */
export interface CaseStudyTierAttempt {
  caseStudyId: string
  tierId: string
  level: DifficultyLevel
  result: CaseStudyTierResult
  corrected: boolean
  answeredAt: number
}

// ---------------------------------------------------------------------------
// Sandbox - guided practice on the real Nifty 20 (offline, historical replay)
// ---------------------------------------------------------------------------
// A SEPARATE mode from Decision Replay and the (live) Simulator: real names,
// real fundamentals, real historical daily closes replayed day-by-day -
// never masked, never live. See server/data/sandbox/*.json for the shipped
// fixtures and server/src/sandbox/ for the engine. No Gemini/API call
// anywhere in this mode - see CLAUDE.md's Sandbox invariants.

export type SandboxStyleLabel = 'large_stable' | 'higher_growth' | 'higher_risk'

export interface SandboxFundamentals {
  peRatio: number | null
  pbRatio: number | null
  roePercent: number | null
  marketCapCr: number
  dividendYieldPercent: number | null
  /** A ratio (0.1 = debt is 10% of equity), not Yahoo's raw percent-scaled figure - see the sandbox fixture-authoring notes. null where not meaningful (e.g. banks) or not published. */
  debtToEquity: number | null
  beta: number | null
  fiftyTwoWeekLow: number
  fiftyTwoWeekHigh: number
}

export interface SandboxCompany {
  /** Real NSE symbol, e.g. "RELIANCE.NS" - same convention as StockStats.symbol. Doubles as the primary key everywhere (positions, allowed-universe lists, analysis lookups) - no separate id field. */
  symbol: string
  name: string
  sector: string
  styleLabel: SandboxStyleLabel
  fundamentals: SandboxFundamentals
}

/**
 * The whole fixture is snapshot-dated once, not per-company - see
 * fundamentals.json's own `note` field for why this date deliberately does
 * not match the price window below (real point-in-time historical
 * fundamentals for 20 companies aren't reliably sourceable for free - using
 * current real data, clearly dated, beats fabricating historical figures).
 *
 * `windowId` is the explicit binding to whichever PriceWindow this
 * fundamentals snapshot is meant to accompany - it must equal that window's
 * `id`. loadSandboxData.ts asserts this at startup and throws if it doesn't
 * match, specifically so a second window can never be added later with a
 * silently-mismatched (or silently-reused) fundamentals fixture.
 */
export interface SandboxFundamentalsSnapshot {
  asOfDate: string
  windowId: string
  note: string
  companies: SandboxCompany[]
}

export interface SandboxDailyClose {
  /** 0-indexed trading day within the window - the replay cursor. */
  day: number
  /** Real ISO date - this mode is intentionally unmasked. */
  date: string
  close: number
}

export interface PriceWindow {
  id: string
  startDate: string
  endDate: string
  /** States what the window teaches, e.g. "contains a ~40% drawdown and a recovery" - shown in the UI, not just internal documentation. */
  description: string
  seriesBySymbol: Record<string, SandboxDailyClose[]>
}

export interface SandboxMarketProvider {
  getFundamentalsSnapshot(): SandboxFundamentalsSnapshot
  getPriceWindow(): PriceWindow
  /** Undefined if day is out of range or symbol unknown - never extrapolated. */
  getClose(symbol: string, day: number): number | undefined
}

export interface SandboxMissionConstraint {
  maxSingleWeekDrawdownPercent?: number
}

export interface SandboxMission {
  id: string
  title: string
  goalDescription: string
  startingCash: number
  /** The narrowed buy universe - symbols from SandboxCompany. Mission 1 ships ~6-8; later missions widen. */
  allowedSymbols: string[]
  constraint?: SandboxMissionConstraint
}

export type ThesisTag = 'trending_up' | 'looks_cheap' | 'heard_about_it' | 'fits_mission_goal' | 'other'

/** Parallel to Portfolio's Holding[] (reused as-is for cash/quantity/cost math) - carries only the guided-layer metadata a plain Holding doesn't have. Keyed by symbol, kept in lockstep with Portfolio.holdings by the sandbox engine (new position -> new entry; position fully closed -> entry removed). */
export interface SandboxPositionMeta {
  symbol: string
  entryDay: number
  thesisTag: ThesisTag
}

export interface SandboxPortfolioState {
  missionId: string
  /** Reused Simulator type - cash + Holding[]. */
  portfolio: Portfolio
  positionMeta: SandboxPositionMeta[]
  dayCursor: number
  tradeLog: SandboxTrade[]
}

export interface SandboxTrade {
  id: string
  symbol: string
  side: TradeSide
  quantity: number
  price: number
  day: number
  /** From calculateTradeCost - reused, not reimplemented. */
  costBreakdown: TradeCostBreakdown
  /** Required on every buy. Carried through on the closing sell so the close summary can show it without a lookup. */
  thesisTag: ThesisTag
  timestamp: number
  /** Deterministic process signals recorded at THIS trade's moment, using only data available up to `day` - the portfolio grader's per-trade inputs (see PortfolioGradeReport). Never recomputed with hindsight. */
  positionSizeCheck: PositionSizeCheck
  diversification: DiversificationSummary
}

/** Shown once a sell fully closes a position - reflection only, NEVER fed into any process score (never grade on outcome, even here). */
export interface SandboxPositionCloseSummary {
  symbol: string
  thesisTag: ThesisTag
  entryDay: number
  exitDay: number
  entryPrice: number
  exitPrice: number
  netReturnPercent: number
}

export type SandboxSignalKind =
  | 'position_concentration'
  | 'sector_concentration'
  | 'overtrading'
  | 'run_up_chasing'
  | 'trimmed_winner'
  | 'diversification_improved'

export type SandboxSignalTone = 'nudge' | 'celebrate'

export interface SandboxProcessSignal {
  kind: SandboxSignalKind
  tone: SandboxSignalTone
  message: string
}

export interface SandboxHeartbeat {
  /** Reused Simulator type. */
  valuation: PortfolioValuation
  statusMessage: string
  statusTone: SandboxSignalTone | 'neutral'
}

export interface SandboxTradeResult {
  trade: SandboxTrade
  state: SandboxPortfolioState
  positionSizeCheck: PositionSizeCheck
  diversification: DiversificationSummary
  signals: SandboxProcessSignal[]
  closeSummary?: SandboxPositionCloseSummary
}

export interface SandboxTradeRequest {
  state: SandboxPortfolioState
  symbol: string
  side: TradeSide
  quantity: number
  /** Required when opening or adding to a position. Ignored on a sell - the trade record's thesisTag is derived server-side from the position's original entry thesis, since "why did you sell" isn't captured in this pass (see CLAUDE.md/build notes: missions and a sell-side reflection prompt are deferred). */
  thesisTag?: ThesisTag
}

export type SandboxMetricKey = 'peRatio' | 'pbRatio' | 'roePercent' | 'marketCapCr' | 'dividendYieldPercent' | 'debtToEquity' | 'beta'

export interface SandboxMetricGlossaryEntry {
  key: SandboxMetricKey
  label: string
  /** Templated at render time with the specific company's value and the Nifty-20 average - the average is COMPUTED from the shipped fixture, never hardcoded, so it can't drift from the actual data. */
  plainMeaningTemplate: string
}

// ---------------------------------------------------------------------------
// Sandbox stock analysis - descriptive, never advisory (CLAUDE.md invariant)
// ---------------------------------------------------------------------------
// Authored offline (no live API - see CLAUDE.md), covering the whole price
// window. Strengths/weaknesses are authored ONCE per stock, not per
// checkpoint - a company's competitive position doesn't reset every few
// months, so repeating it six times per stock would be padding, not
// completeness. What genuinely changes over time is price context, so that
// alone is per-checkpoint. Six checkpoints map onto this window's real
// narrative arc (see prices.json) - the sandbox always resolves "the latest
// checkpoint at or before the current day cursor," so every one of the
// window's ~250 trading days has a valid analysis available without needing
// a unique entry per day.

export type StockAnalysisCheckpointLabel = 'baseline' | 'pre_crash_peak' | 'crash_trough' | 'early_recovery' | 'continued_recovery' | 'year_end'

export interface StockAnalysisCheckpoint {
  label: StockAnalysisCheckpointLabel
  day: number
  date: string
  close: number
  percentFromWindowStart: number
  percentFromPriorCheckpoint: number | null
  /** What THIS checkpoint's price action shows, in real (not hindsight) terms - e.g. "down 41% from the window's opening level amid a broad, market-wide selloff, not company-specific news." Never frames what came after a later checkpoint. */
  periodNote: string
}

/** Never includes a recommendation, target price, or "should" of any kind - descriptive only. Statistics (SandboxCompany.fundamentals) are served alongside this, never in isolation, same principle as Tax Understanding never showing tax without transaction costs. */
export interface StockAnalysis {
  symbol: string
  /** Durable, qualitative, grounded in real and publicly known characteristics of the actual company - not tied to any one checkpoint's price. */
  strengths: string[]
  weaknesses: string[]
  checkpoints: StockAnalysisCheckpoint[]
}

/** Everything the stock detail modal needs in one call. `priceSeries` is always the real, full window (prices.json covers all 20 symbols) - `analysis` is null, honestly, only for the companies whose qualitative write-up hasn't been authored yet. `fundamentalsAsOfDate` mirrors SandboxFundamentalsSnapshot.asOfDate - included here so the modal can disclose the fundamentals/price-window period mismatch without a second fetch. See server/src/sandbox/loadSandboxData.ts. */
export interface SandboxCompanyDetail {
  company: SandboxCompany
  analysis: StockAnalysis | null
  priceSeries: SandboxDailyClose[]
  fundamentalsAsOfDate: string
}

/** One symbol's close as of a given replay day, for the trade picker grid - one batched call for all 20 rather than 20 individual detail fetches. */
export interface SandboxDayPriceQuote {
  symbol: string
  close: number
  date: string
  /** Versus the prior trading day in the window; 0 on day 0 (no prior day to compare against). */
  changePercent: number
}

export interface SandboxDayPricesResponse {
  day: number
  quotes: SandboxDayPriceQuote[]
}

// ---------------------------------------------------------------------------
// Sandbox portfolio grader - process, never outcome, at the WHOLE-PORTFOLIO
// level (not just the per-trade SandboxProcessSignal above)
// ---------------------------------------------------------------------------
// The defining property, worth stating in the type file and not just
// CLAUDE.md: this NEVER reads realized P&L, unrealized P&L, or any price
// after the trade day being evaluated. Two identical decisions - one that
// happened to be followed by a price rise, one by a fall - MUST grade
// identically, because both were the same decision at the time it was made.
// A large, unhedged bet that happened to pay off is not a better DECISION
// than an identical bet that didn't - it's the same decision, and this
// grader scores the decision.

export type PortfolioGradeDimension = 'diversification' | 'position_sizing' | 'crash_discipline' | 'thesis_consistency' | 'trading_frequency'

export type PortfolioGradeLevel = 'strong' | 'sound' | 'needs_attention'

export interface PortfolioGradeDimensionResult {
  dimension: PortfolioGradeDimension
  level: PortfolioGradeLevel
  /** Plain-English, cites what actually happened ("your largest position was above the 25% guideline at 3 of your 8 trades") - phrased as an observation of the decisions made, never as advice for the next trade. */
  explanation: string
}

export interface PortfolioGradeReport {
  missionId: string
  /** The day cursor this report was generated as of - grading is always "as of a point in the replay," never assumes the session is over. */
  asOfDay: number
  dimensions: PortfolioGradeDimensionResult[]
  /** 0-100 - a PROCESS composite. Never computed from, correlated with, or displayed next to portfolio value/return - see the module comment above. */
  processScore: number
  summary: string
}
