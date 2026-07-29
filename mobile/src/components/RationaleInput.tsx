import { Text, TextInput, View } from 'react-native'
import { colors } from '../theme'

interface RationaleInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  maxLength?: number
}

const MAX_LENGTH_DEFAULT = 1500

export default function RationaleInput({ value, onChange, error, maxLength = MAX_LENGTH_DEFAULT }: RationaleInputProps) {
  const remaining = maxLength - value.length

  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-ink">Why? Explain your reasoning.</Text>
      <TextInput
        accessibilityLabel="Why? Explain your reasoning."
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        placeholder="What in the information you saw led you to this choice?"
        placeholderTextColor={`${colors.ink}59`}
        className={`min-h-[110px] rounded-2xl border bg-surface p-3.5 text-sm leading-5 text-ink ${error ? 'border-vermilion' : 'border-ink/15'}`}
      />
      <View className="mt-1.5 flex-row items-center justify-between">
        {error ? (
          <Text className="flex-1 text-xs text-vermilion" accessibilityRole="alert">
            {error}
          </Text>
        ) : (
          <Text className="flex-1 text-xs text-ink/45">There's no single right answer - explain the reasoning behind your choice.</Text>
        )}
        <Text className="ml-2 text-xs text-ink/40">{remaining}</Text>
      </View>
    </View>
  )
}
