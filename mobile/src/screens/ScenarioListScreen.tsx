import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { BookOpen } from 'lucide-react-native'
import StatusState, { type ViewState } from '../components/StatusState'
import { api } from '../lib/api'
import type { ScenarioDifficulty, ScenarioSummary } from '../../../shared/types'
import type { ScenariosStackParamList } from '../navigation/ScenariosStackNavigator'

const DIFFICULTY_LABEL: Record<ScenarioDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced'
}

const DIFFICULTY_BADGE_CLASS: Record<ScenarioDifficulty, string> = {
  beginner: 'bg-lime',
  intermediate: 'bg-cobalt/15',
  advanced: 'bg-vermilion/15'
}

const DIFFICULTY_TEXT_CLASS: Record<ScenarioDifficulty, string> = {
  beginner: 'text-ink',
  intermediate: 'text-cobalt',
  advanced: 'text-vermilion'
}

type Props = NativeStackScreenProps<ScenariosStackParamList, 'ScenarioList'>

export default function ScenarioListScreen({ navigation }: Props) {
  const [state, setState] = useState<ViewState>('loading')
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const load = useCallback(() => {
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
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, attempt])
  )

  return (
    <ScrollView className="flex-1 bg-bone" contentContainerClassName="gap-5 p-4">
      <Text className="text-sm leading-5 text-ink/60">
        Step into anonymised moments from real Indian-market history. Information arrives the way it actually did - decide, then see how your reasoning
        measured up. You're graded on the decision, never on what the price did afterward.
      </Text>

      <StatusState
        state={state}
        loadingLabel="Loading scenarios..."
        emptyIcon={BookOpen}
        emptyTitle="No scenarios yet"
        emptyBody="Check back soon - new scenarios are added over time."
        errorMessage={error}
        onRetry={() => setAttempt((n) => n + 1)}
      >
        <View className="gap-3">
          {scenarios.map((scenario) => (
            <Pressable
              key={scenario.id}
              onPress={() => navigation.navigate('ScenarioPlayer', { scenarioId: scenario.id })}
              accessibilityRole="button"
              accessibilityLabel={scenario.title}
              className="rounded-2xl border border-ink/10 bg-surface p-4 active:opacity-80"
            >
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-base font-semibold text-ink">{scenario.title}</Text>
                <View className={`shrink-0 rounded-full px-2.5 py-1 ${DIFFICULTY_BADGE_CLASS[scenario.difficulty]}`}>
                  <Text className={`text-xs font-semibold ${DIFFICULTY_TEXT_CLASS[scenario.difficulty]}`}>{DIFFICULTY_LABEL[scenario.difficulty]}</Text>
                </View>
              </View>
              <View className="mt-2 flex-row flex-wrap gap-1.5">
                {scenario.conceptTags.map((tag) => (
                  <View key={tag} className="rounded-full bg-ink/5 px-2 py-0.5">
                    <Text className="text-xs text-ink/55">{tag}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
        </View>
      </StatusState>
    </ScrollView>
  )
}
