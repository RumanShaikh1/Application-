import { CheckCircle2, XCircle } from 'lucide-react'
import type { RubricCriterionResult, TradeCostBreakdown, TradeSide } from '@shared/types'
import { formatPrice } from '../lib/formatStats'

interface TradeScoreBreakdownProps {
  scoreTotal: number
  maxScore: number
  criteria: RubricCriterionResult[]
  feedback: string
  costBreakdown: TradeCostBreakdown
  symbol: string
  side: TradeSide
  quantity: number
  currency: string
}

// Purely a presentational bucket computed from the score for display - not
// a new server concept (unlike Decision Replay's choiceQuality, there's no
// "sound choice list" for a live symbol to classify against).
function qualityLabel(scoreTotal: number, maxScore: number): { label: string; className: string } {
  const percent = maxScore > 0 ? (scoreTotal / maxScore) * 100 : 0
  if (percent >= 80) return { label: 'Strong process', className: 'bg-lime text-carbon' }
  if (percent >= 50) return { label: 'Reasonable process', className: 'bg-cobalt/15 text-cobalt' }
  return { label: 'Needs work', className: 'bg-vermilion/15 text-vermilion' }
}

// Deliberately has no "what happened" price-outcome section like Decision
// Replay's ScoreBreakdown.tsx - there is no scored "outcome" here. This
// view is about the trade's process, full stop; live P&L lives on the
// portfolio dashboard instead, kept separate on purpose.
export default function TradeScoreBreakdown({ scoreTotal, maxScore, criteria, feedback, costBreakdown, symbol, side, quantity, currency }: TradeScoreBreakdownProps) {
  const quality = qualityLabel(scoreTotal, maxScore)

  return (
    <div className="space-y-5">
      <section className="animate-fade-in rounded-2xl border border-ink/10 bg-surface p-5 shadow-liftedSm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Process score</p>
            <p className="font-display text-3xl font-semibold text-ink">
              {scoreTotal}
              <span className="text-lg text-ink/40"> / {maxScore}</span>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${quality.className}`}>{quality.label}</span>
        </div>
        <p className="mt-2 text-xs text-ink/50">
          {side === 'buy' ? 'Bought' : 'Sold'} {quantity} {symbol}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink/75">{feedback}</p>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-liftedSm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">What a sound trade considers</h3>
        <ul className="space-y-2.5">
          {criteria.map((criterion) => (
            <li key={criterion.id} className="flex gap-2.5">
              {criterion.matched ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
              ) : (
                <XCircle size={18} className="mt-0.5 shrink-0 text-ink/25" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm text-ink">{criterion.description}</p>
                {criterion.evidence ? <p className="mt-0.5 text-xs text-ink/50">{criterion.evidence}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-liftedSm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">Cost of this trade</h3>
        <p className="mb-3 text-xs leading-relaxed text-ink/55">
          Brokerage, STT, exchange fees, and slippage all apply to every order - real costs, even in a virtual account.
        </p>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink/60">Order value</span>
          <span className="font-display text-lg font-semibold tabular-nums text-ink">{formatPrice(costBreakdown.grossValue, currency)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm text-ink/60">Cash impact</span>
          <span className={`font-display text-lg font-semibold tabular-nums ${costBreakdown.netCashImpact >= 0 ? 'text-ink' : 'text-vermilion'}`}>
            {costBreakdown.netCashImpact >= 0 ? '+' : ''}
            {formatPrice(costBreakdown.netCashImpact, currency)}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ink/10 pt-3 text-xs text-ink/55">
          <div className="flex justify-between">
            <dt>Brokerage</dt>
            <dd className="tabular-nums">{formatPrice(costBreakdown.brokerageCost, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>STT</dt>
            <dd className="tabular-nums">{formatPrice(costBreakdown.sttCost, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Exchange fees</dt>
            <dd className="tabular-nums">{formatPrice(costBreakdown.exchangeFees, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Slippage</dt>
            <dd className="tabular-nums">{formatPrice(costBreakdown.slippageCost, currency)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
