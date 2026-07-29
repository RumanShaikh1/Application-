import { Text, View } from 'react-native'
import { CheckCircle2, XCircle } from 'lucide-react-native'
import type { ChoiceQuality, CostBreakdown, RubricCriterionResult, ScenarioOutcome } from '../../../shared/types'
import { formatPercent, formatPrice } from '../lib/formatStats'
import { colors } from '../theme'
import ScenarioChart from './ScenarioChart'

interface ScoreBreakdownProps {
  scoreTotal: number
  maxScore: number
  choiceQuality: ChoiceQuality
  criteria: RubricCriterionResult[]
  feedback: string
  idealSummary: string
  outcome: ScenarioOutcome
  costBreakdown: CostBreakdown
  decisionDay: number
}

const QUALITY_LABEL: Record<ChoiceQuality, string> = {
  sound: 'Sound decision',
  acceptable: 'Acceptable decision',
  poor: 'Off the mark'
}

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

export default function ScoreBreakdown({
  scoreTotal,
  maxScore,
  choiceQuality,
  criteria,
  feedback,
  idealSummary,
  outcome,
  costBreakdown,
  decisionDay
}: ScoreBreakdownProps) {
  return (
    <View className="gap-5">
      <View className="rounded-2xl border border-ink/10 bg-surface p-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink/45">Your score</Text>
            <Text className="text-3xl font-semibold text-ink">
              {scoreTotal} <Text className="text-lg text-ink/40">/ {maxScore}</Text>
            </Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${QUALITY_BADGE_CLASS[choiceQuality]}`}>
            <Text className={`text-xs font-semibold ${QUALITY_TEXT_CLASS[choiceQuality]}`}>{QUALITY_LABEL[choiceQuality]}</Text>
          </View>
        </View>
        <Text className="mt-3 text-sm leading-5 text-ink/75">{feedback}</Text>
      </View>

      <View className="rounded-2xl border border-ink/10 bg-surface p-5">
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">What a sound decision considers</Text>
        <View className="gap-2.5">
          {criteria.map((criterion) => (
            <View key={criterion.id} className="flex-row gap-2.5">
              {criterion.matched ? (
                <CheckCircle2 size={18} color={colors.lime} style={{ marginTop: 2 }} />
              ) : (
                <XCircle size={18} color={`${colors.ink}40`} style={{ marginTop: 2 }} />
              )}
              <View className="flex-1">
                <Text className="text-sm text-ink">{criterion.description}</Text>
                {criterion.evidence ? <Text className="mt-0.5 text-xs text-ink/50">{criterion.evidence}</Text> : null}
              </View>
            </View>
          ))}
        </View>
        <Text className="mt-4 rounded-xl bg-ink/[0.03] p-3.5 text-sm leading-5 text-ink/75">{idealSummary}</Text>
      </View>

      <View className="rounded-2xl bg-ink p-5">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-bone/50">What happened</Text>
        <Text className="mb-3 text-xs leading-4 text-bone/60">
          This reflects what happened - which is not the same as whether you were right. Scenarios are graded on the quality of your decision given what
          was known at the time, never on the outcome.
        </Text>
        <ScenarioChart points={outcome.priceSeries} decisionDay={decisionDay} />
        <Text className="mt-4 text-sm leading-5 text-bone/80">{outcome.summary}</Text>
      </View>

      <View className="rounded-2xl border border-ink/10 bg-surface p-5">
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/45">Cost of a real round trip</Text>
        <Text className="mb-3 text-xs leading-4 text-ink/55">
          Illustrative for a 100-share position - brokerage, STT, exchange fees, and slippage all eat into returns. The percentages are what matter;
          rupee amounts just make the drag concrete.
        </Text>
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm text-ink/60">Gross return</Text>
          <Text className="text-lg font-semibold text-ink">{formatPercent(costBreakdown.grossReturnPercent)}</Text>
        </View>
        <View className="mt-1 flex-row items-baseline justify-between">
          <Text className="text-sm text-ink/60">Net of costs</Text>
          <Text className={`text-lg font-semibold ${costBreakdown.netReturnPercent >= 0 ? 'text-ink' : 'text-vermilion'}`}>
            {formatPercent(costBreakdown.netReturnPercent)}
          </Text>
        </View>
        <View className="mt-3 flex-row flex-wrap justify-between gap-y-1.5 border-t border-ink/10 pt-3">
          <View className="w-[48%] flex-row justify-between">
            <Text className="text-xs text-ink/55">Brokerage</Text>
            <Text className="text-xs text-ink/55">{formatPrice(costBreakdown.brokerageCost)}</Text>
          </View>
          <View className="w-[48%] flex-row justify-between">
            <Text className="text-xs text-ink/55">STT</Text>
            <Text className="text-xs text-ink/55">{formatPrice(costBreakdown.sttCost)}</Text>
          </View>
          <View className="w-[48%] flex-row justify-between">
            <Text className="text-xs text-ink/55">Exchange fees</Text>
            <Text className="text-xs text-ink/55">{formatPrice(costBreakdown.exchangeFees)}</Text>
          </View>
          <View className="w-[48%] flex-row justify-between">
            <Text className="text-xs text-ink/55">Slippage</Text>
            <Text className="text-xs text-ink/55">{formatPrice(costBreakdown.slippageCost)}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
