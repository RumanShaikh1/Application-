import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import StatusState, { type ViewState } from '../components/StatusState'
import StageReveal from '../components/StageReveal'
import ScenarioChart from '../components/ScenarioChart'
import ChoiceSelector from '../components/ChoiceSelector'
import FactorSelect from '../components/FactorSelect'
import RationaleInput from '../components/RationaleInput'
import { api } from '../lib/api'
import { recordAttempt } from '../lib/progressStore'
import type { OHLCPoint, ScenarioAnswerResponse, ScenarioStagePayload } from '@shared/types'

export default function ScenarioPlayerPage() {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const navigate = useNavigate()

  const [stageIndex, setStageIndex] = useState(0)
  const [revealed, setRevealed] = useState<ScenarioStagePayload[]>([])
  const [state, setState] = useState<ViewState>('loading')
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  // Ignores a response from a stale effect run (React StrictMode's dev-time
  // double-invoke fires this effect twice; only the latest run's response
  // should ever be applied) - same requestId idiom as
  // extension/src/content/components/Translator.tsx.
  const requestIdRef = useRef(0)
  // Guards "Reveal next" against a rapid multi-click: React batches several
  // synchronous setStageIndex(n => n + 1) calls from the same click burst
  // into one combined update (0 -> 1 -> 2 -> 3, not three separate 0 -> 1
  // renders), which can jump straight past a valid stage into an
  // out-of-range one before the button has a chance to unmount. Only the
  // effect itself (once it actually starts fetching the new stage) clears
  // this, so at most one advance is ever queued per click burst.
  const advancingRef = useRef(false)

  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [selectedFactorIds, setSelectedFactorIds] = useState<string[]>([])
  const [factorError, setFactorError] = useState('')
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!scenarioId) return
    const requestId = ++requestIdRef.current
    advancingRef.current = false
    setState('loading')
    api
      .getScenarioStage(scenarioId, stageIndex)
      .then((payload) => {
        if (requestIdRef.current !== requestId) return
        setRevealed((prev) => [...prev, payload])
        setState('populated')
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return
        setError(err instanceof Error ? err.message : 'Could not load this scenario.')
        setState('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, stageIndex, retryNonce])

  const latest = revealed[revealed.length - 1]

  const priceSeries = useMemo<OHLCPoint[]>(() => {
    if (revealed.length === 0) return []
    const points = [...revealed[0].priceSeed]
    for (const payload of revealed) {
      if (payload.stage.kind === 'price' && payload.stage.priceExtension) {
        points.push(...payload.stage.priceExtension)
      }
    }
    return points
  }, [revealed])

  function retryStage(): void {
    setRetryNonce((n) => n + 1)
  }

  function goToNextStage(): void {
    if (advancingRef.current) return
    advancingRef.current = true
    setStageIndex((n) => n + 1)
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!scenarioId || !choiceId) return
    if (selectedFactorIds.length === 0) {
      setFactorError('Select at least one factor before submitting.')
      return
    }
    setFactorError('')
    setSubmitError('')
    setSubmitting(true)
    try {
      const response: ScenarioAnswerResponse = await api.submitAnswer(scenarioId, {
        choiceId,
        selectedFactorIds,
        ...(rationale.trim() ? { rationale } : {})
      })
      recordAttempt({
        scenarioId,
        choiceId,
        scoreTotal: response.scoreTotal,
        maxScore: response.maxScore,
        choiceQuality: response.choiceQuality,
        answeredAt: Date.now()
      })
      const decisionDay = priceSeries[priceSeries.length - 1]?.day ?? 0
      navigate(`/scenario/${scenarioId}/results`, { state: { response, decisionDay } })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit your answer.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!scenarioId) return null

  return (
    <div className="animate-fade-in space-y-5">
      <button
        type="button"
        onClick={() => navigate('/scenarios')}
        className="flex items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-medium text-ink/60 transition-colors hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        All scenarios
      </button>

      {revealed.length > 0 ? <p className="font-display text-lg font-semibold text-ink">{revealed[0].companyContext}</p> : null}

      {priceSeries.length > 0 ? (
        <section className="rounded-2xl bg-carbon p-4 shadow-soft">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-chalk/50">Price so far</h2>
          <ScenarioChart points={priceSeries} />
        </section>
      ) : null}

      <div className="space-y-3">
        {revealed.map((payload) => (
          <StageReveal key={payload.stageIndex} stage={payload.stage} />
        ))}
      </div>

      <StatusState state={state} loadingLabel="Loading the next piece of information..." errorMessage={error} onRetry={retryStage}>
        {latest && !latest.isFinalStage ? (
          <button
            type="button"
            onClick={goToNextStage}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
          >
            Reveal next
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ) : null}

        {latest?.isFinalStage && latest.choices ? (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
            <div>
              <h2 className="mb-2 font-display text-base font-semibold text-ink">What do you do?</h2>
              <ChoiceSelector choices={latest.choices} selectedId={choiceId} onSelect={setChoiceId} legend="What do you do?" />
            </div>
            {latest.factorOptions ? (
              <div>
                <h2 className="mb-2 font-display text-base font-semibold text-ink">Which of these support that decision?</h2>
                <FactorSelect
                  options={latest.factorOptions}
                  selectedIds={selectedFactorIds}
                  onChange={(ids) => {
                    setSelectedFactorIds(ids)
                    if (ids.length > 0) setFactorError('')
                  }}
                  legend="Which of these support that decision?"
                  error={factorError}
                />
              </div>
            ) : null}
            <RationaleInput value={rationale} onChange={setRationale} label="Anything else? (optional)" required={false} />
            {submitError ? (
              <p className="text-sm text-vermilion" role="alert">
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!choiceId || submitting}
              className="w-full rounded-full bg-vermilion py-3 text-sm font-semibold text-chalk transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Scoring your decision...' : 'Submit decision'}
            </button>
          </form>
        ) : null}
      </StatusState>
    </div>
  )
}
