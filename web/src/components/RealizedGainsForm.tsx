import { useState } from 'react'
import type { RealizedGainsThisFY } from '@shared/types'

interface RealizedGainsFormProps {
  value: RealizedGainsThisFY
  onChange: (value: RealizedGainsThisFY) => void
}

export default function RealizedGainsForm({ value, onChange }: RealizedGainsFormProps) {
  const [shortTermInput, setShortTermInput] = useState(String(value.shortTermGains))
  const [longTermInput, setLongTermInput] = useState(String(value.longTermGains))
  const [shortTermError, setShortTermError] = useState('')
  const [longTermError, setLongTermError] = useState('')

  function commitShortTerm(): void {
    const parsed = Number(shortTermInput)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setShortTermError('Enter zero or a positive amount.')
      return
    }
    setShortTermError('')
    onChange({ ...value, shortTermGains: parsed })
  }

  function commitLongTerm(): void {
    const parsed = Number(longTermInput)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setLongTermError('Enter zero or a positive amount.')
      return
    }
    setLongTermError('')
    onChange({ ...value, longTermGains: parsed })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="stGains" className="mb-1.5 block text-sm font-semibold text-ink">
          Short-term gains realised so far this FY (₹)
        </label>
        <input
          id="stGains"
          inputMode="decimal"
          value={shortTermInput}
          onChange={(e) => setShortTermInput(e.target.value)}
          onBlur={commitShortTerm}
          aria-invalid={Boolean(shortTermError)}
          aria-describedby={shortTermError ? 'stGains-error' : undefined}
          className={`w-full rounded-2xl border bg-surface p-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-vermilion ${
            shortTermError ? 'border-vermilion' : 'border-ink/15'
          }`}
        />
        {shortTermError ? (
          <p id="stGains-error" className="mt-1.5 text-xs text-vermilion" role="alert">
            {shortTermError}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="ltGains" className="mb-1.5 block text-sm font-semibold text-ink">
          Long-term gains realised so far this FY (₹)
        </label>
        <input
          id="ltGains"
          inputMode="decimal"
          value={longTermInput}
          onChange={(e) => setLongTermInput(e.target.value)}
          onBlur={commitLongTerm}
          aria-invalid={Boolean(longTermError)}
          aria-describedby={longTermError ? 'ltGains-error' : undefined}
          className={`w-full rounded-2xl border bg-surface p-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-vermilion ${
            longTermError ? 'border-vermilion' : 'border-ink/15'
          }`}
        />
        {longTermError ? (
          <p id="ltGains-error" className="mt-1.5 text-xs text-vermilion" role="alert">
            {longTermError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
