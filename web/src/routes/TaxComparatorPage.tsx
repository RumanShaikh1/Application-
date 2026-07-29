import { useState } from 'react'
import TaxTradeForm from '../components/TaxTradeForm'
import TaxResultBreakdown from '../components/TaxResultBreakdown'
import DaysToLongTermCounter from '../components/DaysToLongTermCounter'
import { api } from '../lib/api'
import type { TaxComputationResult, TaxTradeInput } from '@shared/types'

export default function TaxComparatorPage() {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [trade, setTrade] = useState<TaxTradeInput | null>(null)
  const [result, setResult] = useState<TaxComputationResult | null>(null)

  async function handleSubmit(nextTrade: TaxTradeInput): Promise<void> {
    setSubmitting(true)
    setSubmitError('')
    try {
      const nextResult = await api.tax.compute(nextTrade)
      setTrade(nextTrade)
      setResult(nextResult)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not calculate this trade.')
    } finally {
      setSubmitting(false)
    }
  }

  const stillShortTerm = result?.classification === 'equity_delivery_short'

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">What does this trade actually cost you?</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">
          Tax is only part of it - brokerage, STT, and exchange charges matter too, especially for a short holding period. Every figure below is an
          indicative estimate, not advice.
        </p>
      </div>

      <TaxTradeForm onSubmit={handleSubmit} submitting={submitting} submitError={submitError} submitLabel="Calculate" />

      {result && trade ? (
        <div className="space-y-4">{stillShortTerm ? <DaysToLongTermCounter trade={trade} /> : <TaxResultBreakdown trade={trade} result={result} />}</div>
      ) : null}
    </div>
  )
}
