import { callGeminiStructured, fenceUntrusted } from '../gemini.js'
import { normalizeCriteriaMatches, type CriterionMatch, type RawCriterionMatch } from '../scenarios/rubricScoring.js'
import { GEMINI_GRADED_CRITERION_IDS, TRADE_RUBRIC } from './tradeRubric.js'
import type { Rubric, TradeSide } from '../../../shared/types.js'

const SYSTEM_PROMPT = `You are grading the reasoning behind a simulated (virtual-money, educational) stock trade.
The user wrote a short rationale for a real trade they just placed on real, currently-tradeable market data. Your
only job is to judge, for each listed criterion, whether the rationale demonstrates that specific point - not to
invent new criteria, not to score the trade yourself, and not to say whether the trade was profitable.

Rules:
- Judge ONLY the criteria listed below. Do not add, rename, or skip any of them.
- "matched" means the rationale clearly shows awareness of that specific point, even in different words - reward
  genuine understanding, not keyword-matching.
- Give a short "evidence" note for every criterion, whether matched or not - if matched, a short paraphrase of the
  relevant part of the rationale; if not, a brief note on what was missing.
- Write "feedback": 2-4 sentences of constructive, encouraging feedback in plain English, grounded only in which
  criteria were and weren't matched. Never mention whether the trade made or lost money - this is graded on
  process, not outcome, and the user is trading with virtual cash, not real money.
- CRITICAL: never give investment advice or express any view on whether this or any other real, currently-tradeable
  security is a good or bad buy. You are grading the quality of the reasoning, never the investment itself.`

interface RawGeminiEvaluation {
  criteriaMatches?: RawCriterionMatch[]
  feedback?: unknown
}

export interface TradeRationaleEvaluation {
  criteriaMatches: CriterionMatch[]
  feedback: string
}

const GRADED_CRITERIA = TRADE_RUBRIC.filter((criterion) => (GEMINI_GRADED_CRITERION_IDS as readonly string[]).includes(criterion.id))

export async function evaluateTradeRationale(rationale: string, symbol: string, side: TradeSide): Promise<TradeRationaleEvaluation> {
  // Free text from our own user, but still untrusted text reaching an LLM
  // prompt - same fencing pattern as translateTerm/explainStockContext.
  const fenced = fenceUntrusted('USER_RATIONALE', rationale)

  const criteriaList = GRADED_CRITERIA.map((criterion) => `- ${criterion.id}: ${criterion.description}`).join('\n')

  const userMessage = [`The user is placing a simulated ${side} order for ${symbol}.`, 'Criteria to judge:', criteriaList, '', "The user's rationale:", fenced.block].join(
    '\n'
  )

  const systemPrompt = `${SYSTEM_PROMPT}\n\n${fenced.instruction}`

  const responseSchema = {
    type: 'object',
    properties: {
      criteriaMatches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: GRADED_CRITERIA.map((criterion) => criterion.id) },
            matched: { type: 'boolean' },
            evidence: { type: 'string' }
          },
          required: ['id', 'matched']
        }
      },
      feedback: { type: 'string' }
    },
    required: ['criteriaMatches', 'feedback']
  }

  const raw = await callGeminiStructured<RawGeminiEvaluation>(systemPrompt, userMessage, 0.2, responseSchema)

  // normalizeCriteriaMatches wants a full Rubric - scope it to just the
  // Gemini-graded criteria so position_sizing/diversification ids could
  // never sneak in here even if the model ignores the schema.
  const gradedRubric: Rubric = { soundChoiceIds: [], acceptableChoiceIds: [], criteria: GRADED_CRITERIA, factorOptions: [], idealSummary: '' }

  return {
    criteriaMatches: normalizeCriteriaMatches(gradedRubric, raw.criteriaMatches),
    feedback: typeof raw.feedback === 'string' && raw.feedback.trim() ? raw.feedback.trim() : 'Thanks for sharing your reasoning.'
  }
}
