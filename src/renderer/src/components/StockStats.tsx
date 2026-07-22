import { useEffect, useState } from 'react'
import { Lightbulb, LineChart, TrendingDown, TrendingUp } from 'lucide-react'
import Panel from './Panel'
import StatusState, { type ViewState } from './StatusState'
import { formatMarketCap, formatPercent, formatPrice } from '@renderer/lib/formatStats'
import type { StockStats as StockStatsData } from '@shared/ipc-channels'

interface StockStatsProps {
  symbols: string[]
  onExplainTerm: (text: string) => void
  onSelectStock: (stat: StockStatsData) => void
}

export default function StockStats({ symbols, onExplainTerm, onSelectStock }: StockStatsProps) {
  const [viewState, setViewState] = useState<ViewState>('empty')
  const [stats, setStats] = useState<StockStatsData[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const symbolsKey = symbols.join(',')

  useEffect(() => {
    if (symbols.length === 0) {
      setStats([])
      setViewState('empty')
      return
    }

    let cancelled = false
    setViewState('loading')

    window.api
      .getMarketStats(symbols)
      .then((results) => {
        if (cancelled) return
        setStats(results)
        setViewState(results.length === 0 ? 'empty' : 'populated')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'Could not load stock stats.')
        setViewState('error')
      })

    return () => {
      cancelled = true
    }
    // Re-fetch whenever the detected ticker set changes or Retry is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, attempt])

  return (
    <Panel icon={LineChart} title="On This Page" subtitle="Live stats for stocks mentioned here">
      <StatusState
        state={viewState}
        loadingLabel="Fetching live quotes..."
        emptyIcon={LineChart}
        emptyTitle="No stocks detected"
        emptyBody="Browse a page that mentions specific tickers to see live stats here."
        errorMessage={errorMessage}
        onRetry={() => setAttempt((n) => n + 1)}
      >
        <div className="animate-fade-in space-y-3">
          {stats.map((stat) => (
            <StockCard key={stat.symbol} stat={stat} onExplainTerm={onExplainTerm} onSelectStock={onSelectStock} />
          ))}
        </div>
      </StatusState>
    </Panel>
  )
}

interface StockCardProps {
  stat: StockStatsData
  onExplainTerm: (text: string) => void
  onSelectStock: (stat: StockStatsData) => void
}

function StockCard({ stat, onExplainTerm, onSelectStock }: StockCardProps) {
  const isUp = stat.changePercent >= 0

  return (
    <div className="border border-hairline border-ink/15 bg-bone p-3.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectStock(stat)}
          className="min-w-0 text-left focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          <p className="font-display text-sm font-semibold text-cobalt underline decoration-cobalt/40 decoration-dotted underline-offset-2 hover:decoration-cobalt">
            {stat.symbol}
          </p>
          <p className="truncate text-[11px] text-ink/55">{stat.name}</p>
        </button>
        <div className="shrink-0 text-right">
          <p className="font-display text-sm font-semibold tabular-nums text-ink">
            {formatPrice(stat.price, stat.currency)}
          </p>
          <p
            className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
              isUp ? 'bg-lime text-ink' : 'bg-vermilion/15 text-ink'
            }`}
          >
            {isUp ? (
              <TrendingUp size={11} aria-hidden="true" className="text-ink" />
            ) : (
              <TrendingDown size={11} aria-hidden="true" className="text-vermilion" />
            )}
            {formatPercent(stat.changePercent)}
          </p>
        </div>
      </div>

      <div className="mt-2 divide-y divide-ink/10 border-t border-hairline border-ink/15">
        {stat.bid !== null && stat.ask !== null ? (
          <StatRow
            label="Bid / Ask"
            value={`${formatPrice(stat.bid, stat.currency)} / ${formatPrice(stat.ask, stat.currency)}`}
            onExplain={() =>
              onExplainTerm(
                `${stat.symbol}'s bid price is ${formatPrice(stat.bid as number, stat.currency)} (what buyers are offering) and ask price is ${formatPrice(stat.ask as number, stat.currency)} (what sellers want).`
              )
            }
          />
        ) : null}
        {stat.marketCap !== null ? (
          <StatRow
            label="Market Cap"
            value={formatMarketCap(stat.marketCap, stat.currency)}
            onExplain={() =>
              onExplainTerm(`${stat.symbol}'s market cap is ${formatMarketCap(stat.marketCap as number, stat.currency)}.`)
            }
          />
        ) : null}
        {stat.beta !== null ? (
          <StatRow
            label="Volatility (Beta)"
            value={stat.beta.toFixed(2)}
            onExplain={() => onExplainTerm(`${stat.symbol} has a beta (volatility) of ${(stat.beta as number).toFixed(2)}.`)}
          />
        ) : null}
        {stat.dayLow !== null && stat.dayHigh !== null ? (
          <StatRow
            label="Day Range"
            value={`${formatPrice(stat.dayLow, stat.currency)} - ${formatPrice(stat.dayHigh, stat.currency)}`}
            onExplain={() =>
              onExplainTerm(
                `${stat.symbol} has traded between ${formatPrice(stat.dayLow as number, stat.currency)} and ${formatPrice(stat.dayHigh as number, stat.currency)} today.`
              )
            }
          />
        ) : null}
        {stat.fiftyTwoWeekLow !== null && stat.fiftyTwoWeekHigh !== null ? (
          <StatRow
            label="52-Week Range"
            value={`${formatPrice(stat.fiftyTwoWeekLow, stat.currency)} - ${formatPrice(stat.fiftyTwoWeekHigh, stat.currency)}`}
            onExplain={() =>
              onExplainTerm(
                `${stat.symbol}'s 52-week range is ${formatPrice(stat.fiftyTwoWeekLow as number, stat.currency)} to ${formatPrice(stat.fiftyTwoWeekHigh as number, stat.currency)}.`
              )
            }
          />
        ) : null}
      </div>
    </div>
  )
}

interface StatRowProps {
  label: string
  value: string
  onExplain: () => void
}

function StatRow({ label, value, onExplain }: StatRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink/55">{label}</span>
        <button
          type="button"
          onClick={onExplain}
          aria-label={`Explain ${label}`}
          className="p-0.5 text-vermilion/70 transition-colors hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          <Lightbulb size={12} aria-hidden="true" />
        </button>
      </div>
      <span className="font-display text-xs font-semibold tabular-nums text-ink">{value}</span>
    </div>
  )
}
