import { Text, View } from 'react-native'
import { BarChart3, FileText, Newspaper, TrendingUp, type LucideIcon } from 'lucide-react-native'
import type { ScenarioStage } from '../../../shared/types'
import { colors } from '../theme'

interface StageRevealProps {
  stage: ScenarioStage
}

const KIND_META: Record<ScenarioStage['kind'], { icon: LucideIcon; label: string }> = {
  headline: { icon: Newspaper, label: 'Headline' },
  filing: { icon: FileText, label: 'Filing' },
  fundamentals: { icon: BarChart3, label: 'Fundamentals' },
  price: { icon: TrendingUp, label: 'Price update' }
}

export default function StageReveal({ stage }: StageRevealProps) {
  const { icon: Icon, label } = KIND_META[stage.kind]

  return (
    <View className="rounded-2xl border border-ink/10 bg-surface p-4">
      <View className="mb-2 flex-row items-center gap-2">
        <Icon size={14} color={colors.ink} />
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</Text>
      </View>

      {stage.kind === 'headline' && stage.headline ? <Text className="text-base font-medium leading-6 text-ink">{stage.headline}</Text> : null}

      {stage.kind === 'filing' && stage.filingSummary ? <Text className="text-sm leading-5 text-ink/80">{stage.filingSummary}</Text> : null}

      {stage.kind === 'fundamentals' && stage.fundamentals ? (
        <View className="flex-row flex-wrap gap-2">
          {Object.entries(stage.fundamentals).map(([key, value]) => (
            <View key={key} className="w-[48%] rounded-xl bg-ink/[0.03] p-2.5">
              <Text className="text-xs text-ink/50">{key}</Text>
              <Text className="text-sm font-semibold text-ink">{String(value)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {stage.kind === 'price' ? (
        <Text className="text-sm leading-5 text-ink/80">{stage.note ?? 'The price has moved since the last update.'}</Text>
      ) : stage.note ? (
        <Text className="mt-2 text-xs italic leading-5 text-ink/50">{stage.note}</Text>
      ) : null}
    </View>
  )
}
