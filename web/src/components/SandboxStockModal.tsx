import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import Modal from './Modal'
import SandboxPriceChart from './SandboxPriceChart'
import StatusState, { type ViewState } from './StatusState'
import { api } from '../lib/api'
import { formatPrice } from '../lib/formatStats'
import type { SandboxCompanyDetail, SandboxFundamentals } from '@shared/types'

interface SandboxStockModalProps {
  symbol: string
  onClose: () => void
}

interface StatDefinition {
  key: keyof SandboxFundamentals
  label: string
  format: (fundamentals: SandboxFundamentals) => string
}

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: 'peRatio', label: 'P/E ratio', format: (f) => (f.peRatio != null ? f.peRatio.toFixed(1) : 'Not available') },
  { key: 'pbRatio', label: 'P/B ratio', format: (f) => (f.pbRatio != null ? f.pbRatio.toFixed(1) : 'Not available') },
  { key: 'roePercent', label: 'Return on equity', format: (f) => (f.roePercent != null ? `${f.roePercent.toFixed(1)}%` : 'Not published') },
  { key: 'marketCapCr', label: 'Market cap', format: (f) => `₹${f.marketCapCr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} cr` },
  { key: 'dividendYieldPercent', label: 'Dividend yield', format: (f) => (f.dividendYieldPercent != null ? `${f.dividendYieldPercent.toFixed(2)}%` : 'Not available') },
  { key: 'debtToEquity', label: 'Debt-to-equity', format: (f) => (f.debtToEquity != null ? f.debtToEquity.toFixed(2) : 'Not available') },
  { key: 'beta', label: 'Beta', format: (f) => (f.beta != null ? f.beta.toFixed(2) : 'Not available') },
  { key: 'fiftyTwoWeekLow', label: '52-week range', format: (f) => `${formatPrice(f.fiftyTwoWeekLow)} - ${formatPrice(f.fiftyTwoWeekHigh)}` }
]

/**
 * Opens in place over the Nifty 20 board - not a separate page/route. All
 * statistics and the real price graph are available for every one of the
 * 20 (prices.json covers the whole basket); strengths/weaknesses and the
 * checkpoint write-up only appear once authored for that symbol.
 */
export default function SandboxStockModal({ symbol, onClose }: SandboxStockModalProps) {
  const [state, setState] = useState<ViewState>('loading')
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<SandboxCompanyDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    api.sandbox
      .getCompanyDetail(symbol)
      .then((result) => {
        if (cancelled) return
        setDetail(result)
        setState('populated')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load this company.')
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [symbol])

  const titleId = `sandbox-stock-modal-${symbol}`

  return (
    <Modal titleId={titleId} title={detail?.company.name ?? 'Loading...'} onClose={onClose}>
      <div className="max-h-[75vh] overflow-y-auto scrollbar-spark pr-1">
        <StatusState state={state} loadingLabel="Loading this company..." errorMessage={error}>
          {detail ? (
            <div className="space-y-4">
              <p className="text-sm text-ink/55">{detail.company.sector}</p>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">Price - real 2020 window</h3>
                  <span className="rounded-full bg-cobalt/10 px-2.5 py-0.5 text-[11px] font-semibold text-cobalt">Indicative, not advice</span>
                </div>
                <SandboxPriceChart priceSeries={detail.priceSeries} checkpoints={detail.analysis?.checkpoints} />
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink">Statistics</h3>
                <dl className="grid grid-cols-2 gap-2.5">
                  {STAT_DEFINITIONS.map((stat) => (
                    <div key={stat.key} className="rounded-xl bg-ink/[0.03] p-2.5">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">{stat.label}</dt>
                      <dd className="mt-0.5 font-display text-base font-semibold tabular-nums text-ink">{stat.format(detail.company.fundamentals)}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {detail.analysis ? (
                <section>
                  <h3 className="mb-1 text-sm font-semibold text-ink">Strengths and weaknesses</h3>
                  <p className="mb-2 text-xs leading-relaxed text-ink/50">Descriptive only - not a recommendation. What you do with this is your call.</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ul className="space-y-1.5">
                      {detail.analysis.strengths.map((strength, i) => (
                        <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-ink/75">
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                    <ul className="space-y-1.5">
                      {detail.analysis.weaknesses.map((weakness, i) => (
                        <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-ink/75">
                          <XCircle size={14} className="mt-0.5 shrink-0 text-vermilion" aria-hidden="true" />
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ) : (
                <p className="rounded-xl bg-ink/[0.03] p-3 text-center text-xs leading-relaxed text-ink/55">
                  In-depth strengths/weaknesses analysis for this company hasn't been authored yet - the price graph and statistics above are real and
                  complete regardless.
                </p>
              )}
            </div>
          ) : null}
        </StatusState>
      </div>
    </Modal>
  )
}
