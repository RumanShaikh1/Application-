import { AlertTriangle } from 'lucide-react'
import { formatPrice } from '../lib/formatStats'
import type { LossHarvestingResult } from '@shared/types'

interface LossHarvestingSummaryProps {
  result: LossHarvestingResult
}

export default function LossHarvestingSummary({ result }: LossHarvestingSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-lime/40 bg-lime/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Remaining LTCG exemption headroom this FY</p>
        <p className="mt-1 font-display text-3xl font-semibold text-ink">{formatPrice(result.remainingLongTermExemption)}</p>
        <p className="mt-1 text-xs text-ink/50">After the realised gains and any loss offsets below - not a suggestion to use it, just what's left.</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-ink/[0.03] p-4 text-sm">
        <div>
          <dt className="text-xs text-ink/50">ST gains before</dt>
          <dd className="font-display text-base font-semibold tabular-nums text-ink">{formatPrice(result.totalShortTermGainsBeforeOffset)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/50">ST gains after</dt>
          <dd className="font-display text-base font-semibold tabular-nums text-ink">{formatPrice(result.totalShortTermGainsAfterOffset)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/50">LT gains before</dt>
          <dd className="font-display text-base font-semibold tabular-nums text-ink">{formatPrice(result.totalLongTermGainsBeforeOffset)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/50">LT gains after</dt>
          <dd className="font-display text-base font-semibold tabular-nums text-ink">{formatPrice(result.totalLongTermGainsAfterOffset)}</dd>
        </div>
      </dl>

      {result.suggestions.length > 0 ? (
        <section>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink/45">What booking these losses would offset</h3>
          <ul className="space-y-2">
            {result.suggestions.map((suggestion) => (
              <li key={suggestion.positionId} className="rounded-2xl border border-ink/10 bg-surface p-3.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{suggestion.label}</span>
                  <span className="tabular-nums text-vermilion">-{formatPrice(suggestion.lossAmount)}</span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-ink/55">
                  <div>
                    <dt>Offsets ST gains</dt>
                    <dd className="tabular-nums text-ink">{formatPrice(suggestion.offsetAppliedToShortTermGains)}</dd>
                  </div>
                  <div>
                    <dt>Offsets LT gains</dt>
                    <dd className="tabular-nums text-ink">{formatPrice(suggestion.offsetAppliedToLongTermGains)}</dd>
                  </div>
                  <div>
                    <dt>Left unoffset</dt>
                    <dd className="tabular-nums text-ink">{formatPrice(suggestion.remainingUnoffsetLoss)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
    </div>
  )
}
