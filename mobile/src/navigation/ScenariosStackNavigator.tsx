import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { ScenarioAnswerResponse } from '../../../shared/types'
import ScenarioListScreen from '../screens/ScenarioListScreen'
import ScenarioPlayerScreen from '../screens/ScenarioPlayerScreen'
import ResultsScreen from '../screens/ResultsScreen'
import { colors } from '../theme'

export type ScenariosStackParamList = {
  ScenarioList: undefined
  ScenarioPlayer: { scenarioId: string }
  Results: { scenarioId: string; response: ScenarioAnswerResponse; decisionDay: number }
}

const Stack = createNativeStackNavigator<ScenariosStackParamList>()

export default function ScenariosStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bone },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bone }
      }}
    >
      <Stack.Screen name="ScenarioList" component={ScenarioListScreen} options={{ title: 'Decision Replay' }} />
      <Stack.Screen name="ScenarioPlayer" component={ScenarioPlayerScreen} options={{ title: 'Scenario' }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
    </Stack.Navigator>
  )
}
