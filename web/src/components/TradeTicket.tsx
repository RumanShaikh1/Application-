import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import ChoiceSelector from './ChoiceSelector'
import RationaleInput from './RationaleInput'
import StockIconGrid from './StockIconGrid'
import { api } from '../lib/api'
import { formatPercent, formatPrice } from '../lib/formatStats'
import type { Choice, StockStats, TradeSide } from '@shared/types'

const SIDE_CHOICES: Choice[] = [
  { id: 'buy', label: 'Buy', description: 'Open or add to a position.' },
  { id: 'sell', label: 'Sell', description: 'Reduce or close a position.' }
]

interface TradeTicketProps {
  onSubmit: (params: { symbol: string; side: TradeSide; quantity: number; rationale: string }) => void
  submitting: boolean
  submitError: string
}

export default function TradeTicket({ onSubmit, submitting, submitError }: TradeTicketProps) {
  const [symbolInput, setSymbolInput] = useState('')
  const [quote, setQuote] = useState<StockStats | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState('')

  const [side, setSide] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('')
  const [quantityError, setQuantityError] = useState('')
  const [rationale, setRationale] = useState('')
  const [rationaleError, setRationaleError] = useState('')

  async function lookupSymbol(): Promise<void> {
    const symbol = symbolInput.trim()
    if (!symbol) return
    setLookingUp(true)
    setLookupError('')
    try {
      const result = await api.getQuote(symbol)
      if (!result) {
        setQuote(null)
        setLookupError(`No quote found for "${symbol}".`)
        return
      }
      setQuote(result)
    } catch (err) {
      setQuote(null)
      setLookupError(err instanceof Error ? err.message : 'Could not look up that symbol.')
    } finally {
      setLookingUp(false)
    }
  }

  /** The icon grid already has a live quote in hand when a card is tapped - populate the ticket directly instead of round-tripping through another lookup call. */
  function handleGridSelect(selected: StockStats): void {
    setSymbolInput(selected.symbol)
    setLookupError('')
    setQuote(selected)
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (!quote || !side) return

    const parsedQuantity = Number(quantity)
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setQuantityError('Enter a whole number of shares greater than zero.')
      return
    }
    setQuantityError('')

    if (!rationale.trim()) {
      setRationaleError('Explain your reasoning before submitting.')
      return
    }
    setRationaleError('')

    onSubmit({ symbol: quote.symbol, side: side as TradeSide, quantity: parsedQuantity, rationale })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <StockIconGrid onSelect={handleGridSelect} />

      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-ink/35">
        <span className="h-px flex-1 bg-ink/10" />
        Or search for another symbol
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <div>
        <label htmlFor="symbol" className="mb-1.5 block text-sm font-semibold text-ink">
          Symbol
        </label>
        <div className="flex gap-2">
          <input
            id="symbol"
            value={symbolInput}
            onChange={(event) => {
              setSymbolInput(event.target.value.toUpperCase())
              setQuote(null)
            }}
            placeholder="e.g. RELIANCE.NS"
            className="flex-1 rounded-2xl border border-ink/15 bg-surface p-3 text-sm text-ink placeholder:text-ink/35 focus-visible:ring-2 focus-visible:ring-vermilion"
          />
          <button
            type="button"
            onClick={lookupSymbol}
            disabled={lookingUp || !symbolInput.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-ink px-4 text-sm font-semibold text-bone transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search size={14} aria-hidden="true" />
            {lookingUp ? 'Looking up...' : 'Look up'}
          </button>
        </div>
        {lookupError ? (
          <p className="mt-1.5 text-xs text-vermilion" role="alert">
            {lookupError}
          </p>
        ) : null}
        {quote ? (
          <div className="mt-2 rounded-xl bg-ink/[0.03] p-3 text-sm">
            <span className="font-semibold text-ink">{quote.name}</span>
            <span className="ml-2 tabular-nums text-ink/70">{formatPrice(quote.price, quote.currency)}</span>
            <span className={`ml-2 text-xs font-medium ${quote.changePercent >= 0 ? 'text-lime' : 'text-vermilion'}`}>{formatPercent(quote.changePercent)}</span>
          </div>
        ) : null}
      </div>

      {quote ? (
        <>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Buy or sell?</h3>
            <ChoiceSelector choices={SIDE_CHOICES} selectedId={side} onSelect={setSide} legend="Buy or sell?" />
          </div>

          <div>
            <label htmlFor="quantity" className="mb-1.5 block text-sm font-semibold text-ink">
              Quantity (shares)
            </label>
            <input
              id="quantity"
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

          <RationaleInput value={rationale} onChange={setRationale} error={rationaleError} />

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
    </form>
  )
}
