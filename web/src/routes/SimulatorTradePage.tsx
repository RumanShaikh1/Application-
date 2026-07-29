import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Info } from 'lucide-react'
import TradeTicket from '../components/TradeTicket'
import TradeScoreBreakdown from '../components/TradeScoreBreakdown'
import SandboxTradeTicket from '../components/SandboxTradeTicket'
import { api } from '../lib/api'
import { getState, recordTrade } from '../lib/portfolioStore'
import { getSandboxState, saveSandboxTradeState } from '../lib/sandboxPortfolioStore'
import { getStoredSimulatorMode } from '../lib/simulatorModeStore'
import { formatPrice } from '../lib/formatStats'
import { THESIS_CHOICES } from '../lib/thesisChoices'
import type { SandboxTradeResult, ThesisTag, TradeResponse, TradeSide } from '@shared/types'

function thesisLabel(id: string): string {
  return THESIS_CHOICES.find((choice) => choice.id === id)?.label ?? id
}

export default function SimulatorTradePage() {
  const navigate = useNavigate()
  const mode = getStoredSimulatorMode()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [liveResult, setLiveResult] = useState<TradeResponse | null>(null)
  const [replayResult, setReplayResult] = useState<SandboxTradeResult | null>(null)

  async function handleLiveSubmit(params: { symbol: string; side: TradeSide; quantity: number; rationale: string }): Promise<void> {
    setSubmitting(true)
    setSubmitError('')
    try {
      const { portfolio } = getState()
      const response = await api.simulator.trade({ portfolio, ...params })
      recordTrade(response.updatedPortfolio, response.trade)
      setLiveResult(response)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not place this trade.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReplaySubmit(params: { symbol: string; side: TradeSide; quantity: number; thesisTag?: ThesisTag }): Promise<void> {
    setSubmitting(true)
    setSubmitError('')
    try {
      const state = getSandboxState()
      const response = await api.sandbox.trade({ state, ...params })
      saveSandboxTradeState(response.state)
      setReplayResult(response)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not place this trade.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <button
        type="button"
        onClick={() => navigate('/simulator')}
        className="flex items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-medium text-ink/60 transition-colors hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Portfolio
      </button>

      {liveResult ? (
        <>
          <TradeScoreBreakdown
            scoreTotal={liveResult.processScore.scoreTotal}
            maxScore={liveResult.processScore.maxScore}
            criteria={liveResult.processScore.criteria}
            feedback={liveResult.processScore.feedback}
            costBreakdown={liveResult.trade.costBreakdown}
            symbol={liveResult.trade.symbol}
            side={liveResult.trade.side}
            quantity={liveResult.trade.quantity}
            currency="INR"
          />
          <button
            type="button"
            onClick={() => navigate('/simulator')}
            className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
          >
            Back to portfolio
          </button>
        </>
      ) : replayResult ? (
        <>
          <section className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
            <p className="text-sm">
              <span className={`font-semibold ${replayResult.trade.side === 'buy' ? 'text-cobalt' : 'text-vermilion'}`}>
                {replayResult.trade.side === 'buy' ? 'Bought' : 'Sold'}
              </span>
              <span className="ml-1.5 font-medium text-ink">
                {replayResult.trade.quantity} {replayResult.trade.symbol}
              </span>
              <span className="ml-1.5 text-ink/60">@ {formatPrice(replayResult.trade.price)} on day {replayResult.trade.day}</span>
            </p>
            <p className="mt-1 text-xs text-ink/45">Reason: {thesisLabel(replayResult.trade.thesisTag)}</p>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ink/10 pt-3 text-xs text-ink/55">
              <div className="flex justify-between">
                <dt>Brokerage</dt>
                <dd className="tabular-nums">{formatPrice(replayResult.trade.costBreakdown.brokerageCost)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>STT</dt>
                <dd className="tabular-nums">{formatPrice(replayResult.trade.costBreakdown.sttCost)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Exchange fees</dt>
                <dd className="tabular-nums">{formatPrice(replayResult.trade.costBreakdown.exchangeFees)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Slippage</dt>
                <dd className="tabular-nums">{formatPrice(replayResult.trade.costBreakdown.slippageCost)}</dd>
              </div>
            </dl>
          </section>

          {replayResult.signals.length > 0 ? (
            <section className="space-y-2">
              {replayResult.signals.map((signal, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 rounded-2xl border p-3.5 text-sm ${
                    signal.tone === 'celebrate' ? 'border-lime/40 bg-lime/10' : 'border-vermilion/20 bg-vermilion/5'
                  }`}
                >
                  {signal.tone === 'celebrate' ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
                  ) : (
                    <Info size={16} className="mt-0.5 shrink-0 text-vermilion" aria-hidden="true" />
                  )}
                  <p className="leading-relaxed text-ink/75">{signal.message}</p>
                </div>
              ))}
            </section>
          ) : null}

          {replayResult.closeSummary ? (
            <section className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/45">Position closed - a reflection, not a grade</h3>
              <p className="text-sm leading-relaxed text-ink/70">
                You got in on day {replayResult.closeSummary.entryDay} because <strong className="text-ink">{thesisLabel(replayResult.closeSummary.thesisTag)}</strong>.
                {' '}You're out on day {replayResult.closeSummary.exitDay}: {formatPrice(replayResult.closeSummary.entryPrice)} →{' '}
                {formatPrice(replayResult.closeSummary.exitPrice)}. This is here to help you reflect on your own reasoning - it was never part of your
                process grade, which only ever looked at the decision, not this outcome.
              </p>
            </section>
          ) : null}

          <button
            type="button"
            onClick={() => navigate('/simulator')}
            className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
          >
            Back to portfolio
          </button>
        </>
      ) : (
        <>
          <h1 className="mb-1 font-display text-xl font-semibold text-ink">New trade</h1>
          {mode === 'live' ? (
            <TradeTicket onSubmit={handleLiveSubmit} submitting={submitting} submitError={submitError} />
          ) : (
            <SandboxTradeTicket dayCursor={getSandboxState().dayCursor} onSubmit={handleReplaySubmit} submitting={submitting} submitError={submitError} />
          )}
        </>
      )}
    </div>
  )
}
