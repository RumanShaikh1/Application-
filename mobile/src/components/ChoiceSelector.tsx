import { Pressable, Text, View } from 'react-native'
import type { Choice } from '../../../shared/types'

interface ChoiceSelectorProps {
  choices: Choice[]
  selectedId: string | null
  onSelect: (id: string) => void
  legend: string
}

/**
 * Touch equivalent of web/src/components/ChoiceSelector.tsx's ARIA
 * radiogroup: each option is accessibilityRole="radio" with
 * accessibilityState reflecting checked status, so VoiceOver/TalkBack
 * announce and navigate them correctly. There's no keyboard/arrow-key
 * requirement here - that's a desktop-web-specific expectation; the
 * touch-first equivalent is a large enough target (44pt minimum per
 * Apple/Android HIG) and a clear pressed/selected visual state.
 */
export default function ChoiceSelector({ choices, selectedId, onSelect, legend }: ChoiceSelectorProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={legend} className="gap-2.5">
      {choices.map((choice) => {
        const isSelected = choice.id === selectedId
        return (
          <Pressable
            key={choice.id}
            onPress={() => onSelect(choice.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={choice.label}
            accessibilityHint={choice.description}
            className={`min-h-[44px] rounded-2xl border p-4 active:opacity-80 ${isSelected ? 'border-vermilion bg-vermilion/8' : 'border-ink/12 bg-surface'}`}
          >
            <Text className="text-sm font-semibold text-ink">{choice.label}</Text>
            {choice.description ? <Text className="mt-1 text-xs leading-4 text-ink/60">{choice.description}</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
}
