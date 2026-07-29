import { useState } from 'react'
import { AlertTriangle, ChevronDown, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { formatPrice } from '../lib/formatStats'
import type { GainClassification, TaxComputationResult, TaxTradeInput } from '@shared/types'

const CLASSIFICATION_LABELS: Record<GainClassification, string> = {
  equity_delivery_short: 'Short-term capital gain',
  equity_delivery_long: 'Long-term capital gain',
  intraday: 'Intraday - speculative business income',
  fno: 'F&O - non-speculative business income'
}

interface TaxResultBreakdownProps {
  trade: TaxTradeInput
  result: TaxComputationResult
  title?: string
}

// Every tax figure here is shown in the same summary grid as transaction
// charges - never in isolation - and every result carries the expandable
// line-item breakdown plus an "indicative estimate" label. See CLAUDE.md's
// Product Invariants for why these three things are non-negotiable together.
export default function TaxResultBreakdown({ trade, result, title }: TaxResultBreakdownProps) {
  const [explanation, setExplanation] = useState('')
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState('')

  async function handleExplain(): Promise<void> {
    setExplaining(true)
    setExplainError('')
    try {
      const response = await api.tax.explain(trade)
      setExplanation(response.explanation)
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Could not generate an explanation.')
    } finally {
      setExplaining(false)
    }
  }

  return (
    <section className="animate-fade-in space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 shadow-liftedSm">
      <div className="flex items-start justify-between gap-3">
        <div>
          {title ? <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{title}</p> : null}
          <p className="mt-0.5 font-display text-base font-semibold text-ink">{CLASSIFICATION_LABELS[result.classification]}</p>
        </div>
        <span className="shrink-0 rounded-full bg-cobalt/10 px-3 py-1 text-xs font-semibold text-cobalt">Indicative estimate</span>
      </div>

      {/* Tax and transaction charges together, always - see invariant #3. */}
      {/* Always 2 columns, not a viewport-based breakpoint: this card can
          render at half width (paired side-by-side in the counterweight
          view), where a 4-column grid crams 6-7-figure rupee amounts into
          too little space and overflows into neighbouring cells. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-ink/[0.03] p-4 text-sm">
        <div>
          <dt className="text-xs text-ink/50">Gross gain</dt>
          <dd className={`font-display text-base font-semibold tabular-nums ${result.grossGain >= 0 ? 'text-ink' : 'text-vermilion'}`}>{formatPrice(result.grossGain)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/50">Tax + cess</dt>
          <dd className="font-display text-base font-semibold tabular-nums text-ink">
            {result.taxAmount === null ? '—' : formatPrice(result.taxAmount + (result.cessAmount ?? 0))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink/50">Transaction charges</dt>
          <dd className="font-display text-base font-semibold tabular-nums text-ink">{formatPrice(result.totalCharges)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/50">Net result</dt>
          <dd className={`font-display text-base font-semibold tabular-nums ${result.netProceeds === null ? 'text-ink' : result.netProceeds >= 0 ? 'text-ink' : 'text-vermilion'}`}>
            {result.netProceeds === null ? '—' : formatPrice(result.netProceeds)}
          </dd>
        </div>
      </dl>

      {result.warnings.length > 0 ? (
        <ul className="space-y-2 rounded-xl border border-vermilion/20 bg-vermilion/5 p-3.5">
          {result.warnings.map((warning, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink/75">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-vermilion" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      <details className="group rounded-xl border border-ink/10">
        <summary className="flex cursor-pointer list-none items-center justify-between p-3.5 text-sm font-medium text-ink focus-visible:ring-2 focus-visible:ring-vermilion">
          Full line-by-line breakdown
          <ChevronDown size={16} className="text-ink/40 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <dl className="space-y-2.5 border-t border-ink/10 p-3.5">
          {result.breakdown.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <dt className="text-ink">{line.label}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-ink/50">{line.explanation}</dd>
              </div>
              <dd className="shrink-0 tabular-nums text-ink">{formatPrice(line.amount)}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div>
        {explanation ? (
          <p className="rounded-xl bg-cobalt/5 p-3.5 text-sm leading-relaxed text-ink/80">{explanation}</p>
        ) : (
          <button
            type="button"
            onClick={handleExplain}
            disabled={explaining}
            className="flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-cobalt/50 hover:text-cobalt focus-visible:ring-2 focus-visible:ring-vermilion disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={14} aria-hidden="true" />
            {explaining ? 'Explaining...' : 'Explain this in plain English'}
          </button>
        )}
        {explainError ? (
          <p className="mt-1.5 text-xs text-vermilion" role="alert">
            {explainError}
          </p>
        ) : null}
      </div>
    </section>
  )
}
