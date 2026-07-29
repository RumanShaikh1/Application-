import { useEffect, useState, type FormEvent } from 'react'
import { Info } from 'lucide-react'
import ChoiceSelector from './ChoiceSelector'
import SandboxStockModal from './SandboxStockModal'
import { api } from '../lib/api'
import { POPULAR_STOCKS } from '../lib/popularStocks'
import { THESIS_CHOICES } from '../lib/thesisChoices'
import { formatPercent, formatPrice, yearOf } from '../lib/formatStats'
import type { SandboxCompany, SandboxDayPriceQuote, SandboxStyleLabel, ThesisTag, TradeSide } from '@shared/types'

interface SandboxTradeTicketProps {
  dayCursor: number
  onSubmit: (params: { symbol: string; side: TradeSide; quantity: number; thesisTag?: ThesisTag }) => void
  submitting: boolean
  submitError: string
}

const SIDE_CHOICES = [
  { id: 'buy', label: 'Buy', description: 'Open or add to a position.' },
  { id: 'sell', label: 'Sell', description: 'Reduce or close a position.' }
]

const STYLE_LABEL_COPY: Record<SandboxStyleLabel, { label: string; className: string }> = {
  large_stable: { label: 'Large & stable', className: 'bg-cobalt/15 text-cobalt' },
  higher_growth: { label: 'Higher growth', className: 'bg-lime text-carbon' },
  higher_risk: { label: 'Higher risk', className: 'bg-vermilion/15 text-vermilion' }
}

const ICON_TINTS = ['bg-vermilion/10 text-vermilion', 'bg-cobalt/10 text-cobalt', 'bg-lime/20 text-ink'] as const
const INITIALS_BY_SYMBOL = new Map(POPULAR_STOCKS.map((stock) => [stock.symbol.toUpperCase(), stock.initials]))

function initialsFor(company: SandboxCompany): string {
  return INITIALS_BY_SYMBOL.get(company.symbol.toUpperCase()) ?? company.name.split(' ').map((word) => word[0]).join('').slice(0, 4).toUpperCase()
}

/**
 * The 2020-replay counterpart to TradeTicket - same shape (pick a stock,
 * buy/sell, quantity, submit) but the picker shows real day-cursor'd prices
 * instead of a live quote, and a buy requires a one-tap thesis instead of
 * free text. Each card's info button opens the same SandboxStockModal the
 * (now-removed) standalone Sandbox board used, so research and trading live
 * in one place.
 */
export default function SandboxTradeTicket({ dayCursor, onSubmit, submitting, submitError }: SandboxTradeTicketProps) {
  const [companies, setCompanies] = useState<SandboxCompany[]>([])
  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, SandboxDayPriceQuote>>({})
  const [fundamentalsAsOfDate, setFundamentalsAsOfDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [infoSymbol, setInfoSymbol] = useState<string | null>(null)

  const [selected, setSelected] = useState<{ company: SandboxCompany; quote: SandboxDayPriceQuote } | null>(null)
  const [side, setSide] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('')
  const [quantityError, setQuantityError] = useState('')
  const [thesisId, setThesisId] = useState<string | null>(null)
  const [thesisError, setThesisError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    Promise.all([api.sandbox.listCompanies(), api.sandbox.getPricesForDay(dayCursor)])
      .then(([snapshot, prices]) => {
        if (cancelled) return
        setCompanies(snapshot.companies)
        setFundamentalsAsOfDate(snapshot.asOfDate)
        setQuotesBySymbol(Object.fromEntries(prices.quotes.map((quote) => [quote.symbol.toUpperCase(), quote])))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Could not load the Nifty 20 for this day.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dayCursor])

  function selectCompany(company: SandboxCompany): void {
    const quote = quotesBySymbol[company.symbol.toUpperCase()]
    if (!quote) return
    setSelected({ company, quote })
    setSide(null)
    setThesisId(null)
    setThesisError('')
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (!selected || !side) return

    const parsedQuantity = Number(quantity)
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setQuantityError('Enter a whole number of shares greater than zero.')
      return
    }
    setQuantityError('')

    if (side === 'buy' && !thesisId) {
      setThesisError('Pick a reason before buying.')
      return
    }
    setThesisError('')

    onSubmit({
      symbol: selected.company.symbol,
      side: side as TradeSide,
      quantity: parsedQuantity,
      thesisTag: side === 'buy' ? (thesisId as ThesisTag) : undefined
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="mb-1 font-display text-base font-semibold text-ink">Choose a stock</h2>
        <p className="mb-3 text-sm text-ink/55">
          Prices are real closes from this window's day {dayCursor}. Tap a company to trade it, or the <Info size={12} className="inline" aria-hidden="true" /> for
          its full picture first.
        </p>

        {(() => {
          const fundamentalsYear = yearOf(fundamentalsAsOfDate)
          const priceYear = yearOf(Object.values(quotesBySymbol)[0]?.date)
          if (!fundamentalsYear || !priceYear || fundamentalsYear === priceYear) return null
          return (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-cobalt/25 bg-cobalt/8 p-3 text-xs leading-relaxed text-ink/70">
              <Info size={14} className="mt-0.5 shrink-0 text-cobalt" aria-hidden="true" />
              <p>
                Fundamentals shown are recent (as of {fundamentalsYear}); prices replay {priceYear}. For learning the mechanics only - they are not from the
                same period.
              </p>
            </div>
          )
        })()}

        {loadError ? (
          <p className="text-sm text-vermilion" role="alert">
            {loadError}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {(loading ? Array.from<SandboxCompany | null>({ length: 6 }).fill(null) : companies).map((company, index) => {
              if (!company) {
                return <div key={index} className="h-[74px] animate-pulse-soft rounded-2xl bg-ink/5" aria-hidden="true" />
              }
              const quote = quotesBySymbol[company.symbol.toUpperCase()]
              const style = STYLE_LABEL_COPY[company.styleLabel]
              const tint = ICON_TINTS[index % ICON_TINTS.length]
              const isSelected = selected?.company.symbol === company.symbol

              return (
                <div
                  key={company.symbol}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                    isSelected ? 'border-vermilion bg-vermilion/8 shadow-soft' : 'border-ink/10 bg-surface'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectCompany(company)}
                    disabled={!quote}
                    className="flex flex-1 items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${tint}`} aria-hidden="true">
                      {initialsFor(company)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{company.name}</span>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className}`}>{style.label}</span>
                      {quote ? (
                        <span className="mt-1 flex items-baseline gap-1.5 tabular-nums">
                          <span className="text-sm font-semibold text-ink">{formatPrice(quote.close)}</span>
                          <span className={`text-xs font-medium ${quote.changePercent >= 0 ? 'text-lime' : 'text-vermilion'}`}>
                            {formatPercent(quote.changePercent)}
                          </span>
                        </span>
                      ) : (
                        <span className="mt-1 block text-xs text-ink/40">Unavailable on this day</span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoSymbol(company.symbol)}
                    aria-label={`Full details for ${company.name}`}
                    className="shrink-0 rounded-full p-1.5 text-ink/40 transition-colors hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
                  >
                    <Info size={16} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected ? (
        <>
          <div className="rounded-xl bg-ink/[0.03] p-3 text-sm">
            <span className="font-semibold text-ink">{selected.company.name}</span>
            <span className="ml-2 tabular-nums text-ink/70">{formatPrice(selected.quote.close)}</span>
            <span className="ml-1 text-xs text-ink/45">on {selected.quote.date}</span>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Buy or sell?</h3>
            <ChoiceSelector choices={SIDE_CHOICES} selectedId={side} onSelect={setSide} legend="Buy or sell?" />
          </div>

          <div>
            <label htmlFor="sandbox-quantity" className="mb-1.5 block text-sm font-semibold text-ink">
              Quantity (shares)
            </label>
            <input
              id="sandbox-quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0"
              className={`w-full rounded-2xl border bg-surface p-3 text-sm text-ink placeholder:text-ink/35 focus-visible:ring-2 focus-visible:ring-vermilion ${
                quantityError ? 'border-vermilion' : 'border-ink/15'
              }`}
            />
            {quantityError ? (
              <p className="mt-1.5 text-xs text-vermilion" role="alert">
                {quantityError}
              </p>
            ) : null}
          </div>

          {side === 'buy' ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Why this buy?</h3>
              <ChoiceSelector choices={THESIS_CHOICES} selectedId={thesisId} onSelect={setThesisId} legend="Why this buy?" />
              {thesisError ? (
                <p className="mt-1.5 text-xs text-vermilion" role="alert">
                  {thesisError}
                </p>
              ) : null}
            </div>
          ) : null}

          {submitError ? (
            <p className="text-sm text-vermilion" role="alert">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!side || submitting}
            className="w-full rounded-full bg-vermilion py-3 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Placing trade...' : 'Place trade'}
          </button>
        </>
      ) : null}

      {infoSymbol ? <SandboxStockModal symbol={infoSymbol} onClose={() => setInfoSymbol(null)} /> : null}
    </form>
  )
}
