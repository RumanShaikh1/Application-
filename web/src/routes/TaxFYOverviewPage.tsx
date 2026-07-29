import { useCallback, useEffect, useState } from 'react'
import RealizedGainsForm from '../components/RealizedGainsForm'
import LossPositionList from '../components/LossPositionList'
import LossHarvestingSummary from '../components/LossHarvestingSummary'
import StatusState, { type ViewState } from '../components/StatusState'
import { api } from '../lib/api'
import { getFYState, addLossPosition, removeLossPosition, resetFYState, setRealizedGains } from '../lib/taxStore'
import type { LossHarvestingResult, OpenLossPosition, RealizedGainsThisFY } from '@shared/types'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TaxFYOverviewPage() {
  const [fyState, setFyState] = useState(getFYState())
  const [state, setState] = useState<ViewState>('loading')
  const [result, setResult] = useState<LossHarvestingResult | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback((positions: OpenLossPosition[], realizedGains: RealizedGainsThisFY) => {
    setState('loading')
    api.tax
      .lossHarvesting(positions, realizedGains, todayIso())
      .then((response) => {
        setResult(response)
        setState('populated')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not check this financial year.')
        setState('error')
      })
  }, [])

  useEffect(() => {
    refresh(fyState.positions, fyState.realizedGains)
    // Only on mount - subsequent changes go through the handlers below, which already call refresh with the latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleGainsChange(realizedGains: RealizedGainsThisFY): void {
    const next = setRealizedGains(realizedGains)
    setFyState(next)
    refresh(next.positions, next.realizedGains)
  }

  function handleAddPosition(position: OpenLossPosition): void {
    const next = addLossPosition(position)
    setFyState(next)
    refresh(next.positions, next.realizedGains)
  }

  function handleRemovePosition(id: string): void {
    const next = removeLossPosition(id)
    setFyState(next)
    refresh(next.positions, next.realizedGains)
  }

  function handleReset(): void {
    if (!window.confirm('Clear your realised gains and loss positions for this financial year?')) return
    const next = resetFYState()
    setFyState(next)
    refresh(next.positions, next.realizedGains)
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">This financial year, so far</h1>
          <p className="mt-1 text-sm leading-relaxed text-ink/60">
            Enter what you've realised so far and any open positions sitting on a loss. This shows what the set-off rules permit before 31 March - never
            an instruction to sell. Nothing here is saved anywhere but this browser.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-vermilion/50 hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
        >
          Reset
        </button>
      </div>

      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Realised so far this FY</h2>
        <RealizedGainsForm value={fyState.realizedGains} onChange={handleGainsChange} />
      </section>

      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink/45">Open positions sitting on a loss</h2>
        <LossPositionList positions={fyState.positions} onAdd={handleAddPosition} onRemove={handleRemovePosition} />
      </section>

      <StatusState state={state} loadingLabel="Checking the numbers..." errorMessage={error} onRetry={() => refresh(fyState.positions, fyState.realizedGains)}>
        {result ? <LossHarvestingSummary result={result} /> : null}
      </StatusState>
    </div>
  )
}
