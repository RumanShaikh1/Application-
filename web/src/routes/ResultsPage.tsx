import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ScoreBreakdown from '../components/ScoreBreakdown'
import StatusState from '../components/StatusState'
import type { ScenarioAnswerResponse } from '@shared/types'

interface ResultsLocationState {
  response: ScenarioAnswerResponse
  decisionDay: number
}

function isResultsState(value: unknown): value is ResultsLocationState {
  return Boolean(value) && typeof value === 'object' && value !== null && 'response' in value
}

export default function ResultsPage() {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const location = useLocation()
  const state = isResultsState(location.state) ? location.state : null

  return (
    <div className="animate-fade-in space-y-5">
      <Link
        to={scenarioId ? `/scenario/${scenarioId}` : '/'}
        className="flex w-fit items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-medium text-ink/60 transition-colors hover:text-vermilion focus-visible:ring-2 focus-visible:ring-vermilion"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back
      </Link>

      {state ? (
        <>
          <ScoreBreakdown
            scoreTotal={state.response.scoreTotal}
            maxScore={state.response.maxScore}
            choiceQuality={state.response.choiceQuality}
            criteria={state.response.criteria}
            feedback={state.response.feedback}
            idealSummary={state.response.idealSummary}
            outcome={state.response.outcome}
            costBreakdown={state.response.costBreakdown}
            decisionDay={state.decisionDay}
          />
          <Link
            to="/scenarios"
            className="block w-full rounded-full bg-ink py-3 text-center text-sm font-semibold text-bone transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-vermilion focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
          >
            Try another scenario
          </Link>
        </>
      ) : (
        <StatusState
          state="empty"
          emptyTitle="No result to show"
          emptyBody="Results only appear right after you submit a decision. Play the scenario again to see your score."
        >
          <></>
        </StatusState>
      )}
    </div>
  )
}
