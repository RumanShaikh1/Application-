import { useEffect, useMemo, useRef, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { ArrowRight } from 'lucide-react-native'
import StatusState, { type ViewState } from '../components/StatusState'
import StageReveal from '../components/StageReveal'
import ScenarioChart from '../components/ScenarioChart'
import ChoiceSelector from '../components/ChoiceSelector'
import RationaleInput from '../components/RationaleInput'
import { api } from '../lib/api'
import { recordAttempt } from '../lib/progressStore'
import { colors } from '../theme'
import type { OHLCPoint, ScenarioAnswerResponse, ScenarioStagePayload } from '../../../shared/types'
import type { ScenariosStackParamList } from '../navigation/ScenariosStackNavigator'

type Props = NativeStackScreenProps<ScenariosStackParamList, 'ScenarioPlayer'>

export default function ScenarioPlayerScreen({ route, navigation }: Props) {
  const { scenarioId } = route.params

  const [stageIndex, setStageIndex] = useState(0)
  const [revealed, setRevealed] = useState<ScenarioStagePayload[]>([])
  const [state, setState] = useState<ViewState>('loading')
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  // Ignores a response from a stale effect run - same requestId idiom as
  // web/src/routes/ScenarioPlayerPage.tsx.
  const requestIdRef = useRef(0)
  // Guards "Reveal next" against a rapid double-tap: RN batches several
  // synchronous setStageIndex(n => n + 1) calls the same way React web
  // does, which can jump straight past a valid stage into an out-of-range
  // one before the button unmounts. This is the exact bug found and fixed
  // on the web player during its bug survey - carried over here rather
  // than re-introduced.
  const advancingRef = useRef(false)

  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [rationale, setRationale] = useState('')
  const [rationaleError, setRationaleError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const requestId = ++requestIdRef.current
    advancingRef.current = false
    setState('loading')
    api
      .getScenarioStage(scenarioId, stageIndex)
      .then((payload) => {
        if (requestIdRef.current !== requestId) return
        setRevealed((prev) => [...prev, payload])
        setState('populated')
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return
        setError(err instanceof Error ? err.message : 'Could not load this scenario.')
        setState('error')
      })
  }, [scenarioId, stageIndex, retryNonce])

  const latest = revealed[revealed.length - 1]

  const priceSeries = useMemo<OHLCPoint[]>(() => {
    if (revealed.length === 0) return []
    const points = [...revealed[0].priceSeed]
    for (const payload of revealed) {
      if (payload.stage.kind === 'price' && payload.stage.priceExtension) {
        points.push(...payload.stage.priceExtension)
      }
    }
    return points
  }, [revealed])

  function retryStage(): void {
    setRetryNonce((n) => n + 1)
  }

  function goToNextStage(): void {
    if (advancingRef.current) return
    advancingRef.current = true
    setStageIndex((n) => n + 1)
  }

  async function handleSubmit(): Promise<void> {
    if (!choiceId) return
    if (!rationale.trim()) {
      setRationaleError('Explain your reasoning before submitting.')
      return
    }
    setRationaleError('')
    setSubmitError('')
    setSubmitting(true)
    try {
      const response: ScenarioAnswerResponse = await api.submitAnswer(scenarioId, { choiceId, rationale })
      await recordAttempt({
        scenarioId,
        choiceId,
        scoreTotal: response.scoreTotal,
        maxScore: response.maxScore,
        choiceQuality: response.choiceQuality,
        answeredAt: Date.now()
      })
      const decisionDay = priceSeries[priceSeries.length - 1]?.day ?? 0
      navigation.navigate('Results', { scenarioId, response, decisionDay })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit your answer.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitDisabled = !choiceId || submitting

  return (
    <ScrollView className="flex-1 bg-bone" contentContainerClassName="gap-5 p-4">
      {revealed.length > 0 ? <Text className="text-lg font-semibold text-ink">{revealed[0].companyContext}</Text> : null}

      {priceSeries.length > 0 ? (
        <View className="rounded-2xl bg-ink p-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-bone/50">Price so far</Text>
          <ScenarioChart points={priceSeries} />
        </View>
      ) : null}

      <View className="gap-3">
        {revealed.map((payload) => (
          <StageReveal key={payload.stageIndex} stage={payload.stage} />
        ))}
      </View>

      <StatusState state={state} loadingLabel="Loading the next piece of information..." errorMessage={error} onRetry={retryStage}>
        {latest && !latest.isFinalStage ? (
          <Pressable
            onPress={goToNextStage}
            accessibilityRole="button"
            accessibilityLabel="Reveal next"
            className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-bone">Reveal next</Text>
            <ArrowRight size={16} color={colors.bone} />
          </Pressable>
        ) : null}

        {latest?.isFinalStage && latest.choices ? (
          <View className="gap-4 rounded-2xl border border-ink/10 bg-surface p-4">
            <View>
              <Text className="mb-2 text-base font-semibold text-ink">What do you do?</Text>
              <ChoiceSelector choices={latest.choices} selectedId={choiceId} onSelect={setChoiceId} legend="What do you do?" />
            </View>
            <RationaleInput value={rationale} onChange={setRationale} error={rationaleError} />
            {submitError ? (
              <Text className="text-sm text-vermilion" accessibilityRole="alert">
                {submitError}
              </Text>
            ) : null}
            <Pressable
              onPress={handleSubmit}
              disabled={submitDisabled}
              accessibilityRole="button"
              accessibilityLabel={submitting ? 'Scoring your decision' : 'Submit decision'}
              accessibilityState={{ disabled: submitDisabled }}
              className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-full py-3 ${submitDisabled ? 'bg-vermilion/50' : 'bg-vermilion active:opacity-80'}`}
            >
              {submitting ? <ActivityIndicator color={colors.bone} size="small" /> : null}
              <Text className="text-sm font-semibold text-bone">{submitting ? 'Scoring your decision...' : 'Submit decision'}</Text>
            </Pressable>
          </View>
        ) : null}
      </StatusState>
    </ScrollView>
  )
}
