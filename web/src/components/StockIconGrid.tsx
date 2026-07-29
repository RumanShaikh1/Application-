import { useEffect, useState } from 'react'
import { POPULAR_STOCKS } from '../lib/popularStocks'
import { api } from '../lib/api'
import { formatPercent, formatPrice } from '../lib/formatStats'
import MiniSparkline from './MiniSparkline'
import type { ChartPoint, StockStats } from '@shared/types'

interface StockIconGridProps {
  onSelect: (quote: StockStats) => void
}

// Cycled purely for visual variety across the grid, not tied to sector -
// the sector itself is already shown as text on each card, so the color
// doesn't need to (and shouldn't have to) carry meaning on its own.
const ICON_TINTS = ['bg-vermilion/10 text-vermilion', 'bg-cobalt/10 text-cobalt', 'bg-lime/20 text-ink'] as const

type ChartStatus = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; points: ChartPoint[] }

/**
 * A browsable "pick a company you recognize" grid, shown above the manual
 * ticker search on the trade ticket - the whole point is that a newcomer
 * shouldn't need to already know that Reliance trades as "RELIANCE.NS"
 * before they can do anything. Every name in POPULAR_STOCKS always renders
 * a card, even if its live quote/chart failed to load - a name silently
 * disappearing would be more confusing than an honest "unavailable right
 * now" on that one card.
 */
export default function StockIconGrid({ onSelect }: StockIconGridProps) {
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, StockStats>>({})
  const [chartsBySymbol, setChartsBySymbol] = useState<Record<string, ChartStatus>>({})

  useEffect(() => {
    let cancelled = false

    api
      .getQuotes(POPULAR_STOCKS.map((stock) => stock.symbol))
      .then((results) => {
        if (cancelled) return
        const bySymbol: Record<string, StockStats> = {}
        for (const quote of results) bySymbol[quote.symbol.toUpperCase()] = quote
        setQuotesBySymbol(bySymbol)
        setQuotesLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setQuotesBySymbol({})
        setQuotesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const pending = POPULAR_STOCKS.map((stock) => stock.symbol)

    setChartsBySymbol(Object.fromEntries(pending.map((symbol) => [symbol, { kind: 'loading' }])))

    for (const symbol of pending) {
      api
        .getChart(symbol, '1mo')
        .then((points) => {
          if (cancelled) return
          setChartsBySymbol((prev) => ({ ...prev, [symbol]: { kind: 'ready', points } }))
        })
        .catch(() => {
          if (cancelled) return
          setChartsBySymbol((prev) => ({ ...prev, [symbol]: { kind: 'error' } }))
        })
    }

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h2 className="mb-1 font-display text-base font-semibold text-ink">Choose a stock</h2>
      <p className="mb-3 text-sm text-ink/55">Tap a company you recognize - or search for another symbol further down.</p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {POPULAR_STOCKS.map((stock, index) => {
          const quote = quotesBySymbol[stock.symbol.toUpperCase()]
          const chartStatus = chartsBySymbol[stock.symbol] ?? { kind: 'loading' }
          const available = Boolean(quote)
          const tint = ICON_TINTS[index % ICON_TINTS.length]

          const accessibleName = quote
            ? `${stock.name}, ${stock.sector}, ${formatPrice(quote.price, quote.currency)}, ${quote.changePercent >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(quote.changePercent))} today`
            : `${stock.name}, ${stock.sector}, price unavailable right now`

          return (
            <button
              key={stock.symbol}
              type="button"
              disabled={!available && !quotesLoading}
              onClick={() => quote && onSelect(quote)}
              aria-label={accessibleName}
              className="flex flex-col items-start gap-2 rounded-2xl border border-ink/10 bg-surface p-3 text-left shadow-liftedSm transition-colors hover:border-vermilion/40 focus-visible:ring-2 focus-visible:ring-vermilion disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex w-full items-start gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${tint}`} aria-hidden="true">
                  {stock.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{stock.name}</span>
                  <span className="block truncate text-xs text-ink/45">{stock.sector}</span>
                </span>
              </div>

              {quotesLoading ? (
                <div className="h-4 w-20 animate-pulse-soft rounded bg-ink/5" aria-hidden="true" />
              ) : available ? (
                <div className="flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-sm font-semibold text-ink">{formatPrice(quote.price, quote.currency)}</span>
                  <span className={`text-xs font-medium ${quote.changePercent >= 0 ? 'text-lime' : 'text-vermilion'}`}>
                    {formatPercent(quote.changePercent)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-ink/40">Unavailable right now</span>
              )}

              {chartStatus.kind === 'ready' ? <MiniSparkline points={chartStatus.points} /> : <MiniSparkline points={[]} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
