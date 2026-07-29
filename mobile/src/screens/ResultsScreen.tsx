import { Pressable, ScrollView, Text } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import ScoreBreakdown from '../components/ScoreBreakdown'
import type { ScenariosStackParamList } from '../navigation/ScenariosStackNavigator'

type Props = NativeStackScreenProps<ScenariosStackParamList, 'Results'>

// Unlike web/src/routes/ResultsPage.tsx, there's no "empty state for a
// fresh direct navigation" concern here - React Navigation's typed params
// mean this screen is only ever reachable via an explicit
// navigation.navigate('Results', {...}) call from the player, which always
// supplies real data. There's no URL bar to bypass that the way there is
// on web.
export default function ResultsScreen({ route, navigation }: Props) {
  const { response, decisionDay } = route.params

  return (
    <ScrollView className="flex-1 bg-bone" contentContainerClassName="gap-5 p-4">
      <ScoreBreakdown
        scoreTotal={response.scoreTotal}
        maxScore={response.maxScore}
        choiceQuality={response.choiceQuality}
        criteria={response.criteria}
        feedback={response.feedback}
        idealSummary={response.idealSummary}
        outcome={response.outcome}
        costBreakdown={response.costBreakdown}
        decisionDay={decisionDay}
      />
      <Pressable
        onPress={() => navigation.navigate('ScenarioList')}
        accessibilityRole="button"
        accessibilityLabel="Try another scenario"
        className="min-h-[44px] items-center justify-center rounded-full bg-ink py-3 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-bone">Try another scenario</Text>
      </Pressable>
    </ScrollView>
  )
}
