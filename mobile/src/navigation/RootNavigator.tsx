import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { BookOpen, Trophy } from 'lucide-react-native'
import ScenariosStackNavigator from './ScenariosStackNavigator'
import ProgressScreen from '../screens/ProgressScreen'
import { colors } from '../theme'

export type RootTabParamList = {
  Scenarios: undefined
  Progress: undefined
}

const Tab = createBottomTabNavigator<RootTabParamList>()

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.vermilion,
        tabBarInactiveTintColor: `${colors.ink}80`,
        tabBarStyle: { backgroundColor: colors.bone, borderTopColor: `${colors.ink}1A` }
      }}
    >
      <Tab.Screen
        name="Scenarios"
        component={ScenariosStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ headerShown: true, title: 'Your progress', tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} /> }}
      />
    </Tab.Navigator>
  )
}
