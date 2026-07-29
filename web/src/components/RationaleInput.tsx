interface RationaleInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  maxLength?: number
  /** Defaults to the original required-field framing (Simulator's TradeTicket still requires this). Decision Replay passes `false` now that the factor multi-select carries the graded rationale signal. */
  required?: boolean
  label?: string
  hint?: string
}

const MAX_LENGTH_DEFAULT = 1500

export default function RationaleInput({
  value,
  onChange,
  error,
  maxLength = MAX_LENGTH_DEFAULT,
  required = true,
  label = 'Why? Explain your reasoning.',
  hint = "There's no single right answer - explain the reasoning behind your choice."
}: RationaleInputProps) {
  const remaining = maxLength - value.length

  return (
    <div>
      <label htmlFor="rationale" className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id="rationale"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        rows={5}
        required={required}
        aria-describedby={error ? 'rationale-error' : 'rationale-hint'}
        aria-invalid={Boolean(error)}
        placeholder="What in the information you saw led you to this choice?"
        className={`w-full rounded-2xl border bg-surface p-3.5 text-sm leading-relaxed text-ink placeholder:text-ink/35 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone ${
          error ? 'border-vermilion' : 'border-ink/15'
        }`}
      />
      <div className="mt-1.5 flex items-center justify-between text-xs">
        {error ? (
          <p id="rationale-error" className="text-vermilion" role="alert">
            {error}
          </p>
        ) : (
          <p id="rationale-hint" className="text-ink/45">
            {hint}
          </p>
        )}
        <span className="shrink-0 text-ink/40 tabular-nums">{remaining}</span>
      </div>
    </div>
  )
}
