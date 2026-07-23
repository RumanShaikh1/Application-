import type { StockContextRequest, TranslateRequest } from '../../shared/types.js'

const SYSTEM_PROMPT = `You are the financial translator. Your job is to explain complicated finance and
market terminology in plain, everyday language that anyone can understand.

Rules:
- Keep every explanation SHORT — aim for 1-3 sentences.
- Use simple words. Avoid jargon; if you must use a technical term, define it immediately.
- Stay ACCURATE. Never sacrifice correctness for simplicity. If a concept has an
  important nuance, include it briefly rather than leaving a misleading impression.
- Use a concrete example or everyday analogy when it makes the idea click faster.
- No fluff, no filler, no lecturing. Get to the point.
- If a term has multiple meanings, ask yourself which context the website refers to.

Format each answer as:
1. A one-line plain-English definition.
2. (Optional) A quick example or analogy if it helps.

Do not give financial advice or recommendations — only explain what terms mean.`

const CONTEXT_SYSTEM_PROMPT = `You are a financial news analyst. Given a stock and a handful of its most
recent real headlines, explain in plain English whether this stock is connected to any bigger current
market trend or story (for example: the AI/chip boom, rate-cut expectations, a sector-wide selloff).

Rules:
- Base your answer only on the headlines given - do not invent news you were not shown.
- Keep it to 2-4 short sentences.
- If the headlines don't point to a clear bigger trend, say so plainly instead of guessing.
- No financial advice or recommendations - only context.`

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
// The "-latest" alias tracks whichever current flash-lite model Google
// recommends. The full "flash" tier's free quota on this project is capped
// at just 20 requests/day (shared across every feature that calls it) and
// gets exhausted almost immediately - "flash-lite" carries its own separate,
// far more usable free allowance and is plenty capable for short explanations.
const DEFAULT_MODEL = 'gemini-flash-lite-latest'
const REQUEST_TIMEOUT_MS = 20_000
// Current flash models spend a chunk of the output budget on an internal
// "thinking" pass before the visible answer - budget generously so a short
// explanation doesn't get cut off mid-thought.
const MAX_OUTPUT_TOKENS = 1000

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] }
    finishReason?: string
  }[]
  promptFeedback?: { blockReason?: string }
}

interface GeminiErrorResponse {
  error?: { code?: number; message?: string; status?: string }
}

async function callGemini(systemPrompt: string, userMessage: string, temperature: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to server/.env to enable translations.')
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Key goes in a header, not the URL, so it never ends up in logs/history.
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature, maxOutputTokens: MAX_OUTPUT_TOKENS }
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as GeminiErrorResponse | null
      const message = body?.error?.message

      if (response.status === 400 && body?.error?.status === 'API_KEY_INVALID') {
        throw new Error('Gemini rejected the API key. Check GEMINI_API_KEY in server/.env.')
      }
      if (response.status === 403) {
        throw new Error('Gemini rejected the API key. Check GEMINI_API_KEY in server/.env.')
      }
      if (response.status === 404) {
        throw new Error(`Gemini model "${model}" was not found. Set GEMINI_MODEL to a model listed in Google AI Studio.`)
      }
      if (response.status === 429) {
        throw new Error('Rate limited by Gemini. Wait a moment and try again.')
      }
      throw new Error(`Gemini request failed (${response.status}): ${message ?? 'unknown error'}`)
    }

    const data = (await response.json()) as GeminiResponse

    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini declined to respond (${data.promptFeedback.blockReason}).`)
    }

    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim()

    if (!text) {
      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini ran out of output budget before answering. Try again or shorten the selection.')
      }
      throw new Error('Gemini returned an empty response.')
    }
    return text
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request to Gemini timed out. Check your connection and try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function translateTerm(request: TranslateRequest): Promise<string> {
  const userMessage = [
    request.sourceUrl ? `Website context: highlighted while browsing ${request.sourceUrl}.` : null,
    `Term or passage to explain: "${request.text}"`,
    request.simplifyFurther
      ? 'The reader found the previous explanation too complex or unclear. Rewrite it to be even simpler: shorter sentences, more everyday words, and a clearer, more relatable analogy. Do not just repeat the same wording.'
      : null
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  // A simplify-further retry gets a higher temperature so it actually
  // rephrases instead of regenerating something near-identical.
  return callGemini(SYSTEM_PROMPT, userMessage, request.simplifyFurther ? 0.6 : 0.3)
}

export async function explainStockContext(request: StockContextRequest): Promise<string> {
  if (request.headlines.length === 0) {
    return 'No recent headlines were found for this stock, so there is not enough to connect it to a bigger current story right now.'
  }

  const userMessage = [
    `Stock: ${request.symbol} (${request.name}).`,
    'Recent real headlines mentioning it:',
    ...request.headlines.map((headline, index) => `${index + 1}. ${headline}`)
  ].join('\n')

  return callGemini(CONTEXT_SYSTEM_PROMPT, userMessage, 0.3)
}
