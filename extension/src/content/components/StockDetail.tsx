import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Newspaper, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import StatusState, { type ViewState } from './StatusState'
import PriceChart from './PriceChart'
import { formatPercent, formatPrice } from '../../lib/formatStats'
import { api } from '../../lib/api'
import type { ChartPoint, ChartRange, NewsItem, StockProfile, StockStats } from '@shared/types'

interface StockDetailProps {
  stat: StockStats
  onBack: () => void
}

const RANGE_OPTIONS: { id: ChartRange; label: string }[] = [
  { id: '1w', label: '1W' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '1y', label: '1Y' }
]

const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_buy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strong_sell: 'Strong Sell',
  underperform: 'Underperform',
  outperform: 'Outperform'
}

type ContextState = 'idle' | 'loading' | 'done' | 'error'

export default function StockDetail({ stat, onBack }: StockDetailProps) {
  const [profileState, setProfileState] = useState<ViewState>('loading')
  const [profile, setProfile] = useState<StockProfile | null>(null)
  const [profileError, setProfileError] = useState('')

  const [news, setNews] = useState<NewsItem[]>([])
  const [newsState, setNewsState] = useState<ViewState>('loading')
  const [newsError, setNewsError] = useState('')

  const [chartVisible, setChartVisible] = useState(false)
  const [chartRange, setChartRange] = useState<ChartRange>('1mo')
  const [chartAttempt, setChartAttempt] = useState(0)
  const [chartState, setChartState] = useState<ViewState>('loading')
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([])
  const [chartError, setChartError] = useState('')

  const [context, setContext] = useState('')
  const [contextState, setContextState] = useState<ContextState>('idle')
  const [contextError, setContextError] = useState('')

  useEffect(() => {
    setProfileState('loading')
    api
      .getStockProfile(stat.symbol)
      .then((result) => {
        setProfile(result)
        setProfileState('populated')
      })
      .catch((error: unknown) => {
        setProfileError(error instanceof Error ? error.message : 'Could not load insights.')
        setProfileState('error')
      })
  }, [stat.symbol])

  useEffect(() => {
    setNewsState('loading')
    api
      .getStockNews(stat.symbol)
      .then((result) => {
        setNews(result)
        setNewsState(result.length === 0 ? 'empty' : 'populated')
      })
      .catch((error: unknown) => {
        setNewsError(error instanceof Error ? error.message : 'Could not load news.')
        setNewsState('error')
      })
  }, [stat.symbol])

  useEffect(() => {
    if (!chartVisible) return
    setChartState('loading')
    api
      .getStockChart(stat.symbol, chartRange)
      .then((points) => {
        setChartPoints(points)
        setChartState(points.length === 0 ? 'empty' : 'populated')
      })
      .catch((error: unknown) => {
        setChartError(error instanceof Error ? error.message : 'Could not load chart data.')
        setChartState('error')
      })
  }, [chartVisible, chartRange, chartAttempt, stat.symbol])

  function requestContext(): void {
    setContextState('loading')
    api
      .getStockContext({ symbol: stat.symbol, name: stat.name, headlines: news.map((item) => item.title) })
      .then((result) => {
        setContext(result)
        setContextState('done')
      })
      .catch((error: unknown) => {
        setContextError(error instanceof Error ? error.message : 'Could not generate context.')
        setContextState('error')
      })
  }

  const isUp = stat.changePercent >= 0

  return (
    <div className="animate-fade-in space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-full py-1 pr-2 text-xs font-medium text-ink/60 transition-colors hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion dark:text-bone/60"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back
      </button>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-ink dark:text-bone">{stat.symbol}</p>
          <p className="text-xs text-ink/55 dark:text-bone/55">{stat.name}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold tabular-nums text-ink dark:text-bone">
            {formatPrice(stat.price, stat.currency)}
          </p>
          <p
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
              isUp ? 'bg-lime text-ink' : 'bg-vermilion/15 text-ink dark:text-bone'
            }`}
          >
            {isUp ? (
              <TrendingUp size={12} aria-hidden="true" className="text-ink" />
            ) : (
              <TrendingDown size={12} aria-hidden="true" className="text-vermilion" />
            )}
            {formatPercent(stat.changePercent)}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-hairline border-ink/10 bg-bone p-4 shadow-liftedSm dark:border-bone/10 dark:bg-bone/[0.04] dark:shadow-liftedSmDark">
        <h3 className="mb-2.5 text-xs font-semibold text-ink/60 dark:text-bone/60">More insights</h3>
        <StatusState state={profileState} loadingLabel="Loading insights..." errorMessage={profileError}>
          {profile ? (
            <div className="space-y-2 text-xs text-ink/80 dark:text-bone/80">
              {profile.sector ? (
                <p>
                  <span className="text-ink/50 dark:text-bone/50">Sector: </span>
                  {profile.sector}
                  {profile.industry ? ` · ${profile.industry}` : ''}
                </p>
              ) : null}
              {profile.recommendationKey ? (
                <p>
                  <span className="text-ink/50 dark:text-bone/50">Analyst view: </span>
                  {RECOMMENDATION_LABELS[profile.recommendationKey] ?? profile.recommendationKey}
                  {profile.numberOfAnalystOpinions ? ` (${profile.numberOfAnalystOpinions} analysts)` : ''}
                  {profile.targetMeanPrice ? ` · target ${formatPrice(profile.targetMeanPrice, stat.currency)}` : ''}
                </p>
              ) : null}
              {profile.profitMargins !== null ? (
                <p>
                  <span className="text-ink/50 dark:text-bone/50">Profit margin: </span>
                  {(profile.profitMargins * 100).toFixed(1)}%
                  {profile.revenueGrowth !== null ? ` · Revenue growth ${(profile.revenueGrowth * 100).toFixed(1)}%` : ''}
                </p>
              ) : null}
              {profile.description ? (
                <p className="pt-1 text-sm leading-relaxed text-ink/70 dark:text-bone/70">
                  {profile.description.length > 260 ? `${profile.description.slice(0, 260)}...` : profile.description}
                </p>
              ) : null}
            </div>
          ) : null}
        </StatusState>
      </section>

      <section className="rounded-xl bg-ink p-4 shadow-soft">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-bone/65">Price chart</h3>
          {chartVisible ? (
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setChartRange(option.id)}
                  aria-pressed={chartRange === option.id}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-vermilion ${
                    chartRange === option.id ? 'bg-vermilion/20 text-vermilion' : 'text-bone/50 hover:text-bone/80'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {chartVisible ? (
          <StatusState
            state={chartState}
            loadingLabel="Loading chart..."
            errorMessage={chartError}
            onRetry={() => setChartAttempt((n) => n + 1)}
          >
            <PriceChart points={chartPoints} currency={stat.currency} />
          </StatusState>
        ) : (
          <button
            type="button"
            onClick={() => setChartVisible(true)}
            className="w-full rounded-full border border-hairline border-bone/20 py-2.5 text-xs font-medium text-bone/70 transition-colors hover:border-vermilion/60 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
          >
            Show price chart
          </button>
        )}
      </section>

      <section className="rounded-xl border border-hairline border-ink/10 bg-bone p-4 shadow-liftedSm dark:border-bone/10 dark:bg-bone/[0.04] dark:shadow-liftedSmDark">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-ink/60 dark:text-bone/60">
          <Newspaper size={12} aria-hidden="true" />
          Recent news
        </h3>
        <StatusState
          state={newsState}
          loadingLabel="Loading news..."
          emptyTitle="No recent news found"
          emptyBody={`We couldn't find recent headlines mentioning ${stat.symbol}.`}
          errorMessage={newsError}
        >
          <ul className="space-y-2">
            {news.map((item) => (
              <li key={item.link}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-1.5 text-xs text-cobalt transition-opacity hover:opacity-75 dark:text-cobalt-light"
                >
                  <ExternalLink size={11} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>
                    {item.title}
                    <span className="ml-1 text-ink/50 dark:text-bone/50">— {item.publisher}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>

          {contextState === 'idle' ? (
            <button
              type="button"
              onClick={requestContext}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-[11px] font-semibold text-ink transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-vermilion"
            >
              <Sparkles size={12} aria-hidden="true" />
              Why this matters right now
            </button>
          ) : null}
          {contextState === 'loading' ? (
            <p className="mt-3 text-[11px] text-ink/50 dark:text-bone/50">Thinking...</p>
          ) : null}
          {contextState === 'error' ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] text-ink dark:text-bone">{contextError}</p>
              <button
                type="button"
                onClick={requestContext}
                className="rounded-full bg-vermilion px-3 py-1 text-[11px] font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion"
              >
                Retry
              </button>
            </div>
          ) : null}
          {contextState === 'done' ? (
            <p className="mt-3 rounded-lg bg-ink/[0.03] p-3 text-sm leading-relaxed text-ink/80 dark:bg-bone/[0.05] dark:text-bone/80">
              {context}
            </p>
          ) : null}
        </StatusState>
      </section>
    </div>
  )
}
