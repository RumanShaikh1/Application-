import { useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import StatusState, { type ViewState } from '../components/StatusState'
import { api } from '../lib/api'
import { getAllAttempts } from '../lib/progressStore'
import type { ChoiceQuality, ScenarioAttemptRecord, ScenarioSummary } from '@shared/types'

const QUALITY_CLASS: Record<ChoiceQuality, string> = {
  sound: 'bg-lime text-carbon',
  acceptable: 'bg-cobalt/15 text-cobalt',
  poor: 'bg-vermilion/15 text-vermilion'
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProgressPage() {
  // Attempts live in localStorage - reading them is synchronous, so there's
  // no real "loading" state for the core content here. The scenario-title
  // lookup below is a nice-to-have enhancement on top, not a blocker: if it
  // fails, attempts still render using their raw scenario id as a fallback.
  const attempts: ScenarioAttemptRecord[] = useMemo(() => getAllAttempts(), [])
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])

  useEffect(() => {
    api
      .listScenarios()
      .then(setScenarios)
      .catch(() => {
        // Non-fatal - title lookup is cosmetic, see comment above.
      })
  }, [])

  const titleById = useMemo(() => new Map(scenarios.map((scenario) => [scenario.id, scenario.title])), [scenarios])
  const state: ViewState = attempts.length === 0 ? 'empty' : 'populated'
  const averageScore =
    attempts.length > 0 ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.scoreTotal / attempt.maxScore) * 100, 0) / attempts.length) : 0

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Your progress</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">Every scenario you've completed on this device, most recent first.</p>
      </div>

      <StatusState
        state={state}
        emptyIcon={Trophy}
        emptyTitle="No scenarios completed yet"
        emptyBody="Play a scenario from the list to start building your track record."
      >
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Scenarios completed</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">{attempts.length}</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Average score</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">{averageScore}%</p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {attempts.map((attempt, index) => (
            <li
              key={`${attempt.scenarioId}-${attempt.answeredAt}-${index}`}
              className="flex items-center justify-between rounded-2xl border border-ink/10 bg-surface p-3.5 shadow-liftedSm"
            >
              <div>
                <p className="text-sm font-medium text-ink">{titleById.get(attempt.scenarioId) ?? attempt.scenarioId}</p>
                <p className="text-xs text-ink/45">{formatDate(attempt.answeredAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold tabular-nums text-ink">
                  {attempt.scoreTotal}/{attempt.maxScore}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${QUALITY_CLASS[attempt.choiceQuality]}`}>{attempt.choiceQuality}</span>
              </div>
            </li>
          ))}
        </ul>
      </StatusState>
    </div>
  )
}
