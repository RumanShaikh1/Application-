import { useEffect, useState } from 'react'
import { Clock, TrendingDown } from 'lucide-react'
import StatusState, { type ViewState } from './StatusState'
import TaxResultBreakdown from './TaxResultBreakdown'
import { api, type TaxCounterweightResponse } from '../lib/api'
import { formatPrice } from '../lib/formatStats'
import type { TaxTradeInput } from '@shared/types'

interface DaysToLongTermCounterProps {
  trade: TaxTradeInput
}

/**
 * The centrepiece: days remaining until this position is long-term, paired
 * with the counterweight (what an adverse price move over that wait would
 * cost) - never shown without it. See CLAUDE.md's Product Invariants and
 * the brief this module was built from: "do not ship the counter without
 * the counterweight."
 */
export default function DaysToLongTermCounter({ trade }: DaysToLongTermCounterProps) {
  const [state, setState] = useState<ViewState>('loading')
  const [data, setData] = useState<TaxCounterweightResponse | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    api.tax
      .counterweight(trade)
      .then((response) => {
        if (cancelled) return
        setData(response)
        setState('populated')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not compute the days-to-long-term counter.')
        setState('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade, attempt])

  return (
    <section className="space-y-4">
      <StatusState state={state} loadingLabel="Working out how much time is left..." errorMessage={error} onRetry={() => setAttempt((n) => n + 1)}>
        {data ? (
          <>
            <div className="rounded-2xl border border-cobalt/20 bg-cobalt/5 p-5">
              <div className="flex items-center gap-2 text-cobalt">
                <Clock size={18} aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide">Days until long-term</p>
              </div>
              <p className="mt-1.5 font-display text-4xl font-semibold text-ink">{data.daysRemaining}</p>
              <p className="mt-1 text-sm text-ink/60">
                Becomes long-term on {new Date(data.longTermEligibleDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                data.breakeven.worthWaitingAtCurrentPrice ? 'border-vermilion/20 bg-vermilion/5' : 'border-ink/10 bg-ink/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2 text-vermilion">
                <TrendingDown size={18} aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide">The counterweight</p>
              </div>
              {data.breakeven.worthWaitingAtCurrentPrice ? (
                <p className="mt-1.5 text-sm leading-relaxed text-ink/80">
                  Waiting is only worth it if the price does not fall more than{' '}
                  <span className="font-semibold text-ink">
                    {formatPrice(data.breakeven.breakevenMoveRupees)} ({data.breakeven.breakevenMovePercent.toFixed(1)}%)
                  </span>{' '}
                  before then. A bigger drop than that erases the entire tax saving from waiting.
                </p>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-ink/80">
                  Waiting doesn't help here - the tax saving from selling long-term doesn't cover this trade's own transaction costs, even if the price
                  doesn't move at all.
                </p>
              )}
              <p className="mt-2 text-xs text-ink/45">{data.assumptionNote}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TaxResultBreakdown trade={trade} result={data.sellTodayResult} title="Sell today" />
              <TaxResultBreakdown trade={{ ...trade, sellDate: data.longTermEligibleDate }} result={data.holdResult} title="Hold to long-term (if price doesn't move)" />
            </div>
          </>
        ) : null}
      </StatusState>
    </section>
  )
}
