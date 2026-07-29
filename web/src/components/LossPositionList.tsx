import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import ChoiceSelector from './ChoiceSelector'
import { formatPrice } from '../lib/formatStats'
import type { Choice, LossClassification, OpenLossPosition } from '@shared/types'

const CLASSIFICATION_CHOICES: Choice[] = [
  { id: 'short_term', label: 'Short-term', description: 'Held 12 months or less.' },
  { id: 'long_term', label: 'Long-term', description: 'Held more than 12 months.' }
]

interface LossPositionListProps {
  positions: OpenLossPosition[]
  onAdd: (position: OpenLossPosition) => void
  onRemove: (id: string) => void
}

export default function LossPositionList({ positions, onAdd, onRemove }: LossPositionListProps) {
  const [label, setLabel] = useState('')
  const [lossAmount, setLossAmount] = useState('')
  const [classification, setClassification] = useState<string | null>('short_term')
  const [labelError, setLabelError] = useState('')
  const [lossAmountError, setLossAmountError] = useState('')

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()

    let hasError = false
    if (!label.trim()) {
      setLabelError('Give this position a name, e.g. the stock symbol.')
      hasError = true
    } else {
      setLabelError('')
    }
    const parsedLoss = Number(lossAmount)
    if (!Number.isFinite(parsedLoss) || parsedLoss <= 0) {
      setLossAmountError('Enter the unrealised loss as a positive amount.')
      hasError = true
    } else {
      setLossAmountError('')
    }
    if (hasError || !classification) return

    onAdd({
      id: crypto.randomUUID(),
      label: label.trim(),
      unrealizedLossAmount: parsedLoss,
      classification: classification as LossClassification
    })
    setLabel('')
    setLossAmount('')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="positionLabel" className="mb-1.5 block text-sm font-semibold text-ink">
              Position
            </label>
            <input
              id="positionLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. INFY"
              aria-invalid={Boolean(labelError)}
              aria-describedby={labelError ? 'positionLabel-error' : undefined}
              className={`w-full rounded-2xl border bg-surface p-3 text-sm text-ink placeholder:text-ink/35 focus-visible:ring-2 focus-visible:ring-vermilion ${
                labelError ? 'border-vermilion' : 'border-ink/15'
              }`}
            />
            {labelError ? (
              <p id="positionLabel-error" className="mt-1.5 text-xs text-vermilion" role="alert">
                {labelError}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="lossAmount" className="mb-1.5 block text-sm font-semibold text-ink">
              Unrealised loss (₹)
            </label>
            <input
              id="lossAmount"
              inputMode="decimal"
              value={lossAmount}
              onChange={(e) => setLossAmount(e.target.value)}
              placeholder="0.00"
              aria-invalid={Boolean(lossAmountError)}
              aria-describedby={lossAmountError ? 'lossAmount-error' : undefined}
              className={`w-full rounded-2xl border bg-surface p-3 text-sm text-ink placeholder:text-ink/35 focus-visible:ring-2 focus-visible:ring-vermilion ${
                lossAmountError ? 'border-vermilion' : 'border-ink/15'
              }`}
            />
            {lossAmountError ? (
              <p id="lossAmount-error" className="mt-1.5 text-xs text-vermilion" role="alert">
                {lossAmountError}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Classification</h3>
          <ChoiceSelector choices={CLASSIFICATION_CHOICES} selectedId={classification} onSelect={setClassification} legend="Loss classification" />
        </div>

        <button
          type="submit"
          className="w-full rounded-full border border-ink/15 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          Add position
        </button>
      </form>

      {positions.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-4 text-center text-sm text-ink/55">No open loss positions added yet.</p>
      ) : (
        <ul className="space-y-2">
          {positions.map((position) => (
            <li key={position.id} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-surface p-3.5 text-sm">
              <div>
                <span className="font-semibold text-ink">{position.label}</span>
                <span className="ml-2 text-xs text-ink/50">{position.classification === 'short_term' ? 'Short-term' : 'Long-term'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-vermilion">-{formatPrice(position.unrealizedLossAmount)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(position.id)}
                  aria-label={`Remove ${position.label}`}
                  className="rounded-full p-1.5 text-ink/40 transition-colors hover:bg-vermilion/10 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
