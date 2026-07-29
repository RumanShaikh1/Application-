import { CheckCircle2, XCircle } from 'lucide-react'
import type { ChoiceQuality, CostBreakdown, RubricCriterionResult, ScenarioOutcome } from '@shared/types'
import { formatPercent, formatPrice } from '../lib/formatStats'
import ScenarioChart from './ScenarioChart'

interface ScoreBreakdownProps {
  scoreTotal: number
  maxScore: number
  choiceQuality: ChoiceQuality
  criteria: RubricCriterionResult[]
  feedback: string
  idealSummary: string
  outcome: ScenarioOutcome
  costBreakdown: CostBreakdown
  decisionDay: number
}

const QUALITY_LABEL: Record<ChoiceQuality, string> = {
  sound: 'Sound decision',
  acceptable: 'Acceptable decision',
  poor: 'Off the mark'
}

const QUALITY_CLASS: Record<ChoiceQuality, string> = {
  sound: 'bg-lime text-carbon',
  acceptable: 'bg-cobalt/15 text-cobalt',
  poor: 'bg-vermilion/15 text-vermilion'
}

export default function ScoreBreakdown({
  scoreTotal,
  maxScore,
  choiceQuality,
  criteria,
  feedback,
  idealSummary,
  outcome,
  costBreakdown,
  decisionDay
}: ScoreBreakdownProps) {
  return (
    <div className="space-y-5">
      <section className="animate-fade-in rounded-2xl border border-ink/10 bg-surface p-5 shadow-liftedSm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Your score</p>
            <p className="font-display text-3xl font-semibold text-ink">
              {scoreTotal}
              <span className="text-lg text-ink/40"> / {maxScore}</span>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${QUALITY_CLASS[choiceQuality]}`}>{QUALITY_LABEL[choiceQuality]}</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink/75">{feedback}</p>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-liftedSm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">What a sound decision considers</h3>
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
        <p className="mt-4 rounded-xl bg-ink/[0.03] p-3.5 text-sm leading-relaxed text-ink/75">{idealSummary}</p>
      </section>

      <section className="rounded-2xl bg-carbon p-5 shadow-soft">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-chalk/50">What happened</h3>
        <p className="mb-3 text-xs leading-relaxed text-chalk/60">
          This reflects what happened - which is not the same as whether you were right. Scenarios are graded on the quality of your decision given what
          was known at the time, never on the outcome.
        </p>
        <ScenarioChart points={outcome.priceSeries} decisionDay={decisionDay} />
        <p className="mt-4 text-sm leading-relaxed text-chalk/80">{outcome.summary}</p>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-liftedSm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">Cost of a real round trip</h3>
        <p className="mb-3 text-xs leading-relaxed text-ink/55">
          Illustrative for a 100-share position - brokerage, STT, exchange fees, and slippage all eat into returns. The percentages are what matter; rupee
          amounts just make the drag concrete.
        </p>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink/60">Gross return</span>
          <span className="font-display text-lg font-semibold tabular-nums text-ink">{formatPercent(costBreakdown.grossReturnPercent)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm text-ink/60">Net of costs</span>
          <span className={`font-display text-lg font-semibold tabular-nums ${costBreakdown.netReturnPercent >= 0 ? 'text-ink' : 'text-vermilion'}`}>
            {formatPercent(costBreakdown.netReturnPercent)}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ink/10 pt-3 text-xs text-ink/55">
          <div className="flex justify-between">
            <dt>Brokerage</dt>
            <dd className="tabular-nums">{formatPrice(costBreakdown.brokerageCost)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>STT</dt>
            <dd className="tabular-nums">{formatPrice(costBreakdown.sttCost)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Exchange fees</dt>
            <dd className="tabular-nums">{formatPrice(costBreakdown.exchangeFees)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Slippage</dt>
            <dd className="tabular-nums">{formatPrice(costBreakdown.slippageCost)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
