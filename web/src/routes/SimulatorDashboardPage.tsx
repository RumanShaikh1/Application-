import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import StatusState, { type ViewState } from '../components/StatusState'
import PortfolioSummary from '../components/PortfolioSummary'
import ChoiceSelector from '../components/ChoiceSelector'
import { api } from '../lib/api'
import { getState, resetPortfolio } from '../lib/portfolioStore'
import { advanceSandboxDay, getSandboxState, resetSandboxPortfolio } from '../lib/sandboxPortfolioStore'
import { getStoredSimulatorMode, storeSimulatorMode, type SimulatorMode } from '../lib/simulatorModeStore'
import { formatPrice } from '../lib/formatStats'
import { THESIS_CHOICES } from '../lib/thesisChoices'
import type { PortfolioGradeReport, PortfolioGradeLevel, PortfolioValuation, SandboxTrade, TradeRecord } from '@shared/types'

const MODE_CHOICES = [
  { id: 'live', label: 'Live trading', description: 'Real current market data, virtual cash.' },
  { id: 'replay', label: '2020 replay', description: 'Real historical prices - the COVID crash and recovery, day by day.' }
]

const GRADE_LEVEL_COPY: Record<PortfolioGradeLevel, { label: string; className: string }> = {
  strong: { label: 'Strong', className: 'bg-lime text-carbon' },
  sound: { label: 'Sound', className: 'bg-cobalt/15 text-cobalt' },
  needs_attention: { label: 'Worth a look', className: 'bg-vermilion/15 text-vermilion' }
}

function thesisLabel(id: string): string {
  return THESIS_CHOICES.find((choice) => choice.id === id)?.label ?? id
}

export default function SimulatorDashboardPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<SimulatorMode>(() => getStoredSimulatorMode())
  const [state, setState] = useState<ViewState>('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const [liveValuation, setLiveValuation] = useState<PortfolioValuation | null>(null)
  const [liveTrades, setLiveTrades] = useState<TradeRecord[]>([])

  const [replayValuation, setReplayValuation] = useState<PortfolioValuation | null>(null)
  const [replayTrades, setReplayTrades] = useState<SandboxTrade[]>([])
  const [dayCursor, setDayCursor] = useState(0)
  const [windowLastDay, setWindowLastDay] = useState(0)
  const [todayDate, setTodayDate] = useState('')
  const [gradeReport, setGradeReport] = useState<PortfolioGradeReport | null>(null)

  const load = useCallback(() => {
    setState('loading')
    setError('')

    if (mode === 'live') {
      const local = getState()
      setLiveTrades(local.trades)
      api.simulator
        .valuePortfolio(local.portfolio)
        .then((result) => {
          setLiveValuation(result)
          setState('populated')
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Could not load your portfolio.')
          setState('error')
        })
      return
    }

    const local = getSandboxState()
    setReplayTrades(local.tradeLog)
    setDayCursor(local.dayCursor)
    Promise.all([
      api.sandbox.valuePortfolio(local.portfolio, local.dayCursor),
      api.sandbox.getWindowInfo(),
      api.sandbox.getPricesForDay(local.dayCursor),
      api.sandbox.gradePortfolio(local)
    ])
      .then(([valuation, windowInfo, prices, grade]) => {
        setReplayValuation(valuation)
        setWindowLastDay(windowInfo.lastDay)
        setTodayDate(prices.quotes[0]?.date ?? '')
        setGradeReport(grade)
        setState('populated')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load your replay portfolio.')
        setState('error')
      })
  }, [mode])

  useEffect(() => {
    load()
  }, [load, attempt])

  function handleModeChange(next: string): void {
    const nextMode = next as SimulatorMode
    setMode(nextMode)
    storeSimulatorMode(nextMode)
    setAttempt((n) => n + 1)
  }

  function handleReset(): void {
    if (mode === 'live') {
      if (!window.confirm('Reset your simulator portfolio? This clears your virtual cash balance, holdings, and trade history.')) return
      resetPortfolio()
    } else {
      if (!window.confirm('Reset your 2020 replay? This clears your virtual cash balance, holdings, trade history, and takes you back to day 0.')) return
      resetSandboxPortfolio()
    }
    setAttempt((n) => n + 1)
  }

  function handleAdvance(days: number): void {
    advanceSandboxDay(days, windowLastDay)
    setAttempt((n) => n + 1)
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Simulator</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">
          {mode === 'live'
            ? 'Virtual cash, real market data. Every trade is graded on process - position sizing, diversification, and your stated reasoning - never on profit or loss.'
            : "Virtual cash, real 2020 daily closes - the COVID crash and recovery, replayed day by day. Judged the same way: how soundly you sized, diversified, and reasoned through it, never whether the number went up or down. A large, unhedged bet that happens to pay off isn't a better decision than one that doesn't - both are graded the same."}
        </p>
      </div>

      <ChoiceSelector choices={MODE_CHOICES} selectedId={mode} onSelect={handleModeChange} legend="Trading mode" />

      <StatusState state={state} loadingLabel="Loading your portfolio..." errorMessage={error} onRetry={() => setAttempt((n) => n + 1)}>
        {mode === 'live' && liveValuation ? (
          <div className="space-y-5">
            <PortfolioSummary valuation={liveValuation} />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/simulator/trade')}
                className="flex-1 rounded-full bg-vermilion py-3 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
              >
                New trade
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-ink/15 px-4 py-3 text-sm font-medium text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
              >
                Reset portfolio
              </button>
            </div>

            <section>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Trade history</h2>
              {liveTrades.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-surface py-10 text-center">
                  <Wallet size={20} className="text-ink/40" aria-hidden="true" />
                  <p className="text-sm text-ink/55">No trades yet - place your first one to get started.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {[...liveTrades].reverse().map((trade) => (
                    <li key={trade.id} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-surface p-3.5 text-sm">
                      <div>
                        <span className={`font-semibold ${trade.side === 'buy' ? 'text-cobalt' : 'text-vermilion'}`}>
                          {trade.side === 'buy' ? 'Buy' : 'Sell'}
                        </span>
                        <span className="ml-1.5 font-medium text-ink">
                          {trade.quantity} {trade.symbol}
                        </span>
                        <span className="ml-1.5 text-ink/50">@ {formatPrice(trade.price)}</span>
                      </div>
                      <span className="text-xs text-ink/40">{new Date(trade.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {mode === 'replay' && replayValuation ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Day {dayCursor} of {windowLastDay}</p>
                  <p className="font-display text-base font-semibold text-ink">{todayDate}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdvance(1)}
                    disabled={dayCursor >= windowLastDay}
                    className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +1 day
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdvance(5)}
                    disabled={dayCursor >= windowLastDay}
                    className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +1 week
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdvance(20)}
                    disabled={dayCursor >= windowLastDay}
                    className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +1 month
                  </button>
                </div>
              </div>
            </section>

            <PortfolioSummary valuation={replayValuation} />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/simulator/trade')}
                className="flex-1 rounded-full bg-vermilion py-3 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
              >
                New trade
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-ink/15 px-4 py-3 text-sm font-medium text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
              >
                Reset
              </button>
            </div>

            {gradeReport ? (
              <section className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-ink">Your process grade</h2>
                  <span className="rounded-full bg-cobalt/10 px-3 py-1 text-xs font-semibold text-cobalt">Process, not profit</span>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-ink/50">
                  This reflects how soundly you sized positions, diversified, handled this window's sharpest drawdown, and reasoned through your buys -
                  never your portfolio's return. A big bet that happens to work out is not graded as a better decision than one that doesn't.
                </p>
                <p className="mb-3 text-sm leading-relaxed text-ink/75">{gradeReport.summary}</p>
                <ul className="space-y-2">
                  {gradeReport.dimensions.map((dimension) => {
                    const copy = GRADE_LEVEL_COPY[dimension.level]
                    return (
                      <li key={dimension.dimension} className="rounded-xl bg-ink/[0.03] p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${copy.className}`}>{copy.label}</span>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{dimension.explanation}</p>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            <section>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Trade history</h2>
              {replayTrades.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-surface py-10 text-center">
                  <Wallet size={20} className="text-ink/40" aria-hidden="true" />
                  <p className="text-sm text-ink/55">No trades yet - place your first one to get started.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {[...replayTrades].reverse().map((trade) => (
                    <li key={trade.id} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-surface p-3.5 text-sm">
                      <div>
                        <span className={`font-semibold ${trade.side === 'buy' ? 'text-cobalt' : 'text-vermilion'}`}>
                          {trade.side === 'buy' ? 'Buy' : 'Sell'}
                        </span>
                        <span className="ml-1.5 font-medium text-ink">
                          {trade.quantity} {trade.symbol}
                        </span>
                        <span className="ml-1.5 text-ink/50">@ {formatPrice(trade.price)}</span>
                        <span className="ml-1.5 text-xs text-ink/40">- {thesisLabel(trade.thesisTag)}</span>
                      </div>
                      <span className="text-xs text-ink/40">Day {trade.day}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </StatusState>
    </div>
  )
}
