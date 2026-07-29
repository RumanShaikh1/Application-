import { useState, type FormEvent } from 'react'
import ChoiceSelector from './ChoiceSelector'
import type { Choice, FnoInstrument, TaxTradeInput, TradeType } from '@shared/types'

const TRADE_TYPE_CHOICES: Choice[] = [
  { id: 'equity_delivery', label: 'Equity delivery', description: 'Bought and held - capital gains, short or long term.' },
  { id: 'equity_intraday', label: 'Intraday', description: 'Bought and sold the same day - speculative business income, not a capital gain.' },
  { id: 'fno', label: 'F&O', description: 'Futures or options - non-speculative business income, not a capital gain.' }
]

const FNO_INSTRUMENT_CHOICES: Choice[] = [
  { id: 'futures', label: 'Futures', description: '' },
  { id: 'options', label: 'Options', description: 'STT is charged on the premium.' }
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface TaxTradeFormProps {
  onSubmit: (trade: TaxTradeInput) => void
  submitting: boolean
  submitError: string
  submitLabel: string
}

interface FieldErrors {
  tradeType?: string
  fnoInstrument?: string
  buyPrice?: string
  sellPrice?: string
  quantity?: string
  buyDate?: string
  sellDate?: string
  fairMarketValue?: string
  slabRate?: string
}

export default function TaxTradeForm({ onSubmit, submitting, submitError, submitLabel }: TaxTradeFormProps) {
  const [tradeType, setTradeType] = useState<string | null>('equity_delivery')
  const [fnoInstrument, setFnoInstrument] = useState<string | null>(null)
  const [buyPrice, setBuyPrice] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [buyDate, setBuyDate] = useState('')
  const [sellDate, setSellDate] = useState(todayIso())
  const [fairMarketValue, setFairMarketValue] = useState('')
  const [slabRate, setSlabRate] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const showFmvField = tradeType === 'equity_delivery' && Boolean(buyDate) && buyDate <= '2018-01-31'
  const showSlabRateField = tradeType === 'equity_intraday' || tradeType === 'fno'

  function validateField(field: keyof FieldErrors): string | undefined {
    switch (field) {
      case 'tradeType':
        return tradeType ? undefined : 'Choose a trade type.'
      case 'fnoInstrument':
        return tradeType === 'fno' && !fnoInstrument ? 'Choose futures or options.' : undefined
      case 'buyPrice':
        return Number(buyPrice) > 0 ? undefined : 'Enter a buy price greater than zero.'
      case 'sellPrice':
        return Number(sellPrice) > 0 ? undefined : 'Enter a sell price greater than zero.'
      case 'quantity':
        return Number.isInteger(Number(quantity)) && Number(quantity) > 0 ? undefined : 'Enter a whole number of shares greater than zero.'
      case 'buyDate':
        return buyDate ? undefined : 'Enter the date you bought.'
      case 'sellDate':
        if (!sellDate) return 'Enter the date you sold (or today, if you still hold it).'
        if (buyDate && sellDate < buyDate) return 'Sell date cannot be before the buy date.'
        return undefined
      case 'fairMarketValue':
        return showFmvField && fairMarketValue && Number(fairMarketValue) <= 0 ? 'Fair market value must be a positive number.' : undefined
      case 'slabRate':
        if (!showSlabRateField || !slabRate) return undefined
        const parsed = Number(slabRate)
        return parsed >= 0 && parsed <= 100 ? undefined : 'Slab rate must be between 0 and 100.'
      default:
        return undefined
    }
  }

  function handleBlur(field: keyof FieldErrors): void {
    setErrors((prev) => ({ ...prev, [field]: validateField(field) }))
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()

    const fields: (keyof FieldErrors)[] = ['tradeType', 'fnoInstrument', 'buyPrice', 'sellPrice', 'quantity', 'buyDate', 'sellDate', 'fairMarketValue', 'slabRate']
    const nextErrors: FieldErrors = {}
    for (const field of fields) {
      const error = validateField(field)
      if (error) nextErrors[field] = error
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const trade: TaxTradeInput = {
      tradeType: tradeType as TradeType,
      ...(tradeType === 'fno' ? { fnoInstrument: fnoInstrument as FnoInstrument } : {}),
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      quantity: Number(quantity),
      buyDate,
      sellDate,
      ...(showFmvField && fairMarketValue ? { fairMarketValueJan312018: Number(fairMarketValue) } : {}),
      ...(showSlabRateField && slabRate ? { incomeSlabRatePercent: Number(slabRate) } : {})
    }
    onSubmit(trade)
  }

  const inputClass = (error: string | undefined) =>
    `w-full rounded-2xl border bg-surface p-3 text-sm text-ink placeholder:text-ink/35 focus-visible:ring-2 focus-visible:ring-vermilion ${
      error ? 'border-vermilion' : 'border-ink/15'
    }`

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Trade type</h3>
        <ChoiceSelector
          choices={TRADE_TYPE_CHOICES}
          selectedId={tradeType}
          onSelect={(id) => {
            setTradeType(id)
            setFnoInstrument(null)
            setErrors((prev) => ({ ...prev, tradeType: undefined }))
          }}
          legend="Trade type"
        />
        {errors.tradeType ? (
          <p className="mt-1.5 text-xs text-vermilion" role="alert">
            {errors.tradeType}
          </p>
        ) : null}
      </div>

      {tradeType === 'fno' ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Instrument</h3>
          <ChoiceSelector
            choices={FNO_INSTRUMENT_CHOICES}
            selectedId={fnoInstrument}
            onSelect={(id) => {
              setFnoInstrument(id)
              setErrors((prev) => ({ ...prev, fnoInstrument: undefined }))
            }}
            legend="F&O instrument"
          />
          {errors.fnoInstrument ? (
            <p className="mt-1.5 text-xs text-vermilion" role="alert">
              {errors.fnoInstrument}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="buyPrice" className="mb-1.5 block text-sm font-semibold text-ink">
            Buy price (₹)
          </label>
          <input
            id="buyPrice"
            inputMode="decimal"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            onBlur={() => handleBlur('buyPrice')}
            aria-invalid={Boolean(errors.buyPrice)}
            aria-describedby={errors.buyPrice ? 'buyPrice-error' : undefined}
            placeholder="0.00"
            className={inputClass(errors.buyPrice)}
          />
          {errors.buyPrice ? (
            <p id="buyPrice-error" className="mt-1.5 text-xs text-vermilion" role="alert">
              {errors.buyPrice}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="buyDate" className="mb-1.5 block text-sm font-semibold text-ink">
            Buy date
          </label>
          <input
            id="buyDate"
            type="date"
            value={buyDate}
            onChange={(e) => setBuyDate(e.target.value)}
            onBlur={() => handleBlur('buyDate')}
            aria-invalid={Boolean(errors.buyDate)}
            aria-describedby={errors.buyDate ? 'buyDate-error' : undefined}
            className={inputClass(errors.buyDate)}
          />
          {errors.buyDate ? (
            <p id="buyDate-error" className="mt-1.5 text-xs text-vermilion" role="alert">
              {errors.buyDate}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="sellPrice" className="mb-1.5 block text-sm font-semibold text-ink">
            {tradeType === 'equity_delivery' ? 'Sell price / current price (₹)' : 'Sell price (₹)'}
          </label>
          <input
            id="sellPrice"
            inputMode="decimal"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            onBlur={() => handleBlur('sellPrice')}
            aria-invalid={Boolean(errors.sellPrice)}
            aria-describedby={errors.sellPrice ? 'sellPrice-error' : undefined}
            placeholder="0.00"
            className={inputClass(errors.sellPrice)}
          />
          {errors.sellPrice ? (
            <p id="sellPrice-error" className="mt-1.5 text-xs text-vermilion" role="alert">
              {errors.sellPrice}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="sellDate" className="mb-1.5 block text-sm font-semibold text-ink">
            Sell date
          </label>
          <input
            id="sellDate"
            type="date"
            value={sellDate}
            onChange={(e) => setSellDate(e.target.value)}
            onBlur={() => handleBlur('sellDate')}
            aria-invalid={Boolean(errors.sellDate)}
            aria-describedby={errors.sellDate ? 'sellDate-error' : undefined}
            className={inputClass(errors.sellDate)}
          />
          {tradeType === 'equity_delivery' ? <p className="mt-1.5 text-xs text-ink/45">Leave as today if you still hold it.</p> : null}
          {errors.sellDate ? (
            <p id="sellDate-error" className="mt-1.5 text-xs text-vermilion" role="alert">
              {errors.sellDate}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="quantity" className="mb-1.5 block text-sm font-semibold text-ink">
            Quantity
          </label>
          <input
            id="quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={() => handleBlur('quantity')}
            aria-invalid={Boolean(errors.quantity)}
            aria-describedby={errors.quantity ? 'quantity-error' : undefined}
            placeholder="0"
            className={inputClass(errors.quantity)}
          />
          {errors.quantity ? (
            <p id="quantity-error" className="mt-1.5 text-xs text-vermilion" role="alert">
              {errors.quantity}
            </p>
          ) : null}
        </div>

        {showFmvField ? (
          <div>
            <label htmlFor="fmv" className="mb-1.5 block text-sm font-semibold text-ink">
              FMV on 31 Jan 2018 (₹) - optional
            </label>
            <input
              id="fmv"
              inputMode="decimal"
              value={fairMarketValue}
              onChange={(e) => setFairMarketValue(e.target.value)}
              onBlur={() => handleBlur('fairMarketValue')}
              aria-invalid={Boolean(errors.fairMarketValue)}
              aria-describedby={errors.fairMarketValue ? 'fmv-error' : undefined}
              placeholder="Leave blank if not applicable"
              className={inputClass(errors.fairMarketValue)}
            />
            <p className="mt-1.5 text-xs text-ink/45">Only matters for shares bought on or before 31 Jan 2018 - grandfathering may apply.</p>
            {errors.fairMarketValue ? (
              <p id="fmv-error" className="mt-1.5 text-xs text-vermilion" role="alert">
                {errors.fairMarketValue}
              </p>
            ) : null}
          </div>
        ) : null}

        {showSlabRateField ? (
          <div>
            <label htmlFor="slabRate" className="mb-1.5 block text-sm font-semibold text-ink">
              Your income slab rate (%) - optional
            </label>
            <input
              id="slabRate"
              inputMode="numeric"
              value={slabRate}
              onChange={(e) => setSlabRate(e.target.value)}
              onBlur={() => handleBlur('slabRate')}
              aria-invalid={Boolean(errors.slabRate)}
              aria-describedby={errors.slabRate ? 'slabRate-error' : undefined}
              placeholder="e.g. 30"
              className={inputClass(errors.slabRate)}
            />
            <p className="mt-1.5 text-xs text-ink/45">Needed for an exact tax figure - this is business income, taxed at your slab rate, not guessed.</p>
            {errors.slabRate ? (
              <p id="slabRate-error" className="mt-1.5 text-xs text-vermilion" role="alert">
                {errors.slabRate}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {submitError ? (
        <p className="text-sm text-vermilion" role="alert">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-vermilion py-3 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Calculating...' : submitLabel}
      </button>
    </form>
  )
}
