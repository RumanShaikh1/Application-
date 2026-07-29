import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { ScrollView, Text, View } from 'react-native'
import { Trophy } from 'lucide-react-native'
import StatusState, { type ViewState } from '../components/StatusState'
import { api } from '../lib/api'
import { getAllAttempts } from '../lib/progressStore'
import type { ChoiceQuality, ScenarioAttemptRecord, ScenarioSummary } from '../../../shared/types'

const QUALITY_BADGE_CLASS: Record<ChoiceQuality, string> = {
  sound: 'bg-lime',
  acceptable: 'bg-cobalt/15',
  poor: 'bg-vermilion/15'
}

const QUALITY_TEXT_CLASS: Record<ChoiceQuality, string> = {
  sound: 'text-ink',
  acceptable: 'text-cobalt',
  poor: 'text-vermilion'
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProgressScreen() {
  const [attempts, setAttempts] = useState<ScenarioAttemptRecord[]>([])
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  // AsyncStorage.getItem is inherently async (unlike web's synchronous
  // localStorage read in web/src/routes/ProgressPage.tsx), so there's a
  // real, brief loading state here that the web version never needed.
  const [loaded, setLoaded] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      getAllAttempts().then((result) => {
        if (!cancelled) {
          setAttempts(result)
          setLoaded(true)
        }
      })
      api
        .listScenarios()
        .then((result) => {
          if (!cancelled) setScenarios(result)
        })
        .catch(() => {
          // Non-fatal - title lookup is cosmetic, attempts still render
          // using their raw scenario id as a fallback.
        })
      return () => {
        cancelled = true
      }
    }, [])
  )

  const titleById = useMemo(() => new Map(scenarios.map((scenario) => [scenario.id, scenario.title])), [scenarios])
  const state: ViewState = !loaded ? 'loading' : attempts.length === 0 ? 'empty' : 'populated'
  const averageScore =
    attempts.length > 0 ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.scoreTotal / attempt.maxScore) * 100, 0) / attempts.length) : 0

  return (
    <ScrollView className="flex-1 bg-bone" contentContainerClassName="gap-5 p-4">
      <StatusState
        state={state}
        loadingLabel="Loading your progress..."
        emptyIcon={Trophy}
        emptyTitle="No scenarios completed yet"
        emptyBody="Play a scenario from the list to start building your track record."
      >
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-ink/10 bg-surface p-4">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink/45">Scenarios completed</Text>
            <Text className="mt-1 text-2xl font-semibold text-ink">{attempts.length}</Text>
          </View>
          <View className="flex-1 rounded-2xl border border-ink/10 bg-surface p-4">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink/45">Average score</Text>
            <Text className="mt-1 text-2xl font-semibold text-ink">{averageScore}%</Text>
          </View>
        </View>

        <View className="mt-5 gap-2.5">
          {attempts.map((attempt, index) => (
            <View
              key={`${attempt.scenarioId}-${attempt.answeredAt}-${index}`}
              className="flex-row items-center justify-between rounded-2xl border border-ink/10 bg-surface p-3.5"
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm font-medium text-ink">{titleById.get(attempt.scenarioId) ?? attempt.scenarioId}</Text>
                <Text className="text-xs text-ink/45">{formatDate(attempt.answeredAt)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-ink">
                  {attempt.scoreTotal}/{attempt.maxScore}
                </Text>
                <View className={`rounded-full px-2 py-0.5 ${QUALITY_BADGE_CLASS[attempt.choiceQuality]}`}>
                  <Text className={`text-xs font-semibold ${QUALITY_TEXT_CLASS[attempt.choiceQuality]}`}>{attempt.choiceQuality}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </StatusState>
    </ScrollView>
  )
}
