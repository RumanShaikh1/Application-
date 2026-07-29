import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import StatusState, { type ViewState } from '../components/StatusState'
import { api } from '../lib/api'
import type { ScenarioDifficulty, ScenarioSummary } from '@shared/types'

const DIFFICULTY_LABEL: Record<ScenarioDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced'
}

const DIFFICULTY_CLASS: Record<ScenarioDifficulty, string> = {
  beginner: 'bg-lime text-carbon',
  intermediate: 'bg-cobalt/15 text-cobalt',
  advanced: 'bg-vermilion/15 text-vermilion'
}

export default function ScenarioListPage() {
  const [state, setState] = useState<ViewState>('loading')
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setState('loading')
    api
      .listScenarios()
      .then((result) => {
        setScenarios(result)
        setState(result.length === 0 ? 'empty' : 'populated')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load scenarios.')
        setState('error')
      })
  }, [attempt])

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Decision Replay</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">
          Step into anonymised moments from real Indian-market history. Information arrives the way it actually did - decide, then see how your reasoning
          measured up. You're graded on the decision, never on what the price did afterward.
        </p>
      </div>

      <StatusState
        state={state}
        loadingLabel="Loading scenarios..."
        emptyIcon={BookOpen}
        emptyTitle="No scenarios yet"
        emptyBody="Check back soon - new scenarios are added over time."
        errorMessage={error}
        onRetry={() => setAttempt((n) => n + 1)}
      >
        <ul className="space-y-3">
          {scenarios.map((scenario) => (
            <li key={scenario.id}>
              <Link
                to={`/scenario/${scenario.id}`}
                className="block rounded-2xl border border-ink/10 bg-surface p-4 shadow-liftedSm transition-colors hover:border-vermilion/40 focus-visible:ring-2 focus-visible:ring-vermilion"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-base font-semibold text-ink">{scenario.title}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${DIFFICULTY_CLASS[scenario.difficulty]}`}>
                    {DIFFICULTY_LABEL[scenario.difficulty]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {scenario.conceptTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/55">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </StatusState>
    </div>
  )
}
