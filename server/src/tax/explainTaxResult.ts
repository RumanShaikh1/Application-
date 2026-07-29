import { callGemini } from '../gemini.js'
import type { TaxComputationResult, TaxTradeInput } from '../../../shared/types.js'

const SYSTEM_PROMPT = `You are explaining an already-computed Indian equity tax result to a beginner retail investor.

Every number below was produced by a deterministic tax engine, not by you. Your only job is to explain, in
plain English, which rule produced each figure and why - never to compute, estimate, restate with rounding
that changes its meaning, or assert any number that is not already present in the data you were given.

Rules:
- Use ONLY the numbers and warnings given to you. Do not calculate a new figure, round in a way that implies
  more or less precision than given, or fill in anything the data doesn't state.
- Do not introduce any tax rule, section, exemption, or rebate that is not explicitly present in the data
  below - not even one you believe to be generally true. For example, if no warning about the Section 87A
  rebate is given, say nothing about 87A at all; do not assume it does or doesn't apply just because it came
  up for a different trade classification. Only explain the specific figures and warnings you were handed.
- Explain the classification first (why this trade is short-term/long-term/intraday/business income), then
  the tax/exemption logic, then why the transaction charges matter alongside the tax - never show tax as if
  it were the whole cost of the trade.
- If a warning is present in the data (e.g. the Section 87A rebate not applying, grandfathering, a missing
  income slab rate), explain it clearly - these are the points beginners most often get wrong. If a warning is
  not present, do not mention that topic.
- This is an indicative estimate, not advice. Never tell the user what to do ("you should sell", "hold
  instead", "this is a good trade") - only explain what each figure is and why it came out that way.
- Keep it to 3-6 short sentences. No headings, no bullet lists, plain prose.`

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

/**
 * Not pure - the only I/O-touching (network) module under server/src/tax/.
 * Takes an already-computed TaxComputationResult and asks Gemini to phrase
 * it in plain English. The model never computes, estimates, or asserts a
 * tax figure - see computeTax.ts for where every number actually comes
 * from. Callers must pass a result computed server-side from the same
 * trade, never a client-supplied result, so the explanation can't be made
 * to narrate fabricated numbers.
 */
export async function explainTaxResult(trade: TaxTradeInput, result: TaxComputationResult): Promise<string> {
  const summaryLines = [
    `Trade type: ${trade.tradeType}${trade.fnoInstrument ? ` (${trade.fnoInstrument})` : ''}.`,
    `Buy ₹${trade.buyPrice} x ${trade.quantity} on ${trade.buyDate}; sell ₹${trade.sellPrice} x ${trade.quantity} on ${trade.sellDate}.`,
    `Classification: ${result.classification}.`,
    `Rate set in effect: ${result.rateSetId} (${result.rateSetEffectiveFrom}).`,
    `Gross gain/loss: ${formatRupees(result.grossGain)}.`,
    result.grandfatheringApplied ? `Grandfathering applied - cost of acquisition per share: ₹${result.costOfAcquisitionPerUnit}.` : null,
    result.exemptionConsumed !== null ? `Exemption consumed: ${formatRupees(result.exemptionConsumed)}.` : null,
    result.taxableGain !== null ? `Taxable gain: ${formatRupees(result.taxableGain)}.` : 'Taxable gain: not computed (income slab rate not supplied).',
    result.taxRatePercent !== null ? `Tax rate applied: ${result.taxRatePercent}%.` : null,
    result.taxAmount !== null ? `Tax amount: ${formatRupees(result.taxAmount)}.` : null,
    result.cessAmount !== null ? `Cess: ${formatRupees(result.cessAmount)}.` : null,
    `Total transaction charges (brokerage, STT, exchange charges, etc.): ${formatRupees(result.totalCharges)}.`,
    result.netProceeds !== null ? `Net result after tax, cess, and charges: ${formatRupees(result.netProceeds)}.` : null,
    result.warnings.length > 0 ? `Warnings the engine raised: ${result.warnings.join(' ')}` : null
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const userMessage = `Explain this computed result:\n${summaryLines}`

  return callGemini(SYSTEM_PROMPT, userMessage, 0.3)
}
